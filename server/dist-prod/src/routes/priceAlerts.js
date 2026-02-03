/**
 * Price Alerts Routes
 * API endpoints for price change monitoring and alerts
 */

import express from 'express';
import { param, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/price-alerts
 * Get price change alerts with filtering
 */
router.get('/', [
  query('viewed').optional().isBoolean(),
  query('acknowledged').optional().isBoolean(),
  query('itemId').optional().isUUID(),
  query('supplierId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { viewed, acknowledged, itemId, supplierId } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    let whereConditions = ['a.user_id = $1'];
    const values = [req.user.userId];
    let paramIndex = 2;

    if (viewed !== undefined) {
      whereConditions.push(`a.is_viewed = $${paramIndex++}`);
      values.push(viewed === 'true');
    }

    if (acknowledged !== undefined) {
      whereConditions.push(`a.is_acknowledged = $${paramIndex++}`);
      values.push(acknowledged === 'true');
    }

    if (itemId) {
      whereConditions.push(`a.item_id = $${paramIndex++}`);
      values.push(itemId);
    }

    if (supplierId) {
      whereConditions.push(`a.supplier_id = $${paramIndex++}`);
      values.push(supplierId);
    }

    // Store where clause values before adding limit/offset
    const whereValues = [...values];
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;

    values.push(limit);
    values.push(offset);

    const result = await client.query(`
      SELECT
        a.id,
        a.item_id as "itemId",
        i.name as "itemName",
        i.category as "itemCategory",
        a.supplier_id as "supplierId",
        c.name as "supplierName",
        c.company as "supplierCompany",
        a.old_price_excl_gst as "oldPriceExclGst",
        a.new_price_excl_gst as "newPriceExclGst",
        a.price_difference as "priceDifference",
        a.percentage_change as "percentageChange",
        a.is_viewed as "isViewed",
        a.is_acknowledged as "isAcknowledged",
        a.created_at as "createdAt",
        -- Determine alert type
        CASE
          WHEN a.price_difference > 0 THEN 'increase'
          WHEN a.price_difference < 0 THEN 'decrease'
          ELSE 'no_change'
        END as "alertType",
        -- Calculate urgency
        CASE
          WHEN ABS(a.percentage_change) >= 20 THEN 'high'
          WHEN ABS(a.percentage_change) >= 10 THEN 'medium'
          ELSE 'low'
        END as "urgency"
      FROM price_change_alerts a
      JOIN inventory_items i ON a.item_id = i.id
      JOIN contacts c ON a.supplier_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `, values);

    // Get total count using only the WHERE clause values
    const countValues = whereValues;
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM price_change_alerts a
      WHERE ${whereConditions.join(' AND ')}
    `, countValues);

    // Get summary statistics
    const statsResult = await client.query(`
      SELECT
        COUNT(*) as "totalAlerts",
        COUNT(*) FILTER (WHERE is_viewed = false) as "unviewedAlerts",
        COUNT(*) FILTER (WHERE is_acknowledged = false) as "unacknowledgedAlerts",
        COUNT(*) FILTER (WHERE price_difference > 0) as "priceIncreases",
        COUNT(*) FILTER (WHERE price_difference < 0) as "priceDecreases",
        AVG(ABS(percentage_change))::DECIMAL(5,2) as "avgPercentageChange"
      FROM price_change_alerts
      WHERE user_id = $1
    `, [req.user.userId]);

    res.json({
      alerts: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(countResult.rows[0].total)
      },
      statistics: statsResult.rows[0]
    });

  } catch (error) {
    console.error('Get price alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch price alerts' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/price-alerts/summary
 * Get price alert summary statistics
 */
router.get('/summary', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        COUNT(*) as "totalAlerts",
        COUNT(*) FILTER (WHERE is_viewed = false) as "unviewedAlerts",
        COUNT(*) FILTER (WHERE is_acknowledged = false) as "unacknowledgedAlerts",
        COUNT(*) FILTER (WHERE price_difference > 0) as "priceIncreases",
        COUNT(*) FILTER (WHERE price_difference < 0) as "priceDecreases",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as "alertsThisWeek",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as "alertsThisMonth",
        AVG(ABS(percentage_change))::DECIMAL(5,2) as "avgPercentageChange",
        MAX(ABS(percentage_change))::DECIMAL(5,2) as "maxPercentageChange"
      FROM price_change_alerts
      WHERE user_id = $1
    `, [req.user.userId]);

    // Get items with most price changes
    const topItemsResult = await client.query(`
      SELECT
        i.id,
        i.name,
        COUNT(*) as "alertCount",
        AVG(ABS(a.percentage_change))::DECIMAL(5,2) as "avgChange"
      FROM price_change_alerts a
      JOIN inventory_items i ON a.item_id = i.id
      WHERE a.user_id = $1
      GROUP BY i.id, i.name
      ORDER BY "alertCount" DESC
      LIMIT 5
    `, [req.user.userId]);

    // Get suppliers with most price changes
    const topSuppliersResult = await client.query(`
      SELECT
        c.id,
        c.name,
        COUNT(*) as "alertCount",
        AVG(ABS(a.percentage_change))::DECIMAL(5,2) as "avgChange"
      FROM price_change_alerts a
      JOIN contacts c ON a.supplier_id = c.id
      WHERE a.user_id = $1
      GROUP BY c.id, c.name
      ORDER BY "alertCount" DESC
      LIMIT 5
    `, [req.user.userId]);

    res.json({
      summary: result.rows[0],
      topItems: topItemsResult.rows,
      topSuppliers: topSuppliersResult.rows
    });

  } catch (error) {
    console.error('Get price alerts summary error:', error);
    res.status(500).json({ error: 'Failed to fetch price alerts summary' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/price-alerts/:id
 * Get a specific price alert
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT
        a.id,
        a.item_id as "itemId",
        i.name as "itemName",
        i.category as "itemCategory",
        a.supplier_id as "supplierId",
        c.name as "supplierName",
        c.company as "supplierCompany",
        c.email as "supplierEmail",
        c.phone as "supplierPhone",
        a.old_price_excl_gst as "oldPriceExclGst",
        a.new_price_excl_gst as "newPriceExclGst",
        a.price_difference as "priceDifference",
        a.percentage_change as "percentageChange",
        a.is_viewed as "isViewed",
        a.is_acknowledged as "isAcknowledged",
        a.created_at as "createdAt",
        -- Get current price
        s.unit_price_excl_gst as "currentPriceExclGst",
        s.unit_price_incl_gst as "currentPriceInclGst"
      FROM price_change_alerts a
      JOIN inventory_items i ON a.item_id = i.id
      JOIN contacts c ON a.supplier_id = c.id
      LEFT JOIN item_suppliers s ON a.item_id = s.item_id AND a.supplier_id = s.supplier_id
      WHERE a.id = $1 AND a.user_id = $2
    `, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price alert not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get price alert error:', error);
    res.status(500).json({ error: 'Failed to fetch price alert' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/price-alerts/:id/view
 * Mark a price alert as viewed
 */
router.post('/:id/view', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      'UPDATE price_change_alerts SET is_viewed = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price alert not found' });
    }

    res.json({
      message: 'Alert marked as viewed',
      alert: result.rows[0]
    });

  } catch (error) {
    console.error('Mark alert viewed error:', error);
    res.status(500).json({ error: 'Failed to mark alert as viewed' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/price-alerts/:id/acknowledge
 * Mark a price alert as acknowledged
 */
router.post('/:id/acknowledge', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      'UPDATE price_change_alerts SET is_acknowledged = true, is_viewed = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price alert not found' });
    }

    res.json({
      message: 'Alert acknowledged',
      alert: result.rows[0]
    });

  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/price-alerts/view-all
 * Mark all price alerts as viewed
 */
router.post('/view-all', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'UPDATE price_change_alerts SET is_viewed = true WHERE user_id = $1 AND is_viewed = false RETURNING id',
      [req.user.userId]
    );

    res.json({
      message: 'All alerts marked as viewed',
      count: result.rows.length
    });

  } catch (error) {
    console.error('Mark all viewed error:', error);
    res.status(500).json({ error: 'Failed to mark all alerts as viewed' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/price-alerts/acknowledge-all
 * Mark all price alerts as acknowledged
 */
router.post('/acknowledge-all', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'UPDATE price_change_alerts SET is_acknowledged = true, is_viewed = true WHERE user_id = $1 AND is_acknowledged = false RETURNING id',
      [req.user.userId]
    );

    res.json({
      message: 'All alerts acknowledged',
      count: result.rows.length
    });

  } catch (error) {
    console.error('Acknowledge all error:', error);
    res.status(500).json({ error: 'Failed to acknowledge all alerts' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/price-alerts/:id
 * Delete a price alert
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM price_change_alerts WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Price alert not found' });
    }

    res.json({
      message: 'Alert deleted successfully'
    });

  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/price-alerts/history/:itemId/:supplierId
 * Get price change history for a specific item-supplier combination
 */
router.get('/history/:itemId/:supplierId', [
  param('itemId').isUUID().withMessage('Valid item ID is required'),
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { itemId, supplierId } = req.params;

    const result = await client.query(`
      SELECT
        id,
        old_price_excl_gst as "oldPriceExclGst",
        new_price_excl_gst as "newPriceExclGst",
        price_difference as "priceDifference",
        percentage_change as "percentageChange",
        created_at as "createdAt"
      FROM price_change_alerts
      WHERE item_id = $1 AND supplier_id = $2 AND user_id = $3
      ORDER BY created_at DESC
      LIMIT 50
    `, [itemId, supplierId, req.user.userId]);

    // Build price timeline
    const timeline = result.rows.map((alert, index) => ({
      date: alert.createdAt,
      price: alert.newPriceExclGst,
      change: alert.priceDifference,
      percentageChange: alert.percentageChange
    }));

    // Add the oldest price as starting point
    if (result.rows.length > 0) {
      timeline.push({
        date: result.rows[result.rows.length - 1].createdAt,
        price: result.rows[result.rows.length - 1].oldPriceExclGst,
        change: 0,
        percentageChange: 0
      });
    }

    res.json({
      itemId,
      supplierId,
      alerts: result.rows,
      timeline: timeline.reverse(), // Oldest to newest
      summary: {
        totalChanges: result.rows.length,
        lowestPrice: result.rows.length > 0
          ? Math.min(...result.rows.map(a => parseFloat(a.newPriceExclGst)))
          : null,
        highestPrice: result.rows.length > 0
          ? Math.max(...result.rows.map(a => parseFloat(a.newPriceExclGst)))
          : null,
        currentPrice: result.rows.length > 0
          ? parseFloat(result.rows[0].newPriceExclGst)
          : null
      }
    });

  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  } finally {
    client.release();
  }
});

export default router;
