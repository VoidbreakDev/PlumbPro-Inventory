import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// NOTE: Authentication temporarily disabled for testing
// TODO: Re-enable authentication in production
// router.use(authenticateToken);

// Get stock movements
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { type, itemId, startDate, endDate } = req.query;

    let query = `
      SELECT
        sm.*,
        i.name as item_name,
        i.category as item_category
      FROM stock_movements sm
      JOIN inventory_items i ON sm.item_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND sm.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (itemId) {
      query += ` AND sm.item_id = $${paramCount}`;
      params.push(itemId);
      paramCount++;
    }

    if (startDate) {
      query += ` AND sm.timestamp >= $${paramCount}`;
      params.push(new Date(startDate).getTime());
      paramCount++;
    }

    if (endDate) {
      query += ` AND sm.timestamp <= $${paramCount}`;
      params.push(new Date(endDate).getTime());
      paramCount++;
    }

    query += ' ORDER BY sm.timestamp DESC LIMIT 500';

    const result = await client.query(query, params);

    const movements = result.rows.map(row => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      itemCategory: row.item_category,
      type: row.type,
      quantity: row.quantity,
      reference: row.reference,
      timestamp: row.timestamp
    }));

    res.json(movements);

  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ error: 'Failed to fetch movements' });
  } finally {
    client.release();
  }
});

export default router;
