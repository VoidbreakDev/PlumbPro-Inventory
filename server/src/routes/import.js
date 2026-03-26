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

// GET /api/import/review/pending — batches with outstanding unconfirmed rows
router.get('/review/pending', async (req, res) => {
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, filename, imported_at, unconfirmed_count, review_status
         FROM import_batches
         WHERE user_id=$1 AND review_status != 'complete'
         ORDER BY imported_at DESC`,
        [req.user.userId]
      );
      res.json({ batches: result.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/review/pending]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/batches/:batchId/review — unconfirmed invoice summaries for a batch
router.get('/batches/:batchId/review', async (req, res) => {
  const { batchId } = req.params;
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      // Verify ownership
      const batchCheck = await client.query(
        `SELECT id FROM import_batches WHERE id=$1 AND user_id=$2`,
        [batchId, req.user.userId]
      );
      if (!batchCheck.rows.length) return res.status(404).json({ error: 'Batch not found' });

      // Group unconfirmed rows by invoice_number
      const result = await client.query(
        `SELECT
           invoice_number,
           invoice_date,
           order_no,
           order_type,
           order_type_confirmed,
           COUNT(*) AS line_count,
           SUM(CASE WHEN invoice_type='TAX INVOICE' THEN COALESCE(line_total_ex_gst,0) ELSE 0 END) AS total_ex_gst,
           MAX(CASE WHEN is_delivery_item=1 THEN 1 ELSE 0 END) AS has_delivery_charge
         FROM supplier_invoices
         WHERE import_batch_id=$1 AND order_type_confirmed=0
         GROUP BY invoice_number, invoice_date, order_no, order_type, order_type_confirmed
         ORDER BY invoice_date ASC`,
        [batchId]
      );

      // Fetch top 3 product descriptions per invoice
      const invoiceNumbers = result.rows.map(r => r.invoice_number);
      let topProductsMap = {};
      if (invoiceNumbers.length) {
        const prodResult = await client.query(
          `SELECT invoice_number, product_description
           FROM supplier_invoices
           WHERE import_batch_id=$1 AND invoice_number=ANY($2::text[]) AND is_delivery_item=0
           ORDER BY invoice_number, id`,
          [batchId, invoiceNumbers]
        );
        for (const row of prodResult.rows) {
          if (!topProductsMap[row.invoice_number]) topProductsMap[row.invoice_number] = [];
          if (topProductsMap[row.invoice_number].length < 3) {
            topProductsMap[row.invoice_number].push(row.product_description);
          }
        }
      }

      const invoices = result.rows.map(r => ({
        invoiceNumber: r.invoice_number,
        invoiceDate: r.invoice_date,
        orderNo: r.order_no,
        currentOrderType: r.order_type,
        orderTypeConfirmed: !!r.order_type_confirmed,
        lineCount: parseInt(r.line_count),
        totalExGST: parseFloat(r.total_ex_gst),
        topProducts: topProductsMap[r.invoice_number] || [],
        hasDeliveryCharge: r.has_delivery_charge === 1 || r.has_delivery_charge === '1',
      }));

      res.json({ batchId, invoices });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/batches/review get]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/import/batches/:batchId/review — bulk update order types
router.patch('/batches/:batchId/review', async (req, res) => {
  const { batchId } = req.params;
  const { updates } = req.body;
  if (!Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: 'updates must be a non-empty array' });
  }
  const VALID_TYPES = ['Job Delivery', 'Stock Order', 'Pickup', 'Unknown'];
  for (const u of updates) {
    if (!u.invoiceNumber || !VALID_TYPES.includes(u.orderType)) {
      return res.status(400).json({ error: `Invalid update: ${JSON.stringify(u)}` });
    }
  }
  try {
    await ensurePurchaseAnalyticsTables();
    const client = await pool.connect();
    try {
      // Verify ownership
      const batchCheck = await client.query(
        `SELECT id FROM import_batches WHERE id=$1 AND user_id=$2`,
        [batchId, req.user.userId]
      );
      if (!batchCheck.rows.length) return res.status(404).json({ error: 'Batch not found' });

      let updatedCount = 0;
      for (const { invoiceNumber, orderType } of updates) {
        const r = await client.query(
          `UPDATE supplier_invoices
           SET order_type=$1, order_type_confirmed=1
           WHERE import_batch_id=$2 AND invoice_number=$3`,
          [orderType, batchId, invoiceNumber]
        );
        updatedCount += r.rowCount;
      }

      // Check how many unconfirmed rows remain
      const remaining = await client.query(
        `SELECT COUNT(*) AS cnt FROM supplier_invoices WHERE import_batch_id=$1 AND order_type_confirmed=0`,
        [batchId]
      );
      const remainingUnconfirmed = parseInt(remaining.rows[0].cnt);

      // Update batch review status
      if (remainingUnconfirmed === 0) {
        await client.query(
          `UPDATE import_batches
           SET review_status='complete', unconfirmed_count=0, reviewed_at=$1, reviewed_by=$2
           WHERE id=$3`,
          [new Date().toISOString(), req.user.email || req.user.userId, batchId]
        );
      } else {
        await client.query(
          `UPDATE import_batches SET review_status='in_progress', unconfirmed_count=$1 WHERE id=$2`,
          [remainingUnconfirmed, batchId]
        );
      }

      res.json({ updatedCount, remainingUnconfirmed });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[import/batches/review patch]', err);
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
