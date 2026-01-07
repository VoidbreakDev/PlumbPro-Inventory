import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getProviderKey } from '../services/aiKeyService.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.use(authenticateToken);

// Test endpoint to list available models
router.get('/test-models', async (req, res) => {
  try {
    const apiKey =
      req.query.apiKey ||
      (await getProviderKey(req.user.userId, 'gemini')) ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Try to list models
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Failed to list models',
          details: data
        });
      }

      // Filter for text generation models
      const textModels = data.models?.filter(m =>
        m.supportedGenerationMethods?.includes('generateContent')
      ) || [];

      return res.json({
        success: true,
        totalModels: data.models?.length || 0,
        textGenerationModels: textModels.map(m => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description,
          methods: m.supportedGenerationMethods
        }))
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch models',
        details: err.message
      });
    }
  } catch (error) {
    console.error('Test models error:', error);
    res.status(500).json({
      error: 'Failed to test models',
      details: error.message
    });
  }
});

// Generate smart order suggestions
router.post('/suggestions', async (req, res) => {
  const client = await pool.connect();

  try {
    // Get API key from secure storage or fallback to env variable
    const apiKey = (await getProviderKey(req.user.userId, 'gemini')) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('❌ No API key available');
      return res.status(400).json({
        error: 'API key required',
        details: 'Please provide a Gemini API key in Settings → AI Integration'
      });
    }

    // Initialize Gemini AI with provided or env API key
    const genAI = new GoogleGenerativeAI(apiKey);

    // Get inventory items for user
    const inventoryResult = await client.query(`
      SELECT id, name, category, quantity, reorder_level
      FROM inventory_items
      WHERE user_id = $1
      ORDER BY name ASC
    `, [req.user.userId]);

    // Get upcoming jobs for user
    const jobsResult = await client.query(`
      SELECT
        j.id,
        j.title,
        j.job_type,
        j.date,
        j.is_picked,
        COALESCE(
          json_agg(
            jsonb_build_object('itemId', jai.item_id, 'quantity', jai.quantity, 'itemName', i.name)
          ) FILTER (WHERE jai.item_id IS NOT NULL),
          '[]'
        ) as allocated_items
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id AND i.user_id = $1
      WHERE j.status IN ('Scheduled', 'In Progress')
        AND j.user_id = $1
        AND j.date >= CURRENT_DATE
      GROUP BY j.id
      ORDER BY j.date ASC
      LIMIT 20
    `, [req.user.userId]);

    const inventory = inventoryResult.rows;
    const upcomingJobs = jobsResult.rows;

    // Build AI prompt with item IDs
    const prompt = `
You are an AI assistant for a plumbing inventory management system. Analyze the current inventory and upcoming jobs to suggest which items should be reordered.

IMPORTANT RULES:
- You can ONLY suggest items that exist in the Current Inventory list below
- You MUST use the exact itemId from the inventory list
- DO NOT suggest any items that are not in the Current Inventory list
- DO NOT make up or invent new items

Current Inventory (ID | Name | Category | Quantity | Reorder Level):
${inventory.map(item => `${item.id} | ${item.name} | ${item.category} | ${item.quantity} | ${item.reorder_level}`).join('\n')}

Upcoming Jobs:
${upcomingJobs.length > 0 ? upcomingJobs.map(job => `- ${job.title} (${job.job_type}) on ${job.date}${job.is_picked ? ' [Already picked]' : ''}`).join('\n') : 'No upcoming jobs scheduled'}

Please analyze and provide reorder suggestions ONLY for items that exist in the Current Inventory list above.

Return your response in this exact JSON format:
{
  "suggestions": [
    {
      "itemId": "exact-uuid-from-inventory-list",
      "itemName": "exact-name-from-inventory-list",
      "suggestedQuantity": number,
      "reason": "brief explanation"
    }
  ]
}

Focus on:
1. Items currently below or at their reorder level
2. Items that will run low based on upcoming jobs
3. Common consumables that may run out soon

If there are no items that need reordering, return: {"suggestions": []}

Respond ONLY with valid JSON, no additional text before or after.
`;

    // Call Gemini AI
    // Try multiple model names in order of preference (based on available models)
    let result, response, text;
    const modelNamesToTry = [
      'gemini-2.0-flash',           // Gemini 2.0 Flash
      'gemini-2.0-flash-exp',       // Gemini 2.0 Flash Experimental
      'gemini-flash-latest',        // Gemini Flash Latest
      'gemini-pro-latest',          // Gemini Pro Latest
      'gemini-2.5-flash'            // Gemini 2.5 Flash
    ];

    let lastError;
    for (const modelName of modelNamesToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        response = await result.response;
        text = response.text();
        console.log(`✅ Successfully used model: ${modelName}`);
        break; // Success! Exit the loop
      } catch (err) {
        console.log(`❌ Model ${modelName} failed:`, err.message);
        lastError = err;
        continue; // Try next model
      }
    }

    if (!text) {
      throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Validate and filter suggestions to only include items that exist in inventory
    const inventoryIds = new Set(inventory.map(item => item.id));
    const validSuggestions = (aiResponse.suggestions || []).filter(suggestion => {
      const isValid = inventoryIds.has(suggestion.itemId);
      if (!isValid) {
        console.warn(`⚠️ AI suggested non-existent item: ${suggestion.itemName} (${suggestion.itemId})`);
      }
      return isValid;
    });

    console.log(`✅ Filtered ${validSuggestions.length} valid suggestions from ${aiResponse.suggestions?.length || 0} AI suggestions`);

    res.json({ suggestions: validSuggestions });

  } catch (error) {
    console.error('Smart ordering error:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
