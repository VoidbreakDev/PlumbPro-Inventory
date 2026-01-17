/**
 * Purchase Orders Routes
 * API endpoints for purchase order management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/purchase-orders
 * Get all purchase orders for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, supplier_id, from_date, to_date } = req.query;

    let query = `
      SELECT po.*,
             c.name as supplier_name,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
             (SELECT COUNT(DISTINCT job_id) FROM purchase_order_jobs WHERE purchase_order_id = po.id) as job_count
      FROM purchase_orders po
      LEFT JOIN contacts c ON po.supplier_id = c.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.user_id = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND po.status = $${params.length}`;
    }

    if (supplier_id) {
      params.push(supplier_id);
      query += ` AND po.supplier_id = $${params.length}`;
    }

    if (from_date) {
      params.push(from_date);
      query += ` AND po.created_at >= $${params.length}`;
    }

    if (to_date) {
      params.push(to_date);
      query += ` AND po.created_at <= $${params.length}`;
    }

    query += ' ORDER BY po.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

/**
 * GET /api/purchase-orders/:id
 * Get a specific purchase order with items and jobs
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get PO
    const poResult = await db.query(
      `SELECT po.*,
              c.name as supplier_name,
              c.email as supplier_email,
              c.phone as supplier_phone,
              c.company as supplier_company,
              u.full_name as created_by_name
       FROM purchase_orders po
       LEFT JOIN contacts c ON po.supplier_id = c.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.id = $1 AND po.user_id = $2`,
      [id, userId]
    );

    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const po = poResult.rows[0];

    // Get items
    const itemsResult = await db.query(
      `SELECT poi.*,
              i.name as current_item_name,
              i.category as item_category
       FROM purchase_order_items poi
       LEFT JOIN inventory_items i ON poi.inventory_item_id = i.id
       WHERE poi.purchase_order_id = $1
       ORDER BY poi.created_at ASC`,
      [id]
    );

    po.items = itemsResult.rows;

    // Get linked jobs
    const jobsResult = await db.query(
      `SELECT j.id, j.title, j.status, j.date, j.builder
       FROM purchase_order_jobs poj
       JOIN jobs j ON poj.job_id = j.id
       WHERE poj.purchase_order_id = $1`,
      [id]
    );

    po.jobs = jobsResult.rows;

    // Get history
    const historyResult = await db.query(
      `SELECT poh.*, u.full_name as user_name
       FROM purchase_order_history poh
       LEFT JOIN users u ON poh.user_id = u.id
       WHERE poh.purchase_order_id = $1
       ORDER BY poh.created_at DESC`,
      [id]
    );

    po.history = historyResult.rows;

    res.json(po);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

/**
 * POST /api/purchase-orders
 * Create a new purchase order
 */
