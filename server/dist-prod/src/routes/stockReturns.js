import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.use(authenticateToken);

// Get all stock returns
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { status, job_id } = req.query;

    let query = `
      SELECT
        sr.*,
        j.title as job_title,
        j.builder as job_builder,
        u.full_name as returned_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sri.id,
              'inventory_item_id', sri.inventory_item_id,
              'item_name', i.name,
              'quantity_allocated', sri.quantity_allocated,
              'quantity_returned', sri.quantity_returned,
              'quantity_used', sri.quantity_used,
              'condition', sri.condition,
              'notes', sri.notes
            )
          ) FILTER (WHERE sri.id IS NOT NULL),
          '[]'
        ) as items
      FROM stock_returns sr
      LEFT JOIN jobs j ON sr.job_id = j.id
      LEFT JOIN users u ON sr.returned_by = u.id
      LEFT JOIN stock_return_items sri ON sr.id = sri.stock_return_id
      LEFT JOIN inventory_items i ON sri.inventory_item_id = i.id
      WHERE sr.user_id = $1
    `;

    const params = [req.user.userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND sr.status = $${paramCount}`;
      params.push(status);
    }

    if (job_id) {
      paramCount++;
      query += ` AND sr.job_id = $${paramCount}`;
      params.push(job_id);
    }

    query += `
      GROUP BY sr.id, j.title, j.builder, u.full_name
      ORDER BY sr.returned_at DESC
    `;

    const result = await client.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get stock returns error:', error);
    res.status(500).json({ error: 'Failed to fetch stock returns' });
  } finally {
    client.release();
  }
});

// Get single stock return
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        sr.*,
        j.title as job_title,
        j.builder as job_builder,
        u.full_name as returned_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sri.id,
              'inventory_item_id', sri.inventory_item_id,
              'item_name', i.name,
              'quantity_allocated', sri.quantity_allocated,
              'quantity_returned', sri.quantity_returned,
              'quantity_used', sri.quantity_used,
              'condition', sri.condition,
              'notes', sri.notes
            )
          ) FILTER (WHERE sri.id IS NOT NULL),
          '[]'
        ) as items
      FROM stock_returns sr
      LEFT JOIN jobs j ON sr.job_id = j.id
      LEFT JOIN users u ON sr.returned_by = u.id
      LEFT JOIN stock_return_items sri ON sr.id = sri.stock_return_id
      LEFT JOIN inventory_items i ON sri.inventory_item_id = i.id
      WHERE sr.id = $1 AND sr.user_id = $2
      GROUP BY sr.id, j.title, j.builder, u.full_name
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock return not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get stock return error:', error);
    res.status(500).json({ error: 'Failed to fetch stock return' });
  } finally {
    client.release();
  }
});

// Get stock return for a specific job (for creating new returns)
router.get('/job/:job_id/allocated', async (req, res) => {
  const client = await pool.connect();

  try {
    // Get all allocated items for the job
    const allocatedResult = await client.query(`
      SELECT
        jai.item_id,
        jai.quantity as quantity_allocated,
        i.name as item_name,
        i.category,
        COALESCE(
          (
            SELECT SUM(sri.quantity_returned)
            FROM stock_returns sr
            JOIN stock_return_items sri ON sr.id = sri.stock_return_id
            WHERE sr.job_id = $1
              AND sri.inventory_item_id = jai.item_id
              AND sr.status = 'confirmed'
          ),
          0
        ) as quantity_previously_returned
      FROM job_allocated_items jai
      JOIN inventory_items i ON jai.item_id = i.id
      WHERE jai.job_id = $1
      ORDER BY i.name
    `, [req.params.job_id]);

    // Get job details
    const jobResult = await client.query(`
      SELECT id, title, builder, status, is_picked
      FROM jobs
      WHERE id = $1 AND user_id = $2
    `, [req.params.job_id, req.user.userId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    if (!job.is_picked) {
      return res.status(400).json({ error: 'Cannot create return for job that hasn\'t been picked yet' });
    }

    res.json({
      job: {
        id: job.id,
        title: job.title,
        builder: job.builder,
        status: job.status
      },
      allocated_items: allocatedResult.rows.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category,
        quantity_allocated: parseInt(item.quantity_allocated),
        quantity_previously_returned: parseInt(item.quantity_previously_returned),
        quantity_remaining: parseInt(item.quantity_allocated) - parseInt(item.quantity_previously_returned)
      }))
    });

  } catch (error) {
    console.error('Get allocated items error:', error);
    res.status(500).json({ error: 'Failed to fetch allocated items' });
  } finally {
    client.release();
  }
});

// Create stock return
router.post('/',
  [
    body('job_id').isUUID().withMessage('Valid job ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.inventory_item_id').isUUID().withMessage('Valid item ID is required'),
    body('items.*.quantity_allocated').isInt({ min: 0 }).withMessage('Allocated quantity must be positive'),
    body('items.*.quantity_returned').isInt({ min: 0 }).withMessage('Returned quantity must be positive'),
    body('items.*.condition').optional().isIn(['good', 'damaged', 'lost']).withMessage('Invalid condition'),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { job_id, items, notes } = req.body;

      // Validate job belongs to user and is picked
      const jobCheck = await client.query(
        'SELECT is_picked FROM jobs WHERE id = $1 AND user_id = $2',
        [job_id, req.user.userId]
      );

      if (jobCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Job not found' });
      }

      if (!jobCheck.rows[0].is_picked) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot create return for job that hasn\'t been picked' });
      }

      // Create stock return
      const returnResult = await client.query(`
        INSERT INTO stock_returns (user_id, job_id, returned_by, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [req.user.userId, job_id, req.user.userId, notes || null]);

      const stockReturn = returnResult.rows[0];

      // Add return items
      for (const item of items) {
        if (item.quantity_returned > 0) { // Only add items with returns
          await client.query(`
            INSERT INTO stock_return_items (
              stock_return_id,
              inventory_item_id,
              quantity_allocated,
              quantity_returned,
              condition,
              notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            stockReturn.id,
            item.inventory_item_id,
            item.quantity_allocated,
            item.quantity_returned,
            item.condition || 'good',
            item.notes || null
          ]);
        }
      }

      await client.query('COMMIT');

      // Fetch complete return with items
      const completeReturn = await client.query(`
        SELECT
          sr.*,
          j.title as job_title,
          COALESCE(
            json_agg(
              json_build_object(
                'id', sri.id,
                'inventory_item_id', sri.inventory_item_id,
                'item_name', i.name,
                'quantity_allocated', sri.quantity_allocated,
                'quantity_returned', sri.quantity_returned,
                'quantity_used', sri.quantity_used,
                'condition', sri.condition
              )
            ) FILTER (WHERE sri.id IS NOT NULL),
            '[]'
          ) as items
        FROM stock_returns sr
        LEFT JOIN jobs j ON sr.job_id = j.id
        LEFT JOIN stock_return_items sri ON sr.id = sri.stock_return_id
        LEFT JOIN inventory_items i ON sri.inventory_item_id = i.id
        WHERE sr.id = $1
        GROUP BY sr.id, j.title
      `, [stockReturn.id]);

      res.status(201).json(completeReturn.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create stock return error:', error);
      res.status(500).json({ error: 'Failed to create stock return' });
    } finally {
      client.release();
    }
  }
);

// Confirm stock return (adds items back to inventory)
router.post('/:id/confirm', async (req, res) => {
  const client = await pool.connect();

  try {
    // Check if return exists and is pending
    const checkResult = await client.query(
      'SELECT status FROM stock_returns WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stock return not found' });
    }

    if (checkResult.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Stock return is not pending' });
    }

    // Update status to confirmed (trigger will handle inventory updates)
    await client.query(`
      UPDATE stock_returns
      SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    res.json({ message: 'Stock return confirmed successfully' });

  } catch (error) {
    console.error('Confirm stock return error:', error);
    res.status(500).json({ error: 'Failed to confirm stock return' });
  } finally {
    client.release();
  }
});

// Cancel stock return
router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      UPDATE stock_returns
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING *
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock return not found or cannot be cancelled' });
    }

    res.json({ message: 'Stock return cancelled successfully' });

  } catch (error) {
    console.error('Cancel stock return error:', error);
    res.status(500).json({ error: 'Failed to cancel stock return' });
  } finally {
    client.release();
  }
});

// Delete stock return (only if pending)
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      DELETE FROM stock_returns
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING id
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock return not found or cannot be deleted' });
    }

    res.json({ message: 'Stock return deleted successfully' });

  } catch (error) {
    console.error('Delete stock return error:', error);
    res.status(500).json({ error: 'Failed to delete stock return' });
  } finally {
    client.release();
  }
});

// Get statistics
router.get('/stats/summary', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        COUNT(*) as total_returns,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_returns,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_returns,
        COALESCE(SUM(
          (SELECT SUM(quantity_used)
           FROM stock_return_items
           WHERE stock_return_id = stock_returns.id)
        ) FILTER (WHERE status = 'confirmed'), 0) as total_items_used,
        COALESCE(SUM(
          (SELECT SUM(quantity_returned)
           FROM stock_return_items
           WHERE stock_return_id = stock_returns.id)
        ) FILTER (WHERE status = 'confirmed'), 0) as total_items_returned
      FROM stock_returns
      WHERE user_id = $1
    `, [req.user.userId]);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get stock return stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  } finally {
    client.release();
  }
});

export default router;
