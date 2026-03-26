import db from '../config/database.js';
import { generateCompletion, getProviderForFeature } from './aiProviders.js';

export const normalizeMovementTimestamp = (timestamp) => {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    return new Date(0);
  }
  return new Date(parsed);
};

/**
 * Predictive Stock Forecasting
 * Analyzes historical stock movements to predict future demand
 */
export const forecastStockDemand = async (userId, itemId = null, daysAhead = 30) => {
  try {
    const movementCutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);

    // Get historical stock movement data (last 90 days)
    const query = itemId
      ? `SELECT sm.*, ii.name, ii.category, ii.quantity as current_stock, ii.reorder_level
         FROM stock_movements sm
         JOIN inventory_items ii ON sm.item_id = ii.id
         WHERE sm.user_id = $1 AND sm.item_id = $2
         AND sm.timestamp >= $3
         ORDER BY sm.timestamp DESC`
      : `SELECT sm.*, ii.name, ii.category, ii.quantity as current_stock, ii.reorder_level
         FROM stock_movements sm
         JOIN inventory_items ii ON sm.item_id = ii.id
         WHERE sm.user_id = $1
         AND sm.timestamp >= $2
         ORDER BY sm.item_id, sm.timestamp DESC`;

    const params = itemId ? [userId, itemId, movementCutoff] : [userId, movementCutoff];
    const { rows: movements } = await db.query(query, params);

    if (movements.length === 0) {
      return { forecasts: [], message: 'Insufficient historical data for forecasting' };
    }

    // Group by item
    const itemGroups = {};
    movements.forEach(m => {
      if (!itemGroups[m.item_id]) {
        itemGroups[m.item_id] = {
          id: m.item_id,
          name: m.name,
          category: m.category,
          currentStock: m.current_stock,
          reorderLevel: m.reorder_level,
          movements: []
        };
      }
      itemGroups[m.item_id].movements.push(m);
    });

    // Generate AI predictions for each item
    const forecasts = [];

    for (const [itemId, itemData] of Object.entries(itemGroups)) {
      // Calculate basic statistics
      const outMovements = itemData.movements.filter(m => m.type === 'Out');
      const totalOut = outMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const avgDailyConsumption = totalOut / 90;

      // Prepare data for AI analysis
      const movementSummary = itemData.movements.slice(0, 50).map(m => ({
        date: normalizeMovementTimestamp(m.timestamp).toISOString().split('T')[0],
        type: m.type,
        quantity: m.quantity,
        notes: m.notes
      }));

      const prompt = `Analyze this inventory item's historical data and provide a ${daysAhead}-day demand forecast:

Item: ${itemData.name}
Category: ${itemData.category}
Current Stock: ${itemData.currentStock}
Reorder Level: ${itemData.reorderLevel}
Average Daily Consumption (last 90 days): ${avgDailyConsumption.toFixed(2)}

Recent Movement History (last 50 movements):
${JSON.stringify(movementSummary, null, 2)}

Please provide:
1. Predicted demand for the next ${daysAhead} days
2. Confidence level (high/medium/low) with percentage
3. Expected stockout date (if applicable)
4. Recommended reorder quantity
5. Seasonal trends detected (if any)
6. Risk factors or anomalies

Respond in JSON format:
{
  "predictedDemand": number,
  "confidence": "high|medium|low",
  "confidencePercentage": number,
  "expectedStockoutDate": "YYYY-MM-DD or null",
  "recommendedReorderQty": number,
  "seasonalTrends": "description",
  "riskFactors": ["factor1", "factor2"],
  "forecastByWeek": [
    {"week": 1, "estimatedConsumption": number},
    {"week": 2, "estimatedConsumption": number}
  ]
}`;

      try {
        // Use configured provider for forecasting
        const provider = getProviderForFeature('forecast');
        const prediction = await generateCompletion(prompt, provider, { format: 'json' });

        forecasts.push({
          itemId: itemData.id,
          itemName: itemData.name,
          category: itemData.category,
          currentStock: itemData.currentStock,
          reorderLevel: itemData.reorderLevel,
          avgDailyConsumption,
          ...prediction
        });
      } catch (error) {
        console.error(`Failed to generate forecast for ${itemData.name}:`, error);
        // Fallback to simple calculation
        forecasts.push({
          itemId: itemData.id,
          itemName: itemData.name,
          category: itemData.category,
          currentStock: itemData.currentStock,
          reorderLevel: itemData.reorderLevel,
          avgDailyConsumption,
          predictedDemand: Math.round(avgDailyConsumption * daysAhead),
          confidence: 'low',
          confidencePercentage: 50,
          expectedStockoutDate: null,
          recommendedReorderQty: Math.round(avgDailyConsumption * 30),
          seasonalTrends: 'Unable to analyze',
          riskFactors: ['Insufficient AI analysis'],
          forecastByWeek: []
        });
      }
    }

    return { forecasts };
  } catch (error) {
    console.error('Forecast error:', error);
    throw new Error('Failed to generate stock forecast');
  }
};