router.post('/', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const {
      supplier_id,
      items, // Array of {inventory_item_id, item_name, quantity_ordered, unit_price}
      job_ids, // Array of job IDs to link
      expected_delivery_date,
      delivery_location,
      deliver_to_job_id,
      notes,
      internal_notes,
      tax,
      shipping
    } = req.body;

    // Validate
    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Validate direct to site requires a job
    if (delivery_location === 'direct_to_site' && !deliver_to_job_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Job is required for direct to site delivery' });
    }

    // Create PO
    const poResult = await client.query(
      `INSERT INTO purchase_orders
       (user_id, supplier_id, expected_delivery_date, delivery_location, deliver_to_job_id, notes, internal_notes, tax, shipping, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        supplier_id || null,
        expected_delivery_date || null,
        delivery_location || 'warehouse',
        deliver_to_job_id || null,
        notes || null,
        internal_notes || null,
        tax || 0,
        shipping || 0,
        userId
      ]
    );

    const po = poResult.rows[0];

    // Add items
    for (const item of items) {
      const lineTotal = item.quantity_ordered * item.unit_price;

      await client.query(
        `INSERT INTO purchase_order_items
         (purchase_order_id, inventory_item_id, item_name, item_description, supplier_code,
          quantity_ordered, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          po.id,
          item.inventory_item_id || null,
          item.item_name,
          item.item_description || null,
          item.supplier_code || null,
          item.quantity_ordered,
          item.unit_price,
          lineTotal
        ]
      );
    }

    // Link jobs if provided
    if (job_ids && job_ids.length > 0) {
      for (const jobId of job_ids) {
        await client.query(
          `INSERT INTO purchase_order_jobs (purchase_order_id, job_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [po.id, jobId]
        );
      }
    }

    // Log creation
    await client.query(
      `INSERT INTO purchase_order_history (purchase_order_id, user_id, status, notes)
       VALUES ($1, $2, $3, $4)`,
      [po.id, userId, 'draft', 'Purchase order created']
    );

    await client.query('COMMIT');

    // Fetch complete PO
    const completePoResult = await client.query(
      `SELECT po.*, c.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN contacts c ON po.supplier_id = c.id
       WHERE po.id = $1`,
      [po.id]
    );

    res.status(201).json(completePoResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/purchase-orders/:id
 * Update a purchase order (only in draft status)
 */
router.put('/:id', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const {
      supplier_id,
      expected_delivery_date,
      delivery_location,
      deliver_to_job_id,
      notes,
      internal_notes,
      tax,
      shipping,
      items // If provided, completely replace items
    } = req.body;

    // Check PO exists and is editable
    const poCheck = await client.query(
      'SELECT status FROM purchase_orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (poCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (poCheck.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Can only edit draft purchase orders' });
    }

    // Validate direct to site requires a job
    if (delivery_location === 'direct_to_site' && !deliver_to_job_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Job is required for direct to site delivery' });
    }

    // Update PO
    await client.query(
      `UPDATE purchase_orders
       SET supplier_id = COALESCE($1, supplier_id),
           expected_delivery_date = COALESCE($2, expected_delivery_date),
           delivery_location = COALESCE($3, delivery_location),
           deliver_to_job_id = $4,
           notes = COALESCE($5, notes),
           internal_notes = COALESCE($6, internal_notes),
           tax = COALESCE($7, tax),
           shipping = COALESCE($8, shipping)
       WHERE id = $9`,
      [
        supplier_id,
        expected_delivery_date,
        delivery_location,
        delivery_location === 'warehouse' ? null : deliver_to_job_id,
        notes,
        internal_notes,
        tax,
        shipping,
        id
      ]
    );

    // If items provided, replace them
    if (items && items.length > 0) {
      // Delete existing items
      await client.query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [id]);

      // Add new items
      for (const item of items) {
        const lineTotal = item.quantity_ordered * item.unit_price;

        await client.query(
          `INSERT INTO purchase_order_items
           (purchase_order_id, inventory_item_id, item_name, item_description, supplier_code,
            quantity_ordered, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            item.inventory_item_id || null,
            item.item_name,
            item.item_description || null,
            item.supplier_code || null,
            item.quantity_ordered,
            item.unit_price,
            lineTotal
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated PO
    const result = await client.query(
      `SELECT po.*, c.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN contacts c ON po.supplier_id = c.id
       WHERE po.id = $1`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/purchase-orders/:id/send
 * Mark PO as sent to supplier
 */
router.post('/:id/send', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await db.query(
      `UPDATE purchase_orders
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status = 'draft'`,
      [id, userId]
    );

    res.json({ message: 'Purchase order sent' });
  } catch (error) {
    console.error('Error sending purchase order:', error);
    res.status(500).json({ error: 'Failed to send purchase order' });
  }
});

/**
 * POST /api/purchase-orders/:id/receive
 * Record receipt of items (partial or full)
 */
router.post('/:id/receive', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const { items, notes } = req.body; // items: [{po_item_id, quantity_received}]

    // Create receipt record
    const receiptResult = await client.query(
      `INSERT INTO purchase_order_receipts (purchase_order_id, received_by, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, notes || null]
    );

    const receipt = receiptResult.rows[0];

    // Record received items and update quantities
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_receipt_items (receipt_id, po_item_id, quantity_received)
         VALUES ($1, $2, $3)`,
        [receipt.id, item.po_item_id, item.quantity_received]
      );

      // Update quantity_received on PO item
      await client.query(
        `UPDATE purchase_order_items
         SET quantity_received = quantity_received + $1
         WHERE id = $2`,
        [item.quantity_received, item.po_item_id]
      );

      // TODO: Create stock movement to add items to inventory
      // This will be implemented when integrating with inventory management
    }

    // Check if PO is fully received
    const remainingResult = await client.query(
      `SELECT COUNT(*) as count
       FROM purchase_order_items
       WHERE purchase_order_id = $1
       AND quantity_received < quantity_ordered`,
      [id]
    );

    const newStatus = remainingResult.rows[0].count === '0' ? 'received' : 'partially_received';

    await client.query(
      `UPDATE purchase_orders
       SET status = $1, received_at = CASE WHEN $1 = 'received' THEN CURRENT_TIMESTAMP ELSE received_at END
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Receipt recorded', receipt_id: receipt.id, status: newStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording receipt:', error);
    res.status(500).json({ error: 'Failed to record receipt' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/purchase-orders/:id/cancel
 * Cancel a purchase order
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(
      `UPDATE purchase_orders
       SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status NOT IN ('received', 'cancelled')
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot cancel this purchase order' });
    }

    // Log cancellation
    await db.query(
      `INSERT INTO purchase_order_history (purchase_order_id, user_id, status, notes)
       VALUES ($1, $2, 'cancelled', $3)`,
      [id, userId, reason || 'Purchase order cancelled']
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
});

/**
 * DELETE /api/purchase-orders/:id
 * Delete a purchase order (only drafts)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM purchase_orders
       WHERE id = $1 AND user_id = $2 AND status = 'draft'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Can only delete draft purchase orders' });
    }

    res.json({ message: 'Purchase order deleted' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

/**
 * GET /api/purchase-orders/stats/summary
 * Get purchase order statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsResult = await db.query(
      `SELECT
         COUNT(*) as total_orders,
         COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
         COUNT(*) FILTER (WHERE status = 'sent') as sent_orders,
         COUNT(*) FILTER (WHERE status = 'received') as received_orders,
         COUNT(*) FILTER (WHERE status = 'partially_received') as partially_received_orders,
         COALESCE(SUM(total), 0) as total_value,
         COALESCE(SUM(total) FILTER (WHERE status IN ('sent', 'confirmed', 'partially_received')), 0) as pending_value,
         COALESCE(SUM(total) FILTER (WHERE status = 'received'), 0) as received_value
       FROM purchase_orders
       WHERE user_id = $1`,
      [userId]
    );

    res.json(statsResult.rows[0]);
  } catch (error) {
    console.error('Error fetching PO stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
