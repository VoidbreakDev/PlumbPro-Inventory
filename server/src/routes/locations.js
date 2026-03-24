import express from 'express';
import { body, param, validationResult } from 'express-validator';
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

// GET /api/locations - Get all locations for user
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        name,
        is_default as "isDefault",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM locations
      WHERE user_id = $1
      ORDER BY is_default DESC, name ASC
    `, [req.user.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  } finally {
    client.release();
  }
});

// GET /api/locations/:id - Get single location
router.get('/:id', [
  param('id').isUUID()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        name,
        is_default as "isDefault",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM locations
      WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  } finally {
    client.release();
  }
});

// POST /api/locations - Create new location
router.post('/', [
  body('name').trim().notEmpty().withMessage('Location name is required'),
  body('isDefault').optional().isBoolean(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, isDefault } = req.body;

    // Check for duplicate name
    const existingLocation = await client.query(`
      SELECT id FROM locations
      WHERE user_id = $1 AND LOWER(name) = LOWER($2)
    `, [req.user.userId, name]);

    if (existingLocation.rows.length > 0) {
      return res.status(400).json({ error: 'A location with this name already exists' });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await client.query(`
        UPDATE locations
        SET is_default = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_default = true
      `, [req.user.userId]);
    }

    const result = await client.query(`
      INSERT INTO locations (user_id, name, is_default)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        is_default as "isDefault",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [req.user.userId, name, isDefault || false]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create location error:', error);
    if (error.constraint === 'unique_user_location_name') {
      res.status(400).json({ error: 'A location with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create location' });
    }
  } finally {
    client.release();
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('isDefault').optional().isBoolean(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, isDefault } = req.body;

    // Check if location exists and belongs to user
    const locationCheck = await client.query(`
      SELECT is_default FROM locations
      WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);

    if (locationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      // Check for duplicate name
      const existingLocation = await client.query(`
        SELECT id FROM locations
        WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3
      `, [req.user.userId, name, req.params.id]);

      if (existingLocation.rows.length > 0) {
        return res.status(400).json({ error: 'A location with this name already exists' });
      }

      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (isDefault !== undefined) {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await client.query(`
          UPDATE locations
          SET is_default = false, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND is_default = true AND id != $2
        `, [req.user.userId, req.params.id]);
      } else {
        // Cannot unset the only default location
        const defaultCount = await client.query(`
          SELECT COUNT(*) as count FROM locations
          WHERE user_id = $1 AND is_default = true
        `, [req.user.userId]);

        if (defaultCount.rows[0].count === '1' && locationCheck.rows[0].is_default) {
          return res.status(400).json({ error: 'Cannot remove default flag from the only default location' });
        }
      }

      updates.push(`is_default = $${paramIndex++}`);
      values.push(isDefault);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    values.push(req.user.userId);

    const result = await client.query(`
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
      RETURNING
        id,
        name,
        is_default as "isDefault",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update location error:', error);
    if (error.constraint === 'unique_user_location_name') {
      res.status(400).json({ error: 'A location with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update location' });
    }
  } finally {
    client.release();
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', [
  param('id').isUUID()
], async (req, res) => {
  const client = await pool.connect();

  try {
    // Check if location exists and belongs to user
    const locationCheck = await client.query(`
      SELECT is_default FROM locations
      WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);

    if (locationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Prevent deletion of default location
    if (locationCheck.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot delete the default location' });
    }

    // Check if location has stock
    const stockCheck = await client.query(`
      SELECT COUNT(*) as count FROM location_stock
      WHERE location_id = $1 AND quantity > 0
    `, [req.params.id]);

    if (parseInt(stockCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete location with stock. Transfer stock to another location first.'
      });
    }

    // Delete the location (cascade will handle location_stock entries with 0 quantity)
    await client.query(`
      DELETE FROM locations
      WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  } finally {
    client.release();
  }
});

// GET /api/locations/:id/stock - Get stock at specific location
router.get('/:id/stock', [
  param('id').isUUID()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        ls.id,
        ls.item_id as "itemId",
        i.name as "itemName",
        ls.quantity,
        ls.updated_at as "updatedAt"
      FROM location_stock ls
      JOIN inventory_items i ON ls.item_id = i.id
      WHERE ls.location_id = $1 AND ls.user_id = $2 AND ls.quantity > 0
      ORDER BY i.name ASC
    `, [req.params.id, req.user.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get location stock error:', error);
    res.status(500).json({ error: 'Failed to fetch location stock' });
  } finally {
    client.release();
  }
});

export default router;
