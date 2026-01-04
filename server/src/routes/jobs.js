import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

// Get all jobs
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        j.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('workerId', jw.worker_id, 'workerName', c.name)
          ) FILTER (WHERE jw.worker_id IS NOT NULL),
          '[]'
        ) as workers,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('itemId', jai.item_id, 'quantity', jai.quantity, 'itemName', i.name)
          ) FILTER (WHERE jai.item_id IS NOT NULL),
          '[]'
        ) as allocated_items
      FROM jobs j
      LEFT JOIN job_workers jw ON j.id = jw.job_id
      LEFT JOIN contacts c ON jw.worker_id = c.id
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id
      WHERE j.user_id = $1
      GROUP BY j.id
      ORDER BY j.date DESC, j.created_at DESC
    `, [req.user.userId]);

    const jobs = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      builder: row.builder,
      jobType: row.job_type,
      status: row.status,
      date: row.date,
      isPicked: row.is_picked,
      assignedWorkerIds: row.workers.map(w => w.workerId),
      workers: row.workers,
      allocatedItems: row.allocated_items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        itemName: item.itemName
      }))
    }));

    res.json(jobs);

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  } finally {
    client.release();
  }
});

// Get single job
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        j.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('workerId', jw.worker_id, 'workerName', c.name)
          ) FILTER (WHERE jw.worker_id IS NOT NULL),
          '[]'
        ) as workers,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('itemId', jai.item_id, 'quantity', jai.quantity, 'itemName', i.name)
          ) FILTER (WHERE jai.item_id IS NOT NULL),
          '[]'
        ) as allocated_items
      FROM jobs j
      LEFT JOIN job_workers jw ON j.id = jw.job_id
      LEFT JOIN contacts c ON jw.worker_id = c.id
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id
      WHERE j.id = $1 AND j.user_id = $2
      GROUP BY j.id
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      builder: row.builder,
      jobType: row.job_type,
      status: row.status,
      date: row.date,
      isPicked: row.is_picked,
      assignedWorkerIds: row.workers.map(w => w.workerId),
      workers: row.workers,
      allocatedItems: row.allocated_items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        itemName: item.itemName
      }))
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  } finally {
    client.release();
  }
});

// Create job
router.post('/',
  [
    body('title').notEmpty().trim(),
    body('builder').optional().trim(),
    body('jobType').notEmpty().trim(),
    body('date').isISO8601(),
    body('assignedWorkerIds').isArray(),
    body('allocatedItems').optional().isArray(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { title, builder, jobType, date, assignedWorkerIds, allocatedItems } = req.body;

      // Create job
      const jobResult = await client.query(`
        INSERT INTO jobs (user_id, title, builder, job_type, date, status, is_picked)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [req.user.userId, title, builder || null, jobType, date, 'Scheduled', false]);

      const job = jobResult.rows[0];

      // Add workers
      if (assignedWorkerIds && assignedWorkerIds.length > 0) {
        for (const workerId of assignedWorkerIds) {
          await client.query(
            'INSERT INTO job_workers (job_id, worker_id) VALUES ($1, $2)',
            [job.id, workerId]
          );
        }
      }

      // Add allocated items
      if (allocatedItems && allocatedItems.length > 0) {
        for (const item of allocatedItems) {
          await client.query(
            'INSERT INTO job_allocated_items (job_id, item_id, quantity) VALUES ($1, $2, $3)',
            [job.id, item.itemId, item.quantity]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: job.id,
        title: job.title,
        builder: job.builder,
        jobType: job.job_type,
        status: job.status,
        date: job.date,
        isPicked: job.is_picked,
        assignedWorkerIds,
        allocatedItems: allocatedItems || []
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create job error:', error);
      res.status(500).json({ error: 'Failed to create job' });
    } finally {
      client.release();
    }
  }
);

// Update job
router.put('/:id',
  [
    body('title').optional().notEmpty().trim(),
    body('builder').optional().trim(),
    body('jobType').optional().notEmpty().trim(),
    body('status').optional().isIn(['Scheduled', 'In Progress', 'Completed', 'Cancelled']),
    body('date').optional().isISO8601(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      const fieldMap = {
        title: 'title',
        builder: 'builder',
        jobType: 'job_type',
        status: 'status',
        date: 'date'
      };

      Object.keys(req.body).forEach(key => {
        const dbField = fieldMap[key] || key;
        updates.push(`${dbField} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(req.params.id, req.user.userId);

      const result = await client.query(`
        UPDATE jobs
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const job = result.rows[0];
      res.json({
        id: job.id,
        title: job.title,
        builder: job.builder,
        jobType: job.job_type,
        status: job.status,
        date: job.date,
        isPicked: job.is_picked
      });

    } catch (error) {
      console.error('Update job error:', error);
      res.status(500).json({ error: 'Failed to update job' });
    } finally {
      client.release();
    }
  }
);

// Pick job (remove stock from inventory)
router.post('/:id/pick', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get job with allocated items
    const jobResult = await client.query(`
      SELECT j.*, jai.item_id, jai.quantity
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      WHERE j.id = $1 AND j.user_id = $2
    `, [req.params.id, req.user.userId]);

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    if (job.is_picked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Job already picked' });
    }

    // Deduct items from inventory
    for (const row of jobResult.rows) {
      if (row.item_id) {
        await client.query(
          'UPDATE inventory_items SET quantity = quantity - $1 WHERE id = $2',
          [row.quantity, row.item_id]
        );

        // Log movement
        await client.query(`
          INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.user.userId, row.item_id, 'Out', -row.quantity, job.id, Date.now()]);
      }
    }

    // Mark job as picked
    await client.query(
      'UPDATE jobs SET is_picked = true WHERE id = $1',
      [req.params.id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Job picked successfully', jobId: req.params.id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pick job error:', error);
    res.status(500).json({ error: 'Failed to pick job' });
  } finally {
    client.release();
  }
});

// Delete job
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  } finally {
    client.release();
  }
});

export default router;
