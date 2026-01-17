import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticateToken);

// Get all inventory items for user
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        i.*,
        c.name as supplier_name,
        c.email as supplier_email,
        c.phone as supplier_phone,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'locationId', ls.location_id,
              'locationName', l.name,
              'quantity', ls.quantity
            )
          ) FILTER (WHERE ls.location_id IS NOT NULL),
          '[]'
        ) as location_stock
      FROM inventory_items i
      LEFT JOIN contacts c ON i.supplier_id = c.id AND c.user_id = $1
      LEFT JOIN location_stock ls ON i.id = ls.item_id
      LEFT JOIN locations l ON ls.location_id = l.id
      WHERE i.user_id = $1
      GROUP BY i.id, c.name, c.email, c.phone
      ORDER BY i.created_at DESC
    `, [req.user.userId]);

    const items = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: parseFloat(row.price),
      quantity: row.quantity,
      reorderLevel: row.reorder_level,
      supplierId: row.supplier_id,
      supplierCode: row.supplier_code,
      description: row.description,
      buyPriceExclGST: row.buy_price_excl_gst ? parseFloat(row.buy_price_excl_gst) : undefined,
      buyPriceInclGST: row.buy_price_incl_gst ? parseFloat(row.buy_price_incl_gst) : undefined,
      sellPriceExclGST: row.sell_price_excl_gst ? parseFloat(row.sell_price_excl_gst) : undefined,
      sellPriceInclGST: row.sell_price_incl_gst ? parseFloat(row.sell_price_incl_gst) : undefined,
      locationStock: row.location_stock || [],
      abcClassification: row.abc_classification || undefined,
      isDeadStock: row.is_dead_stock || false,
      lastMovementDate: row.last_movement_date || undefined,
      supplier: row.supplier_id ? {
        name: row.supplier_name,
        email: row.supplier_email,
        phone: row.supplier_phone
      } : null
    }));

    res.json(items);

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  } finally {
    client.release();
  }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        i.*,
        c.name as supplier_name,
        c.email as supplier_email,
        c.phone as supplier_phone,
        c.company as supplier_company,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'locationId', ls.location_id,
              'locationName', l.name,
              'quantity', ls.quantity
            )
          ) FILTER (WHERE ls.location_id IS NOT NULL),
          '[]'
        ) as location_stock
      FROM inventory_items i
      LEFT JOIN contacts c ON i.supplier_id = c.id AND c.user_id = $2
      LEFT JOIN location_stock ls ON i.id = ls.item_id
      LEFT JOIN locations l ON ls.location_id = l.id
      WHERE i.id = $1 AND i.user_id = $2
      GROUP BY i.id, c.name, c.email, c.phone, c.company
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      category: row.category,
      price: parseFloat(row.price),
      quantity: row.quantity,
      reorderLevel: row.reorder_level,
      supplierId: row.supplier_id,
      supplierCode: row.supplier_code,
      description: row.description,
      buyPriceExclGST: row.buy_price_excl_gst ? parseFloat(row.buy_price_excl_gst) : undefined,
      buyPriceInclGST: row.buy_price_incl_gst ? parseFloat(row.buy_price_incl_gst) : undefined,
      sellPriceExclGST: row.sell_price_excl_gst ? parseFloat(row.sell_price_excl_gst) : undefined,
      sellPriceInclGST: row.sell_price_incl_gst ? parseFloat(row.sell_price_incl_gst) : undefined,
      locationStock: row.location_stock || [],
      abcClassification: row.abc_classification || undefined,
      isDeadStock: row.is_dead_stock || false,
      lastMovementDate: row.last_movement_date || undefined,
      supplier: row.supplier_id ? {
        name: row.supplier_name,
        email: row.supplier_email,
        phone: row.supplier_phone,
        company: row.supplier_company
      } : null
    });

  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  } finally {
    client.release();
  }
});

// Create inventory item
router.post('/',
  [
    body('name').notEmpty().trim(),
    body('category').notEmpty().trim(),
    body('price').isFloat({ min: 0 }),
    body('quantity').isInt({ min: 0 }),
    body('reorderLevel').isInt({ min: 0 }),
    body('supplierId').optional().isUUID(),
    body('supplierCode').optional().trim(),
    body('description').optional().trim(),
    body('buyPriceExclGST').optional().isFloat({ min: 0 }),
    body('buyPriceInclGST').optional().isFloat({ min: 0 }),
    body('sellPriceExclGST').optional().isFloat({ min: 0 }),
    body('sellPriceInclGST').optional().isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { name, category, price, quantity, reorderLevel, supplierId, supplierCode, description, buyPriceExclGST, buyPriceInclGST, sellPriceExclGST, sellPriceInclGST } = req.body;

      // Debug: Log pricing data
      console.log('Creating item with pricing:', {
        name,
        buyPriceExclGST,
        buyPriceInclGST,
        sellPriceExclGST,
        sellPriceInclGST
      });

      const result = await client.query(`
        INSERT INTO inventory_items
          (user_id, name, category, price, quantity, reorder_level, supplier_id, supplier_code, description, buy_price_excl_gst, buy_price_incl_gst, sell_price_excl_gst, sell_price_incl_gst)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [req.user.userId, name, category, price, quantity, reorderLevel, supplierId || null, supplierCode || null, description || null, buyPriceExclGST || null, buyPriceInclGST || null, sellPriceExclGST || null, sellPriceInclGST || null]);

      const item = result.rows[0];

      // Create location_stock entry and log stock movement if quantity > 0
      if (quantity > 0) {
        // Get default location for user
        const defaultLocation = await client.query(`
          SELECT id FROM locations
          WHERE user_id = $1 AND is_default = true
          LIMIT 1
        `, [req.user.userId]);

        if (defaultLocation.rows.length > 0) {
          const locationId = defaultLocation.rows[0].id;

          // Create location_stock entry
          await client.query(`
            INSERT INTO location_stock (user_id, item_id, location_id, quantity)
            VALUES ($1, $2, $3, $4)
          `, [req.user.userId, item.id, locationId, quantity]);

          // Log stock movement with location
          await client.query(`
            INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp, location_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [req.user.userId, item.id, 'In', quantity, 'Initial stock', Date.now(), locationId]);
        } else {
          // Fallback: log movement without location (shouldn't happen after migration)
          await client.query(`
            INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [req.user.userId, item.id, 'In', quantity, 'Initial stock', Date.now()]);
        }
      }

      res.status(201).json({
        id: item.id,
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        quantity: item.quantity,
        reorderLevel: item.reorder_level,
        supplierId: item.supplier_id,
        supplierCode: item.supplier_code,
        description: item.description,
        buyPriceExclGST: item.buy_price_excl_gst ? parseFloat(item.buy_price_excl_gst) : undefined,
        buyPriceInclGST: item.buy_price_incl_gst ? parseFloat(item.buy_price_incl_gst) : undefined,
        sellPriceExclGST: item.sell_price_excl_gst ? parseFloat(item.sell_price_excl_gst) : undefined,
        sellPriceInclGST: item.sell_price_incl_gst ? parseFloat(item.sell_price_incl_gst) : undefined
      });

    } catch (error) {
      console.error('Create item error:', error);
      res.status(500).json({ error: 'Failed to create item' });
    } finally {
      client.release();
    }
  }
);

