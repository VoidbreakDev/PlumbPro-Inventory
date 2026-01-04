import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
router.use(authenticateToken);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate smart order suggestions
router.post('/suggestions', async (req, res) => {
  const client = await pool.connect();

  try {
    // Get inventory items
    const inventoryResult = await client.query(`
      SELECT id, name, category, quantity, reorder_level
      FROM inventory_items
      WHERE user_id = $1
      ORDER BY name ASC
    `, [req.user.userId]);

    // Get upcoming jobs
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
      LEFT JOIN inventory_items i ON jai.item_id = i.id
      WHERE j.user_id = $1
        AND j.status IN ('Scheduled', 'In Progress')
        AND j.date >= CURRENT_DATE
      GROUP BY j.id
      ORDER BY j.date ASC
      LIMIT 20
    `, [req.user.userId]);

    const inventory = inventoryResult.rows;
    const upcomingJobs = jobsResult.rows;

    // Build AI prompt
    const prompt = `
You are an AI assistant for a plumbing inventory management system. Analyze the current inventory and upcoming jobs to suggest which items should be reordered.

Current Inventory:
${inventory.map(item => `- ${item.name} (${item.category}): ${item.quantity} in stock, reorder level: ${item.reorder_level}`).join('\n')}

Upcoming Jobs:
${upcomingJobs.map(job => `- ${job.title} (${job.job_type}) on ${job.date}${job.is_picked ? ' [Already picked]' : ''}`).join('\n')}

Please analyze and provide reorder suggestions in the following JSON format:
{
  "suggestions": [
    {
      "itemId": "uuid-here",
      "itemName": "item name",
      "suggestedQuantity": number,
      "reason": "explanation"
    }
  ]
}

Focus on:
1. Items below or at reorder level
2. Items needed for upcoming jobs that aren't picked yet
3. Common consumables that may run out soon

Respond ONLY with valid JSON, no additional text.
`;

    // Call Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    res.json(suggestions);

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
