import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All van stock routes require authentication
router.use(authenticateToken);

// ============ Service Vans ============

// Get all vans (sourced from vehicle assets filtered to type = Van)
router.get('/vans', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.vehicle_type,
        a.registration_number AS registration,
        a.manufacturer AS make,
        a.model,
        a.year,
        a.assigned_to AS assigned_to_id,
        a.assigned_to_name,
        a.notes,
        a.status,
        a.created_at,
        a.updated_at,
        CASE WHEN a.status = 'active' THEN 1 ELSE 0 END AS is_active,
        u.email AS assigned_to_email,
        u.full_name AS assigned_to_full_name,
        (SELECT COUNT(*) FROM van_stock vs WHERE vs.van_id = a.id) AS total_items,
        (SELECT COUNT(*) FROM van_stock vs WHERE vs.van_id = a.id AND vs.quantity <= vs.min_quantity) AS low_stock_items
      FROM assets a
      LEFT JOIN users u ON u.id::text = a.assigned_to
      WHERE a.user_id = $1
        AND a.asset_type = 'vehicle'
        AND a.vehicle_type = 'Van'
      ORDER BY a.name
    `, [userId]);

    res.json({ vans: result.rows });
  } catch (error) {
    console.error('Error fetching vans:', error);
    res.status(500).json({ error: 'Failed to fetch vans' });
  }
});

// Get single van with stock (sourced from vehicle assets)
router.get('/vans/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const vanResult = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.vehicle_type,
        a.registration_number AS registration,
        a.manufacturer AS make,
        a.model,
        a.year,
        a.assigned_to AS assigned_to_id,
        a.assigned_to_name,
        a.notes,
        a.status,
        a.created_at,
        a.updated_at,
        CASE WHEN a.status = 'active' THEN 1 ELSE 0 END AS is_active,
        u.email AS assigned_to_email,
        u.full_name AS assigned_to_full_name
      FROM assets a
      LEFT JOIN users u ON u.id::text = a.assigned_to
      WHERE a.id = $1 AND a.user_id = $2
        AND a.asset_type = 'vehicle'
        AND a.vehicle_type = 'Van'
    `, [id, userId]);

    if (vanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Van not found' });
    }

    // Get stock levels
    const stockResult = await pool.query(`
      SELECT
        vs.*,
        i.name as item_name,
        i.sku,
        i.category,
        NULL::text as unit,
        i.price
      FROM van_stock vs
      JOIN inventory_items i ON vs.item_id = i.id
      WHERE vs.van_id = $1
      ORDER BY i.category, i.name
    `, [id]);

    res.json({
      van: vanResult.rows[0],
      stock: stockResult.rows
    });
  } catch (error) {
    console.error('Error fetching van:', error);
    res.status(500).json({ error: 'Failed to fetch van' });
  }
});

// ============ Van Stock ============

