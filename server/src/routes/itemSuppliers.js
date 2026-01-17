/**
 * Item Suppliers Routes
 * API endpoints for managing multiple suppliers per inventory item
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/item-suppliers/:itemId
 * Get all suppliers for a specific inventory item
 */
router.get('/:itemId', [
  param('itemId').isUUID().withMessage('Valid item ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { itemId } = req.params;

    // Verify item exists and belongs to user
    const itemCheck = await client.query(
      'SELECT id, name, supplier_count FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, req.user.userId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemCheck.rows[0];

    // Get all suppliers for this item
    const suppliersResult = await client.query(`
      SELECT
        s.id,
        s.item_id as "itemId",
        s.supplier_id as "supplierId",
        c.name as "supplierName",
        c.company as "supplierCompany",
        c.email as "supplierEmail",
        c.phone as "supplierPhone",
        c.average_rating as "supplierRating",
        c.payment_terms as "paymentTerms",
        s.supplier_code as "supplierCode",
        s.unit_price_excl_gst as "unitPriceExclGst",
        s.unit_price_incl_gst as "unitPriceInclGst",
        s.currency,
        s.lead_time_days as "leadTimeDays",
        s.minimum_order_quantity as "minimumOrderQuantity",
        s.is_preferred as "isPreferred",
        s.is_active as "isActive",
        s.has_contract as "hasContract",
        s.contract_price as "contractPrice",
        s.contract_start_date as "contractStartDate",
        s.contract_end_date as "contractEndDate",
        s.contract_notes as "contractNotes",
        s.last_ordered_date as "lastOrderedDate",
        s.last_price_update as "lastPriceUpdate",
        s.times_ordered as "timesOrdered",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        -- Check if this is the lowest price supplier
        CASE WHEN s.unit_price_excl_gst = (
          SELECT MIN(unit_price_excl_gst)
          FROM item_suppliers
          WHERE item_id = s.item_id AND is_active = true
        ) THEN true ELSE false END as "isLowestPrice",
        -- Calculate contract status
        CASE
          WHEN s.has_contract = false THEN null
          WHEN s.contract_end_date < CURRENT_DATE THEN 'expired'
          WHEN s.contract_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'active'
        END as "contractStatus"
      FROM item_suppliers s
      JOIN contacts c ON s.supplier_id = c.id
      WHERE s.item_id = $1 AND s.user_id = $2
      ORDER BY s.is_preferred DESC, s.unit_price_excl_gst ASC
    `, [itemId, req.user.userId]);

    res.json({
      item: {
        id: item.id,
        name: item.name,
        supplierCount: item.supplier_count
      },
      suppliers: suppliersResult.rows
    });

  } catch (error) {
    console.error('Get item suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch item suppliers' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/item-suppliers
 * Get all item-supplier relationships (for admin/reporting)
 */
router.get('/', [
  query('supplierId').optional().isUUID(),
  query('itemId').optional().isUUID(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId, itemId } = req.query;

    let whereConditions = ['s.user_id = $1'];
    const values = [req.user.userId];
    let paramIndex = 2;

    if (supplierId) {
      whereConditions.push(`s.supplier_id = $${paramIndex++}`);
      values.push(supplierId);
    }

    if (itemId) {
      whereConditions.push(`s.item_id = $${paramIndex++}`);
      values.push(itemId);
    }

    const result = await client.query(`
      SELECT
        s.id,
        s.item_id as "itemId",
        i.name as "itemName",
        s.supplier_id as "supplierId",
        c.name as "supplierName",
        s.supplier_code as "supplierCode",
        s.unit_price_excl_gst as "unitPriceExclGst",
        s.unit_price_incl_gst as "unitPriceInclGst",
        s.is_preferred as "isPreferred",
        s.is_active as "isActive",
        s.has_contract as "hasContract",
        s.times_ordered as "timesOrdered",
        s.last_ordered_date as "lastOrderedDate"
      FROM item_suppliers s
      JOIN inventory_items i ON s.item_id = i.id
      JOIN contacts c ON s.supplier_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY i.name, s.unit_price_excl_gst ASC
    `, values);

    res.json(result.rows);

  } catch (error) {
    console.error('Get item suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch item suppliers' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/item-suppliers
 * Add a new supplier for an item
 */
router.post('/', [
  body('itemId').isUUID().withMessage('Valid item ID is required'),
  body('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  body('supplierCode').optional().trim(),
  body('unitPriceExclGst').isFloat({ min: 0 }).withMessage('Unit price (excl GST) must be >= 0'),
  body('unitPriceInclGst').isFloat({ min: 0 }).withMessage('Unit price (incl GST) must be >= 0'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('leadTimeDays').optional().isInt({ min: 0 }).withMessage('Lead time must be >= 0'),
  body('minimumOrderQuantity').optional().isInt({ min: 1 }).withMessage('Minimum order quantity must be >= 1'),
  body('isPreferred').optional().isBoolean(),
  body('hasContract').optional().isBoolean(),
  body('contractPrice').optional().isFloat({ min: 0 }),
  body('contractStartDate').optional().isISO8601(),
  body('contractEndDate').optional().isISO8601(),
  body('contractNotes').optional().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      itemId,
      supplierId,
      supplierCode,
      unitPriceExclGst,
      unitPriceInclGst,
      currency = 'AUD',
      leadTimeDays,
      minimumOrderQuantity = 1,
      isPreferred = false,
      hasContract = false,
      contractPrice,
      contractStartDate,
      contractEndDate,
      contractNotes
    } = req.body;

    // Verify item exists and belongs to user
    const itemCheck = await client.query(
      'SELECT id FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, req.user.userId]
    );

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    // Verify supplier exists and belongs to user
    const supplierCheck = await client.query(
      "SELECT id, name FROM contacts WHERE id = $1 AND user_id = $2 AND type = 'Supplier'",
      [supplierId, req.user.userId]
    );

    if (supplierCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if relationship already exists
    const existingCheck = await client.query(
      'SELECT id FROM item_suppliers WHERE item_id = $1 AND supplier_id = $2',
      [itemId, supplierId]
    );

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This supplier is already associated with this item' });
    }

    // If setting as preferred, unset other preferred suppliers for this item
    if (isPreferred) {
      await client.query(
        'UPDATE item_suppliers SET is_preferred = false WHERE item_id = $1',
        [itemId]
      );
    }

    // Insert new item-supplier relationship
    const result = await client.query(`
      INSERT INTO item_suppliers (
        user_id, item_id, supplier_id, supplier_code,
        unit_price_excl_gst, unit_price_incl_gst, currency,
        lead_time_days, minimum_order_quantity, is_preferred,
        has_contract, contract_price, contract_start_date,
        contract_end_date, contract_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      req.user.userId,
      itemId,
      supplierId,
      supplierCode || null,
      unitPriceExclGst,
      unitPriceInclGst,
      currency,
      leadTimeDays || null,
      minimumOrderQuantity,
      isPreferred,
      hasContract,
      contractPrice || null,
      contractStartDate || null,
      contractEndDate || null,
      contractNotes || null
    ]);

    await client.query('COMMIT');

    // Fetch complete data with supplier info
    const completeResult = await client.query(`
      SELECT
        s.*,
        c.name as "supplierName",
        c.average_rating as "supplierRating"
      FROM item_suppliers s
      JOIN contacts c ON s.supplier_id = c.id
      WHERE s.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(completeResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create item supplier error:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'This supplier is already associated with this item' });
    }

    res.status(500).json({ error: 'Failed to add supplier to item' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/item-suppliers/:id
 * Update an item-supplier relationship
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid ID is required'),
  body('supplierCode').optional().trim(),
  body('unitPriceExclGst').optional().isFloat({ min: 0 }),
  body('unitPriceInclGst').optional().isFloat({ min: 0 }),
  body('leadTimeDays').optional().isInt({ min: 0 }),
  body('minimumOrderQuantity').optional().isInt({ min: 1 }),
  body('isPreferred').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('hasContract').optional().isBoolean(),
  body('contractPrice').optional().isFloat({ min: 0 }),
  body('contractStartDate').optional().isISO8601(),
  body('contractEndDate').optional().isISO8601(),
  body('contractNotes').optional().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic update query
    const allowedFields = {
      supplierCode: 'supplier_code',
      unitPriceExclGst: 'unit_price_excl_gst',
      unitPriceInclGst: 'unit_price_incl_gst',
      leadTimeDays: 'lead_time_days',
      minimumOrderQuantity: 'minimum_order_quantity',
      isPreferred: 'is_preferred',
      isActive: 'is_active',
      hasContract: 'has_contract',
      contractPrice: 'contract_price',
      contractStartDate: 'contract_start_date',
      contractEndDate: 'contract_end_date',
      contractNotes: 'contract_notes'
    };

    Object.keys(req.body).forEach(key => {
      if (allowedFields[key]) {
        updates.push(`${allowedFields[key]} = $${paramIndex}`);
        values.push(req.body[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Get item_id first for preferred supplier logic
    const itemCheck = await client.query(
      'SELECT item_id FROM item_suppliers WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item supplier relationship not found' });
    }

    const itemId = itemCheck.rows[0].item_id;

    // If setting as preferred, unset other preferred suppliers
    if (req.body.isPreferred === true) {
      await client.query(
        'UPDATE item_suppliers SET is_preferred = false WHERE item_id = $1 AND id != $2',
        [itemId, id]
      );
    }

    // Update the relationship
    values.push(id);
    values.push(req.user.userId);

    const result = await client.query(`
      UPDATE item_suppliers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item supplier relationship not found' });
    }

    await client.query('COMMIT');

    // Fetch complete data with supplier info
    const completeResult = await client.query(`
      SELECT
        s.*,
        c.name as "supplierName",
        c.average_rating as "supplierRating"
      FROM item_suppliers s
      JOIN contacts c ON s.supplier_id = c.id
      WHERE s.id = $1
    `, [result.rows[0].id]);

    res.json(completeResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update item supplier error:', error);
    res.status(500).json({ error: 'Failed to update item supplier' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/item-suppliers/:id
 * Remove a supplier from an item
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM item_suppliers WHERE id = $1 AND user_id = $2 RETURNING item_id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item supplier relationship not found' });
    }

    res.json({
      message: 'Supplier removed from item successfully',
      itemId: result.rows[0].item_id
    });

  } catch (error) {
    console.error('Delete item supplier error:', error);
    res.status(500).json({ error: 'Failed to remove supplier from item' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/item-suppliers/:id/set-preferred
 * Set a supplier as the preferred supplier for an item
 */
router.post('/:id/set-preferred', [
  param('id').isUUID().withMessage('Valid ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get item_id
    const itemCheck = await client.query(
      'SELECT item_id FROM item_suppliers WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (itemCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item supplier relationship not found' });
    }

    const itemId = itemCheck.rows[0].item_id;

    // Unset all preferred for this item
    await client.query(
      'UPDATE item_suppliers SET is_preferred = false WHERE item_id = $1',
      [itemId]
    );

    // Set this one as preferred
    const result = await client.query(
      'UPDATE item_suppliers SET is_preferred = true WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Preferred supplier updated',
      itemSupplier: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Set preferred supplier error:', error);
    res.status(500).json({ error: 'Failed to set preferred supplier' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/item-suppliers/:id/record-order
 * Record that an order was placed with this supplier
 */
router.post('/:id/record-order', [
  param('id').isUUID().withMessage('Valid ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(`
      UPDATE item_suppliers
      SET
        times_ordered = times_ordered + 1,
        last_ordered_date = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item supplier relationship not found' });
    }

    res.json({
      message: 'Order recorded successfully',
      itemSupplier: result.rows[0]
    });

  } catch (error) {
    console.error('Record order error:', error);
    res.status(500).json({ error: 'Failed to record order' });
  } finally {
    client.release();
  }
});

export default router;
