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
        c.phone as supplier_phone
      FROM inventory_items i
      LEFT JOIN contacts c ON i.supplier_id = c.id AND c.user_id = $1
      WHERE i.user_id = $1
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
        c.company as supplier_company
      FROM inventory_items i
      LEFT JOIN contacts c ON i.supplier_id = c.id AND c.user_id = $2
      WHERE i.id = $1 AND i.user_id = $2
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
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { name, category, price, quantity, reorderLevel, supplierId, supplierCode, description } = req.body;

      const result = await client.query(`
        INSERT INTO inventory_items
          (user_id, name, category, price, quantity, reorder_level, supplier_id, supplier_code, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [req.user.userId, name, category, price, quantity, reorderLevel, supplierId || null, supplierCode || null, description || null]);

      const item = result.rows[0];

      // Log stock movement if quantity > 0
      if (quantity > 0) {
        await client.query(`
          INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.user.userId, item.id, 'In', quantity, 'Initial stock', Date.now()]);
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
        description: item.description
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
        description: item.description
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
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { quantity, reason } = req.body;

      // Update inventory
      const result = await client.query(`
        UPDATE inventory_items
        SET quantity = quantity + $1
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `, [quantity, req.params.id, req.user.userId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = result.rows[0];

      // Log movement
      await client.query(`
        INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [req.user.userId, item.id, 'Adjustment', quantity, reason, Date.now()]);

      await client.query('COMMIT');

      res.json({
        id: item.id,
        quantity: item.quantity,
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

export default router;
