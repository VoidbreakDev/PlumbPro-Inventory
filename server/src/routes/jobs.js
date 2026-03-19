import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  createJobWithRelations,
  getJobById,
  listJobs,
  updateJobWithRelations
} from '../services/jobPersistence.js';

const router = express.Router();

router.use(authenticateToken);

const handleValidationError = (res, error, fallbackMessage) => {
  if (error.statusCode === 400) {
    return res.status(400).json({
      error: error.message || fallbackMessage,
      ...(error.details || {})
    });
  }

  return res.status(500).json({ error: fallbackMessage });
};

// Get all jobs
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { search, limit } = req.query;
    const jobs = await listJobs(client, req.user.userId, {
      search: typeof search === 'string' ? search : undefined,
      limit: typeof limit === 'string' ? Number(limit) : undefined
    });

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
    const job = await getJobById(client, req.user.userId, req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  } finally {
    client.release();
  }
});

// Create job
router.post(
  '/',
  [
    body('title').notEmpty().trim().escape(),
    body('builder').optional({ nullable: true }).trim().escape(),
    body('customerId').optional({ nullable: true }).isUUID(),
    body('jobType').notEmpty().trim().escape(),
    body('status')
      .optional()
      .isIn(['Scheduled', 'In Progress', 'Completed', 'Cancelled']),
    body('date').isISO8601(),
    body('jobAddress').optional({ nullable: true }).trim(),
    body('developmentProjectId').optional({ nullable: true }).isUUID(),
    body('developmentStageId').optional({ nullable: true }).isUUID(),
    body('assignedWorkerIds').optional().isArray(),
    body('assignedWorkerIds.*').optional().isUUID(),
    body('allocatedItems').optional().isArray(),
    body('allocatedItems.*.itemId').optional().isUUID(),
    body('allocatedItems.*.quantity').optional().isInt({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const job = await createJobWithRelations(client, req.user.userId, {
        title: req.body.title,
        builder: req.body.builder,
        customerId: req.body.customerId,
        jobType: req.body.jobType,
        status: req.body.status || 'Scheduled',
        date: req.body.date,
        isPicked: req.body.isPicked || false,
        jobAddress: req.body.jobAddress,
        developmentProjectId: req.body.developmentProjectId,
        developmentStageId: req.body.developmentStageId,
        assignedWorkerIds: req.body.assignedWorkerIds || [],
        allocatedItems: req.body.allocatedItems || []
      });

      await client.query('COMMIT');
      res.status(201).json(job);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create job error:', error);
      handleValidationError(res, error, 'Failed to create job');
    } finally {
      client.release();
    }
  }
);

// Update job
router.put(
  '/:id',
  [
    body('title').optional().notEmpty().trim().escape(),
    body('builder').optional({ nullable: true }).trim().escape(),
    body('customerId').optional({ nullable: true }).isUUID(),
    body('jobType').optional().notEmpty().trim().escape(),
    body('status')
      .optional()
      .isIn(['Scheduled', 'In Progress', 'Completed', 'Cancelled']),
    body('date').optional().isISO8601(),
    body('jobAddress').optional({ nullable: true }).trim(),
    body('developmentProjectId').optional({ nullable: true }).isUUID(),
    body('developmentStageId').optional({ nullable: true }).isUUID(),
    body('assignedWorkerIds').optional().isArray(),
    body('assignedWorkerIds.*').optional().isUUID(),
    body('allocatedItems').optional().isArray(),
    body('allocatedItems.*.itemId').optional().isUUID(),
    body('allocatedItems.*.quantity').optional().isInt({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updated = await updateJobWithRelations(client, req.user.userId, req.params.id, req.body);

      if (!updated) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Job not found' });
      }

      await client.query('COMMIT');
      res.json(updated);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update job error:', error);
      handleValidationError(res, error, 'Failed to update job');
    } finally {
      client.release();
    }
  }
);

// Pick job (remove stock from inventory) - Fixed race condition
router.post('/:id/pick', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get job with allocated items and lock the rows
    const jobResult = await client.query(`
      SELECT j.*, jai.item_id, jai.quantity
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      WHERE j.id = $1 AND j.user_id = $2
      FOR UPDATE OF j
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

    // Check stock availability before deducting
    const stockIssues = [];
    const itemsToDeduct = [];

    for (const row of jobResult.rows) {
      if (row.item_id) {
        // Lock the inventory item row
        const itemResult = await client.query(`
          SELECT id, name, quantity FROM inventory_items
          WHERE id = $1 AND user_id = $2
          FOR UPDATE
        `, [row.item_id, req.user.userId]);

        if (itemResult.rows.length === 0) {
          stockIssues.push({ itemId: row.item_id, error: 'Item not found' });
          continue;
        }

        const item = itemResult.rows[0];
        
        if (item.quantity < row.quantity) {
          stockIssues.push({
            itemId: row.item_id,
            itemName: item.name,
            requested: row.quantity,
            available: item.quantity
          });
        } else {
          itemsToDeduct.push({
            itemId: row.item_id,
            quantity: row.quantity,
            itemName: item.name
          });
        }
      }
    }

    // If there are stock issues, rollback and return error
    if (stockIssues.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient stock for job pick',
        stockIssues
      });
    }

    // Deduct items from inventory
    for (const item of itemsToDeduct) {
      await client.query(`
        UPDATE inventory_items 
        SET quantity = quantity - $1 
        WHERE id = $2 AND user_id = $3
      `, [item.quantity, item.itemId, req.user.userId]);

      // Log movement
      await client.query(`
        INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [req.user.userId, item.itemId, 'Out', -item.quantity, job.id, Date.now()]);
    }

    // Mark job as picked
    await client.query(
      'UPDATE jobs SET is_picked = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    await client.query('COMMIT');

    res.json({ 
      message: 'Job picked successfully', 
      jobId: req.params.id,
      itemsPicked: itemsToDeduct.length
    });

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