/**
 * Natural Language Search
 * Allows users to search inventory using natural language queries
 */
export const naturalLanguageSearch = async (userId, query) => {
  try {
    // Get all inventory items for context
    const { rows: items } = await db.query(
      `SELECT id, name, category, quantity, price, reorder_level, supplier, location, description
       FROM inventory_items
       WHERE user_id = $1`,
      [userId]
    );

    if (items.length === 0) {
      return { results: [], interpretation: 'No inventory items found' };
    }

    const prompt = `You are an inventory search assistant. Parse this natural language query and find matching items:

Query: "${query}"

Available Inventory (${items.length} items):
${JSON.stringify(items, null, 2)}

Analyze the query and return matching items. Consider:
- Item names (partial matches, synonyms)
- Categories
- Price ranges (e.g., "under £50", "between £10 and £30")
- Quantities (e.g., "low stock", "more than 100")
- Suppliers
- Locations
- Any other relevant attributes

Respond in JSON format:
{
  "interpretation": "Explain what the user is looking for in plain English",
  "matchedItemIds": ["id1", "id2", ...],
  "filters": {
    "category": "...",
    "priceMin": number,
    "priceMax": number,
    "quantityMin": number,
    "quantityMax": number
  },
  "suggestions": ["alternative search suggestion 1", "suggestion 2"]
}`;

    // Use configured provider for search
    const provider = getProviderForFeature('search');
    const parsed = await generateCompletion(prompt, provider, { format: 'json' });

    // Get matched items
    const matchedItems = items.filter(item =>
      parsed.matchedItemIds.includes(item.id)
    );

    return {
      interpretation: parsed.interpretation,
      results: matchedItems,
      filters: parsed.filters,
      suggestions: parsed.suggestions
    };
  } catch (error) {
    console.error('Natural language search error:', error);
    throw new Error('Failed to process natural language search');
  }
};

/**
 * AI-Powered Job Template Generator
 * Creates job templates from natural language descriptions
 */
export const generateJobTemplate = async (userId, description) => {
  try {
    // Get available inventory items for context
    const { rows: items } = await db.query(
      `SELECT id, name, category, quantity, price
       FROM inventory_items
       WHERE user_id = $1
       ORDER BY category, name`,
      [userId]
    );

    const prompt = `You are a plumbing job planning assistant. Create a detailed job template based on this description:

Description: "${description}"

Available Inventory Items:
${JSON.stringify(items.slice(0, 100), null, 2)}

Generate a comprehensive job template including:
1. Template name
2. Estimated duration (in hours)
3. List of required materials with quantities (use available inventory items when possible)
4. Step-by-step instructions
5. Estimated labor cost
6. Safety considerations

Respond in JSON format:
{
  "templateName": "...",
  "estimatedDuration": number,
  "requiredItems": [
    {
      "itemId": "existing-item-id or null if not in inventory",
      "itemName": "...",
      "quantity": number,
      "notes": "..."
    }
  ],
  "instructions": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "estimatedLaborCost": number,
  "safetyConsiderations": [
    "...",
    "..."
  ],
  "additionalNotes": "..."
}`;

    // Use configured provider for template generation
    const provider = getProviderForFeature('template');
    const template = await generateCompletion(prompt, provider, { format: 'json' });

    return template;
  } catch (error) {
    console.error('Template generation error:', error);
    throw new Error('Failed to generate job template');
  }
};