// Get low stock items across all vans
router.get('/low-stock', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT
        vs.*,
        v.name as van_name,
        v.assigned_to_name,
        i.name as item_name,
        i.sku,
        i.category
      FROM van_stock vs
      JOIN assets v ON vs.van_id = v.id AND v.asset_type = 'vehicle' AND v.vehicle_type = 'Van'
      JOIN inventory_items i ON vs.item_id = i.id
      WHERE vs.user_id = $1
        AND vs.quantity <= vs.min_quantity
        AND v.status = 'active'
      ORDER BY vs.quantity - vs.min_quantity, v.name, i.name
    `, [userId]);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Update van stock (single item)
router.post('/vans/:vanId/stock', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { vanId } = req.params;
    const {
      itemId,
      quantity,
      minQuantity,
      maxQuantity,
      binLocation,
      movementType = 'adjustment',
      notes,
      jobId,
      lat,
      lng
    } = req.body;

    await client.query('BEGIN');

    // Check van ownership
    const vanCheck = await client.query(
      'SELECT id FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = \'vehicle\' AND vehicle_type = \'Van\'',
      [vanId, userId]
    );
    if (vanCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Van not found' });
    }

    // Get current stock level
    const currentStock = await client.query(`
      SELECT quantity FROM van_stock WHERE van_id = $1 AND item_id = $2
    `, [vanId, itemId]);

    const quantityBefore = currentStock.rows.length > 0 ? currentStock.rows[0].quantity : 0;
    const quantityChange = quantity - quantityBefore;

    // Upsert stock level
    const stockResult = await client.query(`
      INSERT INTO van_stock (user_id, van_id, item_id, quantity, min_quantity, max_quantity, bin_location)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (van_id, item_id)
      DO UPDATE SET
        quantity = $4,
        min_quantity = COALESCE($5, van_stock.min_quantity),
        max_quantity = COALESCE($6, van_stock.max_quantity),
        bin_location = COALESCE($7, van_stock.bin_location),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, vanId, itemId, quantity, minQuantity, maxQuantity, binLocation]);

    // Get performer name
    const performer = await client.query(
      'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
      [userId]
    );

    // Record movement if quantity changed
    if (quantityChange !== 0) {
      await client.query(`
        INSERT INTO van_stock_movements (
          user_id, van_id, item_id, movement_type,
          quantity, quantity_before, quantity_after,
          job_id, performed_by_id, performed_by_name, notes, lat, lng
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        userId, vanId, itemId, movementType,
        Math.abs(quantityChange), quantityBefore, quantity,
        jobId, userId, performer.rows[0]?.name, notes, lat, lng
      ]);
    }

    await client.query('COMMIT');

    res.json(stockResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating van stock:', error);
    res.status(500).json({ error: 'Failed to update van stock' });
  } finally {
    client.release();
  }
});

// Bulk stock update for van
router.post('/vans/:vanId/stock/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { vanId } = req.params;
    const { items, movementType = 'restock', notes, lat, lng } = req.body;

    await client.query('BEGIN');

    // Check van ownership
    const vanCheck = await client.query(
      'SELECT id FROM assets WHERE id = $1 AND user_id = $2 AND asset_type = \'vehicle\' AND vehicle_type = \'Van\'',
      [vanId, userId]
    );
    if (vanCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Van not found' });
    }

    // Get performer name
    const performer = await client.query(
      'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
      [userId]
    );

    const results = [];

    for (const item of items) {
      // Get current stock level
      const currentStock = await client.query(`
        SELECT quantity FROM van_stock WHERE van_id = $1 AND item_id = $2
      `, [vanId, item.itemId]);

      const quantityBefore = currentStock.rows.length > 0 ? currentStock.rows[0].quantity : 0;
      const newQuantity = item.quantity;
      const quantityChange = newQuantity - quantityBefore;

      // Upsert stock level
      const stockResult = await client.query(`
        INSERT INTO van_stock (user_id, van_id, item_id, quantity, min_quantity, max_quantity)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (van_id, item_id)
        DO UPDATE SET
          quantity = $4,
          min_quantity = COALESCE($5, van_stock.min_quantity),
          max_quantity = COALESCE($6, van_stock.max_quantity),
          last_restocked_at = CASE WHEN $7 = 'restock' THEN CURRENT_TIMESTAMP ELSE van_stock.last_restocked_at END,
          restocked_by_id = CASE WHEN $7 = 'restock' THEN $8 ELSE van_stock.restocked_by_id END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [userId, vanId, item.itemId, newQuantity, item.minQuantity, item.maxQuantity, movementType, userId]);

      results.push(stockResult.rows[0]);

      // Record movement if quantity changed
      if (quantityChange !== 0) {
        await client.query(`
          INSERT INTO van_stock_movements (
            user_id, van_id, item_id, movement_type,
            quantity, quantity_before, quantity_after,
            performed_by_id, performed_by_name, notes, lat, lng
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          userId, vanId, item.itemId, movementType,
          Math.abs(quantityChange), quantityBefore, newQuantity,
          userId, performer.rows[0]?.name, notes, lat, lng
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({ updated: results.length, items: results });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk updating van stock:', error);
    res.status(500).json({ error: 'Failed to update van stock' });
  } finally {
    client.release();
  }
});

// Use item from van (for jobs)
router.post('/vans/:vanId/use', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { vanId } = req.params;
    const { itemId, quantity, jobId, notes, lat, lng } = req.body;

    await client.query('BEGIN');

    // Get current stock
    const currentStock = await client.query(`
      SELECT vs.quantity, i.name as item_name
      FROM van_stock vs
      JOIN inventory_items i ON vs.item_id = i.id
      WHERE vs.van_id = $1 AND vs.item_id = $2 AND vs.user_id = $3
    `, [vanId, itemId, userId]);

    if (currentStock.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found in van' });
    }

    const quantityBefore = currentStock.rows[0].quantity;
    if (quantityBefore < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient stock. Only ${quantityBefore} available`,
        available: quantityBefore
      });
    }

    const newQuantity = quantityBefore - quantity;

    // Update stock
    await client.query(`
      UPDATE van_stock
      SET quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE van_id = $2 AND item_id = $3
    `, [newQuantity, vanId, itemId]);

    // Get performer name
    const performer = await client.query(
      'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
      [userId]
    );

    // Record movement
    await client.query(`
      INSERT INTO van_stock_movements (
        user_id, van_id, item_id, movement_type,
        quantity, quantity_before, quantity_after,
        job_id, performed_by_id, performed_by_name, notes, lat, lng
      )
      VALUES ($1, $2, $3, 'job_usage', $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      userId, vanId, itemId, quantity, quantityBefore, newQuantity,
      jobId, userId, performer.rows[0]?.name, notes, lat, lng
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      itemName: currentStock.rows[0].item_name,
      quantityUsed: quantity,
      quantityRemaining: newQuantity
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error using van stock:', error);
    res.status(500).json({ error: 'Failed to use van stock' });
  } finally {
    client.release();
  }
});

// ============ Restock Requests ============

// Get restock requests
router.get('/restock-requests', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, vanId } = req.query;

    let query = `
      SELECT
        r.*,
        v.name as van_name,
        v.assigned_to_name,
        (SELECT COUNT(*) FROM van_restock_items ri WHERE ri.request_id = r.id) as item_count,
        (SELECT SUM(ri.quantity_requested) FROM van_restock_items ri WHERE ri.request_id = r.id) as total_items
      FROM van_restock_requests r
      JOIN assets v ON r.van_id = v.id AND v.asset_type = 'vehicle' AND v.vehicle_type = 'Van'
      WHERE r.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }
    if (vanId) {
      query += ` AND r.van_id = $${paramIndex++}`;
      params.push(vanId);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching restock requests:', error);
    res.status(500).json({ error: 'Failed to fetch restock requests' });
  }
});

