import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  forecastStockDemand,
  naturalLanguageSearch,
  generateJobTemplate,
  detectAnomalies,
  generatePurchaseOrders,
  getSmartInsights
} from '../services/aiService.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/ai/forecast
 * Predictive stock demand forecasting
 */
router.get('/forecast', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId, daysAhead = 30 } = req.query;

    const result = await forecastStockDemand(
      userId,
      itemId || null,
      parseInt(daysAhead)
    );

    res.json(result);
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/search
 * Natural language search
 */
router.post('/search', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await naturalLanguageSearch(userId, query);

    res.json(result);
  } catch (error) {
    console.error('Natural language search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/generate-template
 * Generate job template from description
 */
router.post('/generate-template', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { description } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const template = await generateJobTemplate(userId, description);

    res.json(template);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/anomalies
 * Detect anomalies in stock consumption patterns
 */
router.get('/anomalies', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await detectAnomalies(userId);

    res.json(result);
  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/purchase-orders
 * Generate purchase order recommendations
 */
router.get('/purchase-orders', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await generatePurchaseOrders(userId);

    res.json(result);
  } catch (error) {
    console.error('Purchase order generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/insights
 * Get smart business insights and recommendations
 */
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.userId;

    const insights = await getSmartInsights(userId);

    res.json(insights);
  } catch (error) {
    console.error('Smart insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