/**
 * Anomaly Detection
 * Detects unusual stock consumption patterns
 */
export const detectAnomalies = async (userId) => {
  try {
    // Get stock movements from last 90 days
    const { rows: movements } = await db.query(
      `SELECT sm.*, ii.name, ii.category, ii.quantity as current_stock
       FROM stock_movements sm
       JOIN inventory_items ii ON sm.item_id = ii.id
       WHERE sm.user_id = $1
       AND sm.timestamp >= NOW() - INTERVAL '90 days'
       ORDER BY sm.timestamp DESC`,
      [userId]
    );

    if (movements.length < 10) {
      return { anomalies: [], message: 'Insufficient data for anomaly detection' };
    }

    // Calculate statistics per item
    const itemStats = {};
    movements.forEach(m => {
      if (!itemStats[m.item_id]) {
        itemStats[m.item_id] = {
          id: m.item_id,
          name: m.name,
          category: m.category,
          outMovements: [],
          inMovements: []
        };
      }
      if (m.type === 'Out') {
        itemStats[m.item_id].outMovements.push(Math.abs(m.quantity));
      } else if (m.type === 'In') {
        itemStats[m.item_id].inMovements.push(m.quantity);
      }
    });

    // Prepare data for AI analysis
    const statsForAI = Object.values(itemStats).map(item => {
      const outQty = item.outMovements;
      const avgOut = outQty.length > 0 ? outQty.reduce((a, b) => a + b, 0) / outQty.length : 0;
      const maxOut = outQty.length > 0 ? Math.max(...outQty) : 0;
      const minOut = outQty.length > 0 ? Math.min(...outQty) : 0;

      return {
        itemId: item.id,
        name: item.name,
        category: item.category,
        outMovementCount: outQty.length,
        avgOutQuantity: avgOut,
        maxOutQuantity: maxOut,
        minOutQuantity: minOut,
        recentOutMovements: outQty.slice(0, 10)
      };
    });

    const prompt = `Analyze these inventory consumption patterns and detect anomalies:

Inventory Statistics (last 90 days):
${JSON.stringify(statsForAI, null, 2)}

Identify:
1. Unusual spikes in consumption
2. Items with erratic usage patterns
3. Potential waste or theft indicators
4. Items with sudden drops in usage
5. Any other suspicious patterns

Respond in JSON format:
{
  "anomalies": [
    {
      "itemId": "...",
      "itemName": "...",
      "type": "spike|erratic|suspicious|drop",
      "severity": "high|medium|low",
      "description": "Detailed explanation",
      "detectedPattern": "What pattern was detected",
      "recommendation": "What action to take"
    }
  ],
  "summary": "Overall health assessment of inventory patterns"
}`;

    // Use configured provider for anomaly detection
    const provider = getProviderForFeature('anomaly');
    const analysis = await generateCompletion(prompt, provider, { format: 'json' });

    return analysis;
  } catch (error) {
    console.error('Anomaly detection error:', error);
    throw new Error('Failed to detect anomalies');
  }
};

/**
 * Automatic Purchase Order Generation
 * Generates PO suggestions based on stock levels and forecasts
 */