// Get single restock request with items
router.get('/restock-requests/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const requestResult = await pool.query(`
      SELECT
        r.*,
        v.name as van_name,
        v.assigned_to_name
      FROM van_restock_requests r
      JOIN assets v ON r.van_id = v.id AND v.asset_type = 'vehicle' AND v.vehicle_type = 'Van'
      WHERE r.id = $1 AND r.user_id = $2
    `, [id, userId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemsResult = await pool.query(`
      SELECT
        ri.*,
        i.name as item_name,
        i.sku,
        i.category,
        vs.quantity as current_van_quantity,
        vs.min_quantity,
        vs.max_quantity
      FROM van_restock_items ri
      JOIN inventory_items i ON ri.item_id = i.id
      LEFT JOIN van_stock vs ON vs.item_id = ri.item_id AND vs.van_id = $2
      WHERE ri.request_id = $1
    `, [id, requestResult.rows[0].van_id]);

    res.json({
      request: requestResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching restock request:', error);
    res.status(500).json({ error: 'Failed to fetch restock request' });
  }
});

// Create restock request
router.post('/restock-requests', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { vanId, items, priority = 'normal', notes, pickupLocation, pickupTime } = req.body;

    await client.query('BEGIN');

    // Get requester name
    const performer = await client.query(
      'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
      [userId]
    );

    // Create request
    const requestResult = await client.query(`
      INSERT INTO van_restock_requests (
        user_id, van_id, requested_by_id, requested_by_name,
        priority, notes, pickup_location, pickup_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, vanId, userId, performer.rows[0]?.name, priority, notes, pickupLocation, pickupTime]);

    const requestId = requestResult.rows[0].id;

    // Add items
    for (const item of items) {
      await client.query(`
        INSERT INTO van_restock_items (request_id, item_id, quantity_requested, notes)
        VALUES ($1, $2, $3, $4)
      `, [requestId, item.itemId, item.quantity, item.notes]);
    }

    await client.query('COMMIT');

    res.status(201).json(requestResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating restock request:', error);
    res.status(500).json({ error: 'Failed to create restock request' });
  } finally {
    client.release();
  }
});

