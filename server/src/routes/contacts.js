import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

// Get all contacts
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { type } = req.query;
    let query = 'SELECT * FROM contacts WHERE user_id = $1';
    const params = [req.user.userId];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }

    query += ' ORDER BY name ASC';

    const result = await client.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  } finally {
    client.release();
  }
});

// Get single contact
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  } finally {
    client.release();
  }
});

// Create contact
router.post('/',
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['Supplier', 'Plumber', 'Customer']),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('company').optional().trim(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { name, type, email, phone, company } = req.body;

      const result = await client.query(`
        INSERT INTO contacts (user_id, name, type, email, phone, company)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [req.user.userId, name, type, email || null, phone || null, company || null]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    } finally {
      client.release();
    }
  }
);

// Update contact
router.put('/:id',
  [
    body('name').optional().notEmpty().trim(),
    body('type').optional().isIn(['Supplier', 'Plumber', 'Customer']),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('company').optional().trim(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      Object.keys(req.body).forEach(key => {
        updates.push(`${key} = $${paramCount}`);
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
        UPDATE contacts
        SET ${updates.join(', ')}
        WHERE id = $${idParam} AND user_id = $${userParam}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    } finally {
      client.release();
    }
  }
);

// Delete contact
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  } finally {
    client.release();
  }
});

export default router;
