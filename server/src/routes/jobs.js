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
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({
  dest: path.join(__dirname, '../../../uploads/job-photos/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

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

// GET /api/jobs/calendar?start=2026-04-07&end=2026-04-11
router.get('/calendar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params required (ISO date)' });
    }

    const result = await client.query(`
      SELECT j.*,
             COALESCE(
               json_agg(jw.worker_id) FILTER (WHERE jw.worker_id IS NOT NULL),
               '[]'
             ) AS "assignedWorkerIds"
      FROM jobs j
      LEFT JOIN job_workers jw ON j.id = jw.job_id
      WHERE j.user_id = $1
        AND (
          (j.scheduled_start IS NOT NULL AND DATE(j.scheduled_start) BETWEEN $2 AND $3)
          OR (j.scheduled_start IS NULL AND j.date BETWEEN $2 AND $3)
        )
      GROUP BY j.id
      ORDER BY COALESCE(j.scheduled_start, j.date::timestamptz)
    `, [req.user.userId, start, end]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[jobs:calendar]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// GET /api/jobs/unscheduled
router.get('/unscheduled', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT j.*,
             COALESCE(
               json_agg(jw.worker_id) FILTER (WHERE jw.worker_id IS NOT NULL),
               '[]'
             ) AS "assignedWorkerIds"
      FROM jobs j
      LEFT JOIN job_workers jw ON j.id = jw.job_id
      WHERE j.user_id = $1
        AND j.scheduled_start IS NULL
        AND j.status NOT IN ('Completed', 'Cancelled', 'Invoiced')
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `, [req.user.userId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[jobs:unscheduled]', error.message);
    res.status(500).json({ success: false, error: error.message });
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

// GET /api/jobs/:id/notes
router.get('/:id/notes', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT n.*, u.full_name AS "authorName"
      FROM job_notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.job_id = $1
      ORDER BY n.created_at DESC
    `, [req.params.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[jobs:getNotes]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/jobs/:id/notes
router.post('/:id/notes', [
  body('note').notEmpty().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();
  try {
    const role = req.user.role;
    const MANAGER_PLUS = ['admin', 'manager', 'office'];
    if (!MANAGER_PLUS.includes(role)) {
      const assigned = await client.query(
        `SELECT 1 FROM job_workers WHERE job_id = $1 AND worker_id = $2`,
        [req.params.id, req.user.userId]
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    const result = await client.query(`
      INSERT INTO job_notes (job_id, user_id, note)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, req.user.userId, req.body.note]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[jobs:addNote]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// GET /api/jobs/:id/photos
router.get('/:id/photos', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.*, u.full_name AS "uploaderName"
      FROM job_photos p
      JOIN users u ON p.user_id = u.id
      WHERE p.job_id = $1
      ORDER BY p.created_at DESC
    `, [req.params.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[jobs:getPhotos]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/jobs/:id/photos
// Auth check before multer to prevent orphaned files on 403
router.post('/:id/photos', async (req, res, next) => {
  const role = req.user.role;
  const MANAGER_PLUS = ['admin', 'manager', 'office'];
  if (!MANAGER_PLUS.includes(role)) {
    const client = await pool.connect();
    try {
      const assigned = await client.query(
        `SELECT 1 FROM job_workers WHERE job_id = $1 AND worker_id = $2`,
        [req.params.id, req.user.userId]
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    } finally {
      client.release();
    }
  }
  next();
}, upload.single('photo'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const filePath = `/uploads/job-photos/${req.file.filename}`;
    const result = await client.query(`
      INSERT INTO job_photos (job_id, user_id, file_path, caption)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, req.user.userId, filePath, req.body.caption || null]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[jobs:addPhoto]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/jobs/:id/status
router.post('/:id/status', [
  body('status').isIn(['Unscheduled', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled', 'Invoiced']),
  validate
], async (req, res) => {
  const client = await pool.connect();
  try {
    const role = req.user.role;
    const MANAGER_PLUS = ['admin', 'manager', 'office'];

    if (!MANAGER_PLUS.includes(role)) {
      if (role !== 'technician') {
        return res.status(403).json({ error: 'Insufficient permissions to update job status' });
      }
      const assigned = await client.query(
        `SELECT 1 FROM job_workers WHERE job_id = $1 AND worker_id = $2`,
        [req.params.id, req.user.userId]
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    }

    const result = await client.query(
      `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, status`,
      [req.body.status, req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[jobs:updateStatus]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/jobs/:id/assign  (Manager+ only)
router.post('/:id/assign', [
  body('workerIds').isArray(),
  body('workerIds.*').isUUID(),
  body('scheduledStart').optional({ nullable: true }).isISO8601(),
  body('scheduledEnd').optional({ nullable: true }).isISO8601(),
  validate
], async (req, res) => {
  const MANAGER_PLUS = ['admin', 'manager', 'office'];
  if (!MANAGER_PLUS.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can reassign jobs' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { workerIds, scheduledStart, scheduledEnd } = req.body;

    await client.query(`
      UPDATE jobs
      SET scheduled_start = $1,
          scheduled_end   = $2,
          status          = CASE WHEN $1 IS NOT NULL THEN 'Scheduled' ELSE status END,
          updated_at      = NOW()
      WHERE id = $3 AND user_id = $4
    `, [scheduledStart || null, scheduledEnd || null, req.params.id, req.user.userId]);

    await client.query(`DELETE FROM job_workers WHERE job_id = $1`, [req.params.id]);
    for (const workerId of workerIds) {
      await client.query(
        `INSERT INTO job_workers (job_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, workerId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[jobs:assign]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/jobs/:id/recurring  (Manager+ only)
router.post('/:id/recurring', [
  body('frequency').isIn(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly']),
  body('startDate').isISO8601(),
  validate
], async (req, res) => {
  const MANAGER_PLUS = ['admin', 'manager', 'office'];
  if (!MANAGER_PLUS.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can set recurring jobs' });
  }

  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO job_recurring (job_id, frequency, next_due, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT ON CONSTRAINT job_recurring_job_id_unique DO UPDATE
        SET frequency = EXCLUDED.frequency,
            next_due  = EXCLUDED.next_due,
            is_active = TRUE
    `, [req.params.id, req.body.frequency, req.body.startDate]);

    res.json({ success: true });
  } catch (error) {
    console.error('[jobs:setRecurring]', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

export default router;