// Update restock request status
router.put('/restock-requests/:id/status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { status, approvedItems } = req.body;

    let updateQuery = `
      UPDATE van_restock_requests
      SET status = $3
    `;
    const params = [id, userId, status];
    let paramIndex = 4;

    if (status === 'approved') {
      updateQuery += `, approved_by_id = $${paramIndex++}, approved_at = CURRENT_TIMESTAMP`;
      params.push(userId);
    } else if (status === 'processing') {
      updateQuery += `, processed_by_id = $${paramIndex++}, processed_at = CURRENT_TIMESTAMP`;
      params.push(userId);
    } else if (status === 'completed') {
      updateQuery += `, completed_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $1 AND user_id = $2 RETURNING *`;

    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Update approved quantities if provided
    if (approvedItems && status === 'approved') {
      for (const item of approvedItems) {
        await pool.query(`
          UPDATE van_restock_items
          SET quantity_approved = $1
          WHERE request_id = $2 AND item_id = $3
        `, [item.quantityApproved, id, item.itemId]);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating restock request:', error);
    res.status(500).json({ error: 'Failed to update restock request' });
  }
});

// ============ Stock Check-ins ============

// Start a stock check-in
router.post('/vans/:vanId/checkin', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { vanId } = req.params;
    const { checkinType = 'daily', lat, lng } = req.body;

    await client.query('BEGIN');

    // Get performer name
    const performer = await client.query(
      'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
      [userId]
    );

    // Create check-in
    const checkinResult = await client.query(`
      INSERT INTO van_stock_checkins (
        user_id, van_id, checkin_type,
        performed_by_id, performed_by_name, lat, lng
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, vanId, checkinType, userId, performer.rows[0]?.name, lat, lng]);

    const checkinId = checkinResult.rows[0].id;

    // Pre-populate with current stock items
    await client.query(`
      INSERT INTO van_stock_checkin_items (checkin_id, item_id, expected_quantity)
      SELECT $1, item_id, quantity
      FROM van_stock
      WHERE van_id = $2
    `, [checkinId, vanId]);

    // Get items to count
    const itemsResult = await client.query(`
      SELECT
        ci.*,
        i.name as item_name,
        i.sku,
        i.category,
        vs.bin_location
      FROM van_stock_checkin_items ci
      JOIN inventory_items i ON ci.item_id = i.id
      LEFT JOIN van_stock vs ON vs.item_id = ci.item_id AND vs.van_id = $2
      WHERE ci.checkin_id = $1
      ORDER BY i.category, i.name
    `, [checkinId, vanId]);

    await client.query('COMMIT');

    res.status(201).json({
      checkin: checkinResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating stock check-in:', error);
    res.status(500).json({ error: 'Failed to create stock check-in' });
  } finally {
    client.release();
  }
});

// Update check-in item count
router.put('/checkins/:checkinId/items/:itemId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { checkinId, itemId } = req.params;
    const { countedQuantity, discrepancyReason } = req.body;

    const result = await pool.query(`
      UPDATE van_stock_checkin_items
      SET counted_quantity = $1, discrepancy_reason = $2
      WHERE checkin_id = $3 AND item_id = $4
      AND checkin_id IN (SELECT id FROM van_stock_checkins WHERE user_id = $5)
      RETURNING *
    `, [countedQuantity, discrepancyReason, checkinId, itemId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating check-in item:', error);
    res.status(500).json({ error: 'Failed to update check-in item' });
  }
});

// Complete check-in
router.post('/checkins/:checkinId/complete', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { checkinId } = req.params;
    const { applyAdjustments = false, notes } = req.body;

    await client.query('BEGIN');

    // Get check-in details
    const checkinResult = await client.query(`
      SELECT c.*, v.id as van_id
      FROM van_stock_checkins c
      JOIN assets v ON c.van_id = v.id AND v.asset_type = 'vehicle' AND v.vehicle_type = 'Van'
      WHERE c.id = $1 AND c.user_id = $2
    `, [checkinId, userId]);

    if (checkinResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Check-in not found' });
    }

    const vanId = checkinResult.rows[0].van_id;

    // Count items and discrepancies
    const countResult = await client.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE discrepancy != 0) as discrepancies
      FROM van_stock_checkin_items
      WHERE checkin_id = $1 AND counted_quantity IS NOT NULL
    `, [checkinId]);

    const totalItems = parseInt(countResult.rows[0].total_items);
    const discrepancies = parseInt(countResult.rows[0].discrepancies);

    // Apply adjustments if requested
    if (applyAdjustments && discrepancies > 0) {
      const discrepantItems = await client.query(`
        SELECT item_id, counted_quantity, expected_quantity, discrepancy
        FROM van_stock_checkin_items
        WHERE checkin_id = $1 AND discrepancy != 0
      `, [checkinId]);

      // Get performer name
      const performer = await client.query(
        'SELECT COALESCE(full_name, email) as name FROM users WHERE id = $1',
        [userId]
      );

      for (const item of discrepantItems.rows) {
        // Update stock
        await client.query(`
          UPDATE van_stock
          SET quantity = $1, updated_at = CURRENT_TIMESTAMP
          WHERE van_id = $2 AND item_id = $3
        `, [item.counted_quantity, vanId, item.item_id]);

        // Record movement
        await client.query(`
          INSERT INTO van_stock_movements (
            user_id, van_id, item_id, movement_type,
            quantity, quantity_before, quantity_after,
            performed_by_id, performed_by_name, notes
          )
          VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7, $8, $9)
        `, [
          userId, vanId, item.item_id,
          Math.abs(item.discrepancy), item.expected_quantity, item.counted_quantity,
          userId, performer.rows[0]?.name, `Stock check-in adjustment: ${notes || ''}`
        ]);

        // Mark discrepancy as resolved
        await client.query(`
          UPDATE van_stock_checkin_items
          SET discrepancy_resolved = true
          WHERE checkin_id = $1 AND item_id = $2
        `, [checkinId, item.item_id]);
      }
    }

    // Update check-in status
    const status = discrepancies > 0 && !applyAdjustments ? 'discrepancies_pending' : 'completed';
    await client.query(`
      UPDATE van_stock_checkins
      SET status = $1, total_items_checked = $2, discrepancies_found = $3,
          completed_at = CURRENT_TIMESTAMP, notes = COALESCE($4, notes)
      WHERE id = $5
    `, [status, totalItems, discrepancies, notes, checkinId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      totalItems,
      discrepancies,
      adjustmentsApplied: applyAdjustments && discrepancies > 0,
      status
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing check-in:', error);
    res.status(500).json({ error: 'Failed to complete check-in' });
  } finally {
    client.release();
  }
});

// ============ Movement History ============

// Get movement history
router.get('/movements', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { vanId, itemId, movementType, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        m.*,
        v.name as van_name,
        i.name as item_name,
        i.sku
      FROM van_stock_movements m
      JOIN assets v ON m.van_id = v.id AND v.asset_type = 'vehicle' AND v.vehicle_type = 'Van'
      JOIN inventory_items i ON m.item_id = i.id
      WHERE m.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (vanId) {
      query += ` AND m.van_id = $${paramIndex++}`;
      params.push(vanId);
    }
    if (itemId) {
      query += ` AND m.item_id = $${paramIndex++}`;
      params.push(itemId);
    }
    if (movementType) {
      query += ` AND m.movement_type = $${paramIndex++}`;
      params.push(movementType);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({ movements: result.rows });
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: 'Failed to fetch movements' });
  }
});

export default router;
