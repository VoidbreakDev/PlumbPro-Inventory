// server/src/routes/import.js
import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import os from 'os';
import path from 'path';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ensurePurchaseAnalyticsTables } from '../db/purchaseAnalyticsTables.js';
import { parseCsvFile, importReeceRows } from '../services/reeceImportService.js';
import { ValidationError } from '../utils/apiErrors.js';

const router = express.Router();
router.use(authenticateToken);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only CSV files are accepted'));
    }
  },
});

// POST /api/import/reece
router.post('/reece', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const tmpPath = req.file.path;
  try {
    await ensurePurchaseAnalyticsTables();
    const rows = await parseCsvFile(tmpPath);

    const client = await pool.connect();
    try {
      const summary = await importReeceRows(client, req.user.userId, req.file.originalname, rows);
      res.json(summary);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/reece]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
});

// GET /api/import/batches
router.get('/batches', async (req, res) => {
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM import_batches WHERE user_id=$1 ORDER BY imported_at DESC`,
        [req.user.userId]
      );
      res.json({ batches: result.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/batches]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/import/batches/:id
router.delete('/batches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      // Verify ownership
      const check = await client.query(
        `SELECT id FROM import_batches WHERE id=$1 AND user_id=$2`,
        [id, req.user.userId]
      );
      if (!check.rows.length) {
        return res.status(404).json({ error: 'Batch not found' });
      }
      await client.query(`DELETE FROM supplier_invoices WHERE import_batch_id=$1`, [id]);
      await client.query(`DELETE FROM import_batches WHERE id=$1`, [id]);
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/batches delete]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/import/invoices/:id/delivery
router.patch('/invoices/:id/delivery', async (req, res) => {
  const { id } = req.params;
  const { billable, overrideCharge } = req.body;
  if (typeof billable !== 'boolean') {
    return res.status(400).json({ error: 'billable must be a boolean' });
  }
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE supplier_invoices
         SET billable_delivery=$1, override_charge=$2
         WHERE id=$3 AND user_id=$4
         RETURNING *`,
        [billable ? 1 : 0, overrideCharge ?? null, id, req.user.userId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Invoice line not found' });
      }
      res.json({ success: true, row: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/delivery patch]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