export const generatePurchaseOrders = async (userId) => {
  try {
    // Get items at or below reorder level
    const { rows: lowStockItems } = await db.query(
      `SELECT id, name, category, quantity, reorder_level, price, supplier
       FROM inventory_items
       WHERE user_id = $1 AND quantity <= reorder_level
       ORDER BY (reorder_level - quantity) DESC`,
      [userId]
    );

    if (lowStockItems.length === 0) {
      return { purchaseOrders: [], message: 'All items are adequately stocked' };
    }

    // Get forecasts for these items
    const forecastResult = await forecastStockDemand(userId, null, 30);
    const forecasts = forecastResult.forecasts || [];

    // Match forecasts to low stock items
    const itemsWithForecast = lowStockItems.map(item => {
      const forecast = forecasts.find(f => f.itemId === item.id);
      return {
        ...item,
        forecast: forecast || null
      };
    });

    const prompt = `Generate purchase order recommendations for these low-stock items:

Items Needing Reorder:
${JSON.stringify(itemsWithForecast, null, 2)}

For each item, recommend:
1. Order quantity (consider reorder level, current stock, and forecast)
2. Priority (urgent/high/normal)
3. Estimated cost
4. Reasoning

Respond in JSON format:
{
  "purchaseOrders": [
    {
      "itemId": "...",
      "itemName": "...",
      "currentStock": number,
      "reorderLevel": number,
      "recommendedOrderQty": number,
      "priority": "urgent|high|normal",
      "estimatedCost": number,
      "supplier": "...",
      "reasoning": "Why this quantity and priority",
      "daysUntilStockout": number
    }
  ],
  "totalEstimatedCost": number,
  "summary": "Overall assessment and recommendations"
}`;

    // Use configured provider for purchase orders
    const provider = getProviderForFeature('purchase_orders');
    const poRecommendations = await generateCompletion(prompt, provider, { format: 'json' });

    return poRecommendations;
  } catch (error) {
    console.error('PO generation error:', error);
    throw new Error('Failed to generate purchase orders');
  }
};

/**
 * Smart Insights & Recommendations
 * Provides business insights and actionable recommendations
 */
export const getSmartInsights = async (userId) => {
  try {
    // Gather comprehensive data
    const [inventoryResult, jobsResult, movementsResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total_items,
                SUM(quantity * price) as total_value,
                COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count
         FROM inventory_items WHERE user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT status, COUNT(*) as count
         FROM jobs WHERE user_id = $1
         GROUP BY status`,
        [userId]
      ),
      db.query(
        `SELECT type, COUNT(*) as count, SUM(ABS(quantity)) as total_qty
         FROM stock_movements
         WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
         GROUP BY type`,
        [userId]
      )
    ]);

    const inventoryStats = inventoryResult.rows[0];
    const jobStats = jobsResult.rows;
    const movementStats = movementsResult.rows;

    const prompt = `Analyze this plumbing business data and provide actionable insights:

Inventory Statistics:
- Total Items: ${inventoryStats.total_items}
- Total Value: £${inventoryStats.total_value || 0}
- Low Stock Items: ${inventoryStats.low_stock_count}

Job Statistics:
${JSON.stringify(jobStats, null, 2)}

Stock Movement (Last 30 Days):
${JSON.stringify(movementStats, null, 2)}

Provide:
1. Top 3-5 key insights about the business
2. Specific actionable recommendations
3. Potential risks or opportunities
4. Performance metrics assessment

Respond in JSON format:
{
  "insights": [
    {
      "category": "inventory|jobs|efficiency|financial",
      "title": "...",
      "description": "...",
      "impact": "high|medium|low",
      "trend": "positive|negative|neutral"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "...",
      "expectedBenefit": "...",
      "effort": "low|medium|high"
    }
  ],
  "risks": ["...", "..."],
  "opportunities": ["...", "..."],
  "overallHealthScore": number (0-100)
}`;

    // Use configured provider for insights
    const provider = getProviderForFeature('insights');
    const insights = await generateCompletion(prompt, provider, { format: 'json' });

    return insights;
  } catch (error) {
    console.error('Smart insights error:', error);
    throw new Error('Failed to generate insights');
  }
};
