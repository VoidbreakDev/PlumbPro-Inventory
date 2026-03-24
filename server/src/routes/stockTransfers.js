import express from 'express';
import { body, query, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Middleware to validate request
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/stock-transfers - Get all stock transfers with filtering
router.get('/', [
  query('itemId').optional().isUUID(),
  query('locationId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { itemId, locationId, startDate, endDate } = req.query;

    let whereConditions = ['sm.user_id = $1', "sm.type = 'Transfer'"];
    const values = [req.user.userId];
    let paramIndex = 2;

    if (itemId) {
      whereConditions.push(`sm.item_id = $${paramIndex++}`);
      values.push(itemId);
    }

    if (locationId) {
      whereConditions.push(`(sm.location_id = $${paramIndex} OR sm.destination_location_id = $${paramIndex})`);
      values.push(locationId);
      paramIndex++;
    }

    if (startDate) {
      const startTimestamp = new Date(startDate).getTime();
      whereConditions.push(`sm.timestamp >= $${paramIndex++}`);
      values.push(startTimestamp);
    }

    if (endDate) {
      const endTimestamp = new Date(endDate).getTime();
      whereConditions.push(`sm.timestamp <= $${paramIndex++}`);
      values.push(endTimestamp);
    }

    const result = await client.query(`
      SELECT
        sm.id,
        sm.item_id as "itemId",
        i.name as "itemName",
        sm.quantity,
        sm.timestamp,
        sm.reference as "reason",
        sm.location_id as "fromLocationId",
        l1.name as "fromLocationName",
        sm.destination_location_id as "toLocationId",
        l2.name as "toLocationName"
      FROM stock_movements sm
      JOIN inventory_items i ON sm.item_id = i.id
      LEFT JOIN locations l1 ON sm.location_id = l1.id
      LEFT JOIN locations l2 ON sm.destination_location_id = l2.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY sm.timestamp DESC
    `, values);

    // Group transfers (each transfer creates 2 movements, we want to show as 1)
    const transfers = [];
    const processedIds = new Set();

    for (const row of result.rows) {
      if (processedIds.has(row.id)) continue;

      // For transfers with positive quantity, find the corresponding negative entry
      if (row.quantity > 0) {
        transfers.push({
          id: row.id,
          itemId: row.itemId,
          itemName: row.itemName,
          fromLocationId: row.fromLocationId,
          fromLocationName: row.fromLocationName,
          toLocationId: row.toLocationId,
          toLocationName: row.toLocationName,
          quantity: row.quantity,
          reason: row.reason || '',
          timestamp: row.timestamp
        });
        processedIds.add(row.id);
      }
    }

    res.json(transfers);
  } catch (error) {
    console.error('Get stock transfers error:', error);
    res.status(500).json({ error: 'Failed to fetch stock transfers' });
  } finally {
    client.release();
  }
});

// POST /api/stock-transfers - Execute stock transfer
router.post('/', [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('fromLocationId').isUUID().withMessage('Valid source location ID is required'),
  body('toLocationId').isUUID().withMessage('Valid destination location ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('reason').optional().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { itemId, fromLocationId, toLocationId, quantity, reason } = req.body;

    // Validation: Cannot transfer to same location
    if (fromLocationId === toLocationId) {
      return res.status(400).json({ error: 'Cannot transfer to the same location' });
    }

    await client.query('BEGIN');

    // Verify item exists and belongs to user
    const itemCheck = await client.query(`
      SELECT name FROM inventory_items
      WHERE id = $1 AND user_id = $2
    `, [itemId, req.user.userId]);

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemName = itemCheck.rows[0].name;

    // Verify source location exists and belongs to user
    const sourceLocationCheck = await client.query(`
      SELECT name FROM locations
      WHERE id = $1 AND user_id = $2
    `, [fromLocationId, req.user.userId]);

    if (sourceLocationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Source location not found' });
    }

    const sourceLocationName = sourceLocationCheck.rows[0].name;

    // Verify destination location exists and belongs to user
    const destLocationCheck = await client.query(`
      SELECT name FROM locations
      WHERE id = $1 AND user_id = $2
    `, [toLocationId, req.user.userId]);

    if (destLocationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Destination location not found' });
    }

    const destLocationName = destLocationCheck.rows[0].name;

    // Check if sufficient stock at source location
    const sourceStockCheck = await client.query(`
      SELECT quantity FROM location_stock
      WHERE item_id = $1 AND location_id = $2
    `, [itemId, fromLocationId]);

    const sourceQuantity = sourceStockCheck.rows.length > 0 ? sourceStockCheck.rows[0].quantity : 0;

    if (sourceQuantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient stock at ${sourceLocationName}. Available: ${sourceQuantity}, Requested: ${quantity}`
      });
    }

    // Deduct from source location
    if (sourceQuantity === quantity) {
      // Remove the entry if depleting all stock
      await client.query(`
        DELETE FROM location_stock
        WHERE item_id = $1 AND location_id = $2
      `, [itemId, fromLocationId]);
    } else {
      // Update with remaining quantity
      await client.query(`
        UPDATE location_stock
        SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = $2 AND location_id = $3
      `, [quantity, itemId, fromLocationId]);
    }

    // Add to destination location (create or update)
    await client.query(`
      INSERT INTO location_stock (user_id, item_id, location_id, quantity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET
        quantity = location_stock.quantity + $4,
        updated_at = CURRENT_TIMESTAMP
    `, [req.user.userId, itemId, toLocationId, quantity]);

    const timestamp = Date.now();

    // Create outbound stock movement (negative quantity at source)
    const outboundMovement = await client.query(`
      INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp, location_id, destination_location_id)
      VALUES ($1, $2, 'Transfer', $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      req.user.userId,
      itemId,
      -quantity,
      reason || `Transfer to ${destLocationName}`,
      timestamp,
      fromLocationId,
      toLocationId
    ]);

    // Create inbound stock movement (positive quantity at destination)
    await client.query(`
      INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp, location_id, destination_location_id)
      VALUES ($1, $2, 'Transfer', $3, $4, $5, $6, $7)
    `, [
      req.user.userId,
      itemId,
      quantity,
      reason || `Transfer from ${sourceLocationName}`,
      timestamp,
      toLocationId,
      fromLocationId
    ]);

    // Update last_movement_date on inventory item (trigger handles this, but explicitly update for consistency)
    await client.query(`
      UPDATE inventory_items
      SET last_movement_date = to_timestamp($1::float / 1000), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [timestamp, itemId]);

    await client.query('COMMIT');

    res.status(201).json({
      id: outboundMovement.rows[0].id,
      itemId,
      itemName,
      fromLocationId,
      fromLocationName: sourceLocationName,
      toLocationId,
      toLocationName: destLocationName,
      quantity,
      reason: reason || '',
      timestamp
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create stock transfer error:', error);
    res.status(500).json({ error: 'Failed to create stock transfer' });
  } finally {
    client.release();
  }
});

export default router;