// Update inventory item
router.put('/:id',
  [
    body('name').optional().notEmpty().trim(),
    body('category').optional().notEmpty().trim(),
    body('price').optional().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 0 }),
    body('reorderLevel').optional().isInt({ min: 0 }),
    body('supplierId').optional().isUUID(),
    body('supplierCode').optional().trim(),
    body('description').optional().trim(),
    body('buyPriceExclGST').optional().isFloat({ min: 0 }),
    body('buyPriceInclGST').optional().isFloat({ min: 0 }),
    body('sellPriceExclGST').optional().isFloat({ min: 0 }),
    body('sellPriceInclGST').optional().isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      Object.keys(req.body).forEach(key => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${dbKey} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const idParam = paramCount;
      const userParam = paramCount + 1;
      values.push(req.params.id);
      values.push(req.user.userId);

      const result = await client.query(`
        UPDATE inventory_items
        SET ${updates.join(', ')}
        WHERE id = $${idParam} AND user_id = $${userParam}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = result.rows[0];
      res.json({
        id: item.id,
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        quantity: item.quantity,
        reorderLevel: item.reorder_level,
        supplierId: item.supplier_id,
        supplierCode: item.supplier_code,
        description: item.description,
        buyPriceExclGST: item.buy_price_excl_gst ? parseFloat(item.buy_price_excl_gst) : undefined,
        buyPriceInclGST: item.buy_price_incl_gst ? parseFloat(item.buy_price_incl_gst) : undefined,
        sellPriceExclGST: item.sell_price_excl_gst ? parseFloat(item.sell_price_excl_gst) : undefined,
        sellPriceInclGST: item.sell_price_incl_gst ? parseFloat(item.sell_price_incl_gst) : undefined
      });

    } catch (error) {
      console.error('Update item error:', error);
      res.status(500).json({ error: 'Failed to update item' });
    } finally {
      client.release();
    }
  }
);

// Adjust stock (manual adjustment)
router.post('/:id/adjust',
  [
    body('quantity').isInt(),
    body('reason').notEmpty().trim(),
    body('locationId').optional().isUUID(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { quantity, reason, locationId } = req.body;

      // Verify item exists
      const itemCheck = await client.query(`
        SELECT id, name FROM inventory_items
        WHERE id = $1 AND user_id = $2
      `, [req.params.id, req.user.userId]);

      if (itemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = itemCheck.rows[0];
      let targetLocationId = locationId;

      // If no location specified, use default location
      if (!targetLocationId) {
        const defaultLocation = await client.query(`
          SELECT id FROM locations
          WHERE user_id = $1 AND is_default = true
          LIMIT 1
        `, [req.user.userId]);

        if (defaultLocation.rows.length > 0) {
          targetLocationId = defaultLocation.rows[0].id;
        }
      }

      if (targetLocationId) {
        // Verify location exists and belongs to user
        const locationCheck = await client.query(`
          SELECT id FROM locations
          WHERE id = $1 AND user_id = $2
        `, [targetLocationId, req.user.userId]);

        if (locationCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Location not found' });
        }

        // Update or create location_stock entry
        await client.query(`
          INSERT INTO location_stock (user_id, item_id, location_id, quantity)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (item_id, location_id)
          DO UPDATE SET
            quantity = location_stock.quantity + $4,
            updated_at = CURRENT_TIMESTAMP
        `, [req.user.userId, item.id, targetLocationId, quantity]);

        // Log movement with location
        await client.query(`
          INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp, location_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [req.user.userId, item.id, 'Adjustment', quantity, reason, Date.now(), targetLocationId]);
      } else {
        // Fallback: adjust total quantity without location (shouldn't happen)
        await client.query(`
          UPDATE inventory_items
          SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND user_id = $3
        `, [quantity, req.params.id, req.user.userId]);

        await client.query(`
          INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.user.userId, item.id, 'Adjustment', quantity, reason, Date.now()]);
      }

      // Get updated item with location stock
      const updatedItem = await client.query(`
        SELECT
          i.id,
          i.quantity,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'locationId', ls.location_id,
                'locationName', l.name,
                'quantity', ls.quantity
              )
            ) FILTER (WHERE ls.location_id IS NOT NULL),
            '[]'
          ) as location_stock
        FROM inventory_items i
        LEFT JOIN location_stock ls ON i.id = ls.item_id
        LEFT JOIN locations l ON ls.location_id = l.id
        WHERE i.id = $1 AND i.user_id = $2
        GROUP BY i.id
      `, [item.id, req.user.userId]);

      await client.query('COMMIT');

      res.json({
        id: updatedItem.rows[0].id,
        quantity: updatedItem.rows[0].quantity,
        locationStock: updatedItem.rows[0].location_stock || [],
        message: 'Stock adjusted successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Adjust stock error:', error);
      res.status(500).json({ error: 'Failed to adjust stock' });
    } finally {
      client.release();
    }
  }
);

// Delete inventory item
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM inventory_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  } finally {
    client.release();
  }
});

// Bulk delete all inventory items for a user
router.post('/bulk-delete/all', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM inventory_items WHERE user_id = $1 RETURNING id',
      [req.user.userId]
    );

    res.json({
      message: 'All inventory items deleted successfully',
      deletedCount: result.rows.length
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete inventory items' });
  } finally {
    client.release();
  }
});

export default router;
