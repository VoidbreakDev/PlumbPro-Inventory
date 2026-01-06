import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticateToken);

// Get all templates
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        t.*,
        COALESCE(
          json_agg(
            jsonb_build_object('itemId', ti.item_id, 'quantity', ti.quantity, 'itemName', i.name)
          ) FILTER (WHERE ti.item_id IS NOT NULL),
          '[]'
        ) as items
      FROM job_templates t
      LEFT JOIN template_items ti ON t.id = ti.template_id
      LEFT JOIN inventory_items i ON ti.item_id = i.id AND i.user_id = $1
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY t.name ASC
    `, [req.user.userId]);

    const templates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      items: row.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity
      }))
    }));

    res.json(templates);

  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  } finally {
    client.release();
  }
});

// Create template
router.post('/',
  [
    body('name').notEmpty().trim(),
    body('items').isArray(),
    body('items.*.itemId').isUUID(),
    body('items.*.quantity').isInt({ min: 1 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { name, items } = req.body;

      const templateResult = await client.query(
        'INSERT INTO job_templates (user_id, name) VALUES ($1, $2) RETURNING *',
        [req.user.userId, name]
      );

      const template = templateResult.rows[0];

      // Add items
      for (const item of items) {
        await client.query(
          'INSERT INTO template_items (template_id, item_id, quantity) VALUES ($1, $2, $3)',
          [template.id, item.itemId, item.quantity]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: template.id,
        name: template.name,
        items
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    } finally {
      client.release();
    }
  }
);

// Update template
router.put('/:id',
  [
    body('name').optional().notEmpty().trim(),
    body('items').optional().isArray(),
    body('items.*.itemId').optional().isUUID(),
    body('items.*.quantity').optional().isInt({ min: 1 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { name, items } = req.body;

      if (name) {
        await client.query(
          'UPDATE job_templates SET name = $1 WHERE id = $2 AND user_id = $3',
          [name, req.params.id, req.user.userId]
        );
      }

      if (items) {
        // Delete existing items
        await client.query(
          `DELETE FROM template_items ti
           USING job_templates t
           WHERE ti.template_id = t.id AND t.id = $1 AND t.user_id = $2`,
          [req.params.id, req.user.userId]
        );

        // Add new items
        for (const item of items) {
          await client.query(
            'INSERT INTO template_items (template_id, item_id, quantity) VALUES ($1, $2, $3)',
            [req.params.id, item.itemId, item.quantity]
          );
        }
      }

      await client.query('COMMIT');

      res.json({ message: 'Template updated successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    } finally {
      client.release();
    }
  }
);

// Delete template
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM job_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });

  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  } finally {
    client.release();
  }
});

export default router;
