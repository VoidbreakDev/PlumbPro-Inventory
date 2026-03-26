# Purchase Analytics & Reece CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reece supplier invoice CSV import pipeline and a Purchase Analytics dashboard tab showing spend, product, price trend, and delivery analytics.

**Architecture:** New backend tables (`supplier_invoices`, `import_batches`, `product_price_history`) scoped by `user_id`. A shared `ensureTables` module initialises them. Import routes parse CSV via papaparse; analytics routes query the tables. A new `PurchaseAnalyticsView` tab hosts recharts-based components.

**Tech Stack:** Node.js/Express backend, papaparse (add to server), recharts (already installed frontend), TypeScript React, Tailwind CSS, PostgreSQL/SQLite via existing pool.

**Codebase notes:**
- Routes pattern: `pool.connect()` → `client.query()` → `client.release()` in try/finally. `router.use(authenticateToken)` at top.
- Table creation: SQLite-compatible types (TEXT, REAL, INTEGER). IDs are TEXT UUIDs from `crypto.randomUUID()`.
- Frontend: views in `views/`, shared components in `components/`, lazy-loaded via `app/lazyViews.ts`, routed in `app/AppViewRouter.tsx`, nav in `components/Navigation.tsx`.
- recharts is already installed — do NOT add Chart.js.
- Existing `/api/analytics` route in use — new routes mount at `/api/purchase-analytics` and `/api/import`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `server/src/db/purchaseAnalyticsTables.js` |
| Create | `server/src/utils/categorise.js` |
| Create | `server/src/services/reeceImportService.js` |
| Create | `server/src/routes/import.js` |
| Create | `server/src/routes/purchaseAnalytics.js` |
| Modify | `server/src/app.js` |
| Create | `lib/purchaseAnalyticsAPI.ts` |
| Create | `components/analytics/StatCard.tsx` |
| Create | `components/analytics/AnalyticsDashboard.tsx` |
| Create | `components/analytics/SpendOverview.tsx` |
| Create | `components/analytics/InventoryInsights.tsx` |
| Create | `components/analytics/PriceTrends.tsx` |
| Create | `components/analytics/DeliveryCosts.tsx` |
| Create | `components/import/ReeceImportModal.tsx` |
| Create | `components/import/ImportHistory.tsx` |
| Create | `views/PurchaseAnalyticsView.tsx` |
| Modify | `app/lazyViews.ts` |
| Modify | `app/AppViewRouter.tsx` |
| Modify | `components/Navigation.tsx` |
| Create | `scripts/seedReeceData.js` |
| Create | `data/reece/.gitkeep` |

---

## Task 1: Install papaparse on the server

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install papaparse**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory/server" && npm install papaparse
```

Expected: `added 1 package` (or similar). No errors.

- [ ] **Step 2: Verify install**

```bash
node -e "import('papaparse').then(m => console.log('papaparse ok:', typeof m.default.parse))"
```

Expected output: `papaparse ok: function`

---

## Task 2: DB tables module

**Files:**
- Create: `server/src/db/purchaseAnalyticsTables.js`

- [ ] **Step 1: Create the module**

```js
// server/src/db/purchaseAnalyticsTables.js
import pool from '../config/database.js';

let tablesReady = null;

export async function ensurePurchaseAnalyticsTables() {
  if (tablesReady) return tablesReady;

  tablesReady = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          filename TEXT,
          imported_at TEXT NOT NULL,
          imported_by TEXT,
          row_count INTEGER,
          invoice_count INTEGER,
          gross_total_ex_gst REAL,
          credit_total_ex_gst REAL,
          status TEXT NOT NULL DEFAULT 'complete',
          notes TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS supplier_invoices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          import_batch_id TEXT NOT NULL,
          supplier TEXT DEFAULT 'Reece',
          invoice_date TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          invoice_type TEXT NOT NULL,
          order_no TEXT,
          order_type TEXT,
          job_name TEXT,
          receiver TEXT,
          product_code TEXT NOT NULL,
          product_description TEXT NOT NULL,
          category TEXT,
          quantity REAL,
          unit TEXT,
          unit_price_ex_gst REAL,
          unit_price_inc_gst REAL,
          line_total_ex_gst REAL,
          line_total_gst REAL,
          line_total_inc_gst REAL,
          discount_pct REAL,
          is_delivery_item INTEGER NOT NULL DEFAULT 0,
          delivery_absorbed INTEGER NOT NULL DEFAULT 1,
          billable_delivery INTEGER NOT NULL DEFAULT 0,
          override_charge REAL,
          created_at TEXT NOT NULL
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_price_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          product_code TEXT NOT NULL,
          product_description TEXT,
          category TEXT,
          unit TEXT,
          unit_price_ex_gst REAL,
          unit_price_inc_gst REAL,
          recorded_month TEXT NOT NULL,
          source TEXT DEFAULT 'reece_invoice'
        )
      `);

      // Migration: add override_charge if missing (for existing installs)
      try {
        await client.query('ALTER TABLE supplier_invoices ADD COLUMN override_charge REAL');
      } catch (_) { /* already exists */ }

      await client.query(`CREATE INDEX IF NOT EXISTS idx_si_user_date ON supplier_invoices(user_id, invoice_date)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_si_product ON supplier_invoices(user_id, product_code)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_si_batch ON supplier_invoices(import_batch_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pph_code ON product_price_history(user_id, product_code, recorded_month)`);
    } finally {
      client.release();
    }
  })();

  return tablesReady;
}
```

- [ ] **Step 2: Quick smoke-test (run after server starts)**

Start the server and hit any authenticated endpoint — the tables are created lazily on first import/analytics request. No dedicated test needed here; the import route will call this.

---

## Task 3: Category classification utility

**Files:**
- Create: `server/src/utils/categorise.js`

- [ ] **Step 1: Create the utility**

```js
// server/src/utils/categorise.js
export function categoriseProduct(description) {
  const d = (description || '').toUpperCase();
  if (/PVC|DWV|STORMWATER|S\/W|SW BEND|SW TEE|EXPANDA|SWJ/.test(d)) return 'PVC/DWV/Stormwater';
  if (/PEX|AUSPEX|POLYETHYLENE|POLY|HDPE/.test(d)) return 'Pex/Poly';
  if (/COPPER|CU |KEMBLA/.test(d)) return 'Copper';
  if (/PHILMAC|3G FEM|3G EQUAL|3G MAL|COMPRESSION/.test(d)) return 'Compression Fittings';
  if (/SEPTIC|TANK|CARAT|GRAF/.test(d)) return 'Tanks & Septic';
  if (/CEMENT|PRIMER|SOLVENT/.test(d)) return 'Adhesives & Solvents';
  if (/CARTAGE|DELIVERY|FREIGHT|TRANSPORT|TRUCK|COURIER/.test(d)) return 'Cartage/Delivery';
  if (/TAP|VALVE|BALL VALVE|GATE|CHECK/.test(d)) return 'Valves & Taps';
  if (/TOILET|CISTERN|BASIN|SHOWER|BATH|WC/.test(d)) return 'Fixtures & Sanitaryware';
  if (/ARDENT|BRASS|NIPPLE|ELBOW|TEE|COUPLING|UNION|ADAPTOR|FITTING/.test(d)) return 'Brass/Metal Fittings';
  if (/CLIP|RATCHET|STRAP|SADDLE|ANCHOR|SCREW|FASTANOG/.test(d)) return 'Fixings & Clips';
  return 'Other';
}

export function classifyOrderType(orderNo) {
  const v = String(orderNo || '').trim();
  if (['WAREHOUSE', '2021', '0', 'nan', '0101', '2001'].includes(v)) return 'Stock/Warehouse';
  return 'Job Order';
}

export function isDeliveryItem(description) {
  return /CARTAGE|DELIVERY|FREIGHT|TRANSPORT|TRUCK|COURIER/i.test(description || '');
}
```

- [ ] **Step 2: Verify with a quick node test**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory/server" && node -e "
import('./src/utils/categorise.js').then(m => {
  console.log(m.categoriseProduct('25mm PVC DWV BEND'));       // PVC/DWV/Stormwater
  console.log(m.categoriseProduct('CARTAGE - SITE DELIVERY')); // Cartage/Delivery
  console.log(m.classifyOrderType('WAREHOUSE'));                // Stock/Warehouse
  console.log(m.classifyOrderType('2021'));                     // Stock/Warehouse
  console.log(m.classifyOrderType('JOB-123'));                  // Job Order
  console.log(m.isDeliveryItem('CARTAGE'));                     // true
});
"
```

Expected output:
```
PVC/DWV/Stormwater
Cartage/Delivery
Stock/Warehouse
Stock/Warehouse
Job Order
true
```

---

## Task 4: Reece CSV import service

**Files:**
- Create: `server/src/services/reeceImportService.js`

- [ ] **Step 1: Create the service**

```js
// server/src/services/reeceImportService.js
import { createReadStream } from 'fs';
import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import { categoriseProduct, classifyOrderType, isDeliveryItem } from '../utils/categorise.js';

/** Parse dd/MM/yyyy → ISO date string YYYY-MM-DD */
function parseAusDate(str) {
  if (!str) return null;
  const parts = String(str).trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** First day of the month containing dateStr (YYYY-MM-DD) → YYYY-MM-01 */
function toMonthStart(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7) + '-01';
}

function toNum(v) {
  const n = parseFloat(String(v || '').replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

/** Parse the CSV file at filePath and return raw rows array */
export function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => resolve(parsed.data),
      error: reject,
    });
  });
}

/**
 * Import rows from a parsed Reece CSV into the DB.
 * Returns summary stats.
 */
export async function importReeceRows(client, userId, filename, rows) {
  const batchId = randomUUID();
  const now = new Date().toISOString();
  let invoiceCount = 0;
  let creditCount = 0;
  let skippedCount = 0;

  // Price history accumulator: key = productCode:YYYY-MM-01
  const priceMap = new Map();

  for (const row of rows) {
    const type = (row['Type'] || '').trim();

    // Skip cash/personal invoices
    if (type === 'Invoice (Cash)') {
      skippedCount++;
      continue;
    }

    // Normalise invoice type
    let invoiceType;
    if (type.includes('CREDIT')) {
      invoiceType = 'CREDIT NOTE';
      creditCount++;
    } else {
      invoiceType = 'TAX INVOICE';
      invoiceCount++;
    }

    const description = (row['Product Description'] || '').trim();
    const category = categoriseProduct(description);
    const delivery = isDeliveryItem(description);
    const orderNo = (row['Order No'] || '').trim();
    const invoiceDateRaw = (row['Date'] || '').trim();
    const invoiceDate = parseAusDate(invoiceDateRaw);
    const unitPriceExGst = toNum(row['Unit Price GST Excl']);
    const unitPriceIncGst = toNum(row['Unit Price GST Incl']);
    const productCode = (row['Product Code'] || '').trim();

    const id = randomUUID();
    await client.query(
      `INSERT INTO supplier_invoices (
        id, user_id, import_batch_id, supplier, invoice_date, invoice_number,
        invoice_type, order_no, order_type, job_name, receiver,
        product_code, product_description, category, quantity, unit,
        unit_price_ex_gst, unit_price_inc_gst, line_total_ex_gst, line_total_gst,
        line_total_inc_gst, discount_pct, is_delivery_item, delivery_absorbed,
        billable_delivery, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      )`,
      [
        id, userId, batchId,
        (row['Supplier'] || 'Reece').trim(),
        invoiceDate,
        (row['Number'] || '').trim(),
        invoiceType,
        orderNo || null,
        classifyOrderType(orderNo),
        (row['Job Name'] || null),
        (row['Receiver'] || null),
        productCode,
        description,
        category,
        toNum(row['Quantity']),
        (row['Unit'] || null),
        unitPriceExGst,
        unitPriceIncGst,
        toNum(row['GST Excl Total Price']),
        toNum(row['GST Amount']),
        toNum(row['GST Incl Total Price']),
        toNum(row['Set Disc%']),
        delivery ? 1 : 0,
        1, // delivery_absorbed default true
        0, // billable_delivery default false
        now,
      ]
    );

    // Accumulate price history (TAX INVOICE only, non-null price)
    if (invoiceType === 'TAX INVOICE' && productCode && invoiceDate && unitPriceExGst !== null) {
      const monthKey = toMonthStart(invoiceDate);
      const mapKey = `${productCode}:${monthKey}`;
      if (!priceMap.has(mapKey)) {
        priceMap.set(mapKey, {
          productCode,
          description,
          category,
          unit: (row['Unit'] || null),
          unitPriceExGst,
          unitPriceIncGst,
          recordedMonth: monthKey,
        });
      }
    }
  }

  // Upsert product price history
  for (const entry of priceMap.values()) {
    const phId = randomUUID();
    await client.query(
      `INSERT INTO product_price_history
        (id, user_id, product_code, product_description, category, unit, unit_price_ex_gst, unit_price_inc_gst, recorded_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [phId, userId, entry.productCode, entry.description, entry.category, entry.unit, entry.unitPriceExGst, entry.unitPriceIncGst, entry.recordedMonth]
    );
  }

  // Compute batch totals from what was inserted
  const totalsResult = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_ex_gst ELSE 0 END),0) AS gross,
       COALESCE(SUM(CASE WHEN invoice_type='CREDIT NOTE' THEN ABS(line_total_ex_gst) ELSE 0 END),0) AS credits
     FROM supplier_invoices WHERE import_batch_id=$1`,
    [batchId]
  );
  const grossTotal = parseFloat(totalsResult.rows[0].gross);
  const creditTotal = parseFloat(totalsResult.rows[0].credits);

  // Insert batch record
  await client.query(
    `INSERT INTO import_batches (id,user_id,filename,imported_at,row_count,invoice_count,gross_total_ex_gst,credit_total_ex_gst,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'complete')`,
    [batchId, userId, filename, now, rows.length, invoiceCount + creditCount, grossTotal, creditTotal]
  );

  return { batchId, rowCount: rows.length, invoiceCount, creditCount, skippedCount, grossTotal, creditTotal };
}
```

- [ ] **Step 2: No standalone test yet** — tested end-to-end in Task 5 once the route is wired up.

---

## Task 5: Import API route

**Files:**
- Create: `server/src/routes/import.js`

- [ ] **Step 1: Create the route file**

```js
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
```

- [ ] **Step 2: Commit Task 2–5 together**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory"
git add server/src/db/purchaseAnalyticsTables.js server/src/utils/categorise.js server/src/services/reeceImportService.js server/src/routes/import.js
git commit -m "feat: add Reece CSV import pipeline (tables, categorise util, import service, import routes)"
```

---

## Task 6: Purchase Analytics API route

**Files:**
- Create: `server/src/routes/purchaseAnalytics.js`

- [ ] **Step 1: Create the route file**

```js
// server/src/routes/purchaseAnalytics.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ensurePurchaseAnalyticsTables } from '../db/purchaseAnalyticsTables.js';

const router = express.Router();
router.use(authenticateToken);

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// GET /api/purchase-analytics/summary
router.get('/summary', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const r = await client.query(
      `SELECT
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_ex_gst ELSE 0 END),0) AS total_gross_ex_gst,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_inc_gst ELSE 0 END),0) AS total_inc_gst,
        COALESCE(SUM(CASE WHEN invoice_type='CREDIT NOTE' THEN ABS(line_total_ex_gst) ELSE 0 END),0) AS total_credits,
        COUNT(DISTINCT CASE WHEN invoice_type='TAX INVOICE' THEN invoice_number END) AS total_invoices,
        COUNT(DISTINCT CASE WHEN invoice_type='TAX INVOICE' THEN product_code END) AS total_unique_products,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' AND is_delivery_item=1 THEN line_total_ex_gst ELSE 0 END),0) AS total_delivery_ex_gst,
        MIN(invoice_date) AS date_from,
        MAX(invoice_date) AS date_to
       FROM supplier_invoices WHERE user_id=$1`,
      [uid]
    );
    const row = r.rows[0];
    const gross = parseFloat(row.total_gross_ex_gst);
    const credits = parseFloat(row.total_credits);

    // avg monthly: count distinct months
    const months = await client.query(
      `SELECT COUNT(DISTINCT SUBSTR(invoice_date,1,7)) AS months FROM supplier_invoices WHERE user_id=$1 AND invoice_type='TAX INVOICE'`,
      [uid]
    );
    const monthCount = parseInt(months.rows[0].months) || 1;

    res.json({
      totalGrossExGST: gross,
      totalNetExGST: gross - credits,
      totalIncGST: parseFloat(row.total_inc_gst),
      totalInvoices: parseInt(row.total_invoices),
      totalUniqueProducts: parseInt(row.total_unique_products),
      totalDeliveryExGST: parseFloat(row.total_delivery_ex_gst),
      avgMonthlyGross: gross / monthCount,
      dateFrom: row.date_from,
      dateTo: row.date_to,
    });
  } catch (err) {
    console.error('[purchase-analytics/summary]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/spend/monthly
router.get('/spend/monthly', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const { year, from, to } = req.query;
    let where = `user_id=$1`;
    const params = [uid];
    if (year) {
      where += ` AND invoice_date LIKE $${params.length + 1}`;
      params.push(`${year}%`);
    } else if (from && to) {
      const f = parseDate(from + '-01');
      const t = parseDate(to + '-01');
      if (!f || !t) return res.status(400).json({ error: 'Invalid date params' });
      where += ` AND invoice_date >= $${params.length + 1} AND invoice_date <= $${params.length + 2}`;
      params.push(f, t);
    }

    const r = await client.query(
      `SELECT
        SUBSTR(invoice_date,1,7) AS month,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_ex_gst ELSE 0 END),0) AS gross_ex_gst,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_inc_gst ELSE 0 END),0) AS gross_inc_gst,
        COALESCE(SUM(CASE WHEN invoice_type='CREDIT NOTE' THEN ABS(line_total_ex_gst) ELSE 0 END),0) AS credits,
        COUNT(DISTINCT CASE WHEN invoice_type='TAX INVOICE' THEN invoice_number END) AS invoice_count,
        COUNT(CASE WHEN invoice_type='TAX INVOICE' THEN 1 END) AS line_items
       FROM supplier_invoices WHERE ${where}
       GROUP BY SUBSTR(invoice_date,1,7)
       ORDER BY month`,
      params
    );
    res.json({
      months: r.rows.map(row => ({
        month: row.month,
        grossExGST: parseFloat(row.gross_ex_gst),
        netExGST: parseFloat(row.gross_ex_gst) - parseFloat(row.credits),
        grossIncGST: parseFloat(row.gross_inc_gst),
        credits: parseFloat(row.credits),
        invoiceCount: parseInt(row.invoice_count),
        lineItems: parseInt(row.line_items),
      }))
    });
  } catch (err) {
    console.error('[purchase-analytics/spend/monthly]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/spend/annual
router.get('/spend/annual', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const r = await client.query(
      `SELECT
        SUBSTR(invoice_date,1,4) AS year,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_ex_gst ELSE 0 END),0) AS gross_ex_gst,
        COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_inc_gst ELSE 0 END),0) AS gross_inc_gst,
        COALESCE(SUM(CASE WHEN invoice_type='CREDIT NOTE' THEN ABS(line_total_ex_gst) ELSE 0 END),0) AS credits,
        COUNT(DISTINCT CASE WHEN invoice_type='TAX INVOICE' THEN invoice_number END) AS invoice_count
       FROM supplier_invoices WHERE user_id=$1
       GROUP BY SUBSTR(invoice_date,1,4)
       ORDER BY year`,
      [uid]
    );
    res.json({
      years: r.rows.map(row => ({
        year: row.year,
        grossExGST: parseFloat(row.gross_ex_gst),
        netExGST: parseFloat(row.gross_ex_gst) - parseFloat(row.credits),
        grossIncGST: parseFloat(row.gross_inc_gst),
        credits: parseFloat(row.credits),
        invoiceCount: parseInt(row.invoice_count),
      }))
    });
  } catch (err) {
    console.error('[purchase-analytics/spend/annual]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/categories
router.get('/categories', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const { from, to } = req.query;
    let dateWhere = '';
    const params = [uid];
    if (from) { params.push(from); dateWhere += ` AND invoice_date >= $${params.length}`; }
    if (to)   { params.push(to);   dateWhere += ` AND invoice_date <= $${params.length}`; }

    const r = await client.query(
      `SELECT
        category,
        COALESCE(SUM(line_total_ex_gst),0) AS total_ex_gst,
        COUNT(*) AS line_items,
        COUNT(DISTINCT product_code) AS unique_products
       FROM supplier_invoices
       WHERE user_id=$1 AND invoice_type='TAX INVOICE'${dateWhere}
       GROUP BY category
       ORDER BY total_ex_gst DESC`,
      params
    );

    const grandTotal = r.rows.reduce((s, row) => s + parseFloat(row.total_ex_gst), 0) || 1;
    res.json({
      categories: r.rows.map(row => ({
        category: row.category,
        totalExGST: parseFloat(row.total_ex_gst),
        lineItems: parseInt(row.line_items),
        uniqueProducts: parseInt(row.unique_products),
        percentOfTotal: parseFloat(((parseFloat(row.total_ex_gst) / grandTotal) * 100).toFixed(1)),
      }))
    });
  } catch (err) {
    console.error('[purchase-analytics/categories]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/products/top
router.get('/products/top', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const sortBy = req.query.sortBy || 'orders';
    const { from, to } = req.query;

    let dateWhere = '';
    const params = [uid];
    if (from) { params.push(from); dateWhere += ` AND invoice_date >= $${params.length}`; }
    if (to)   { params.push(to);   dateWhere += ` AND invoice_date <= $${params.length}`; }

    const orderCol = sortBy === 'spend' ? 'total_spend_ex_gst' : sortBy === 'qty' ? 'total_qty' : 'times_ordered';

    const r = await client.query(
      `SELECT
        product_code,
        MAX(product_description) AS product_description,
        MAX(category) AS category,
        MAX(unit) AS unit,
        COUNT(DISTINCT invoice_number) AS times_ordered,
        COALESCE(SUM(quantity),0) AS total_qty,
        COALESCE(SUM(line_total_ex_gst),0) AS total_spend_ex_gst,
        MIN(invoice_date) AS first_seen,
        MAX(invoice_date) AS last_seen
       FROM supplier_invoices
       WHERE user_id=$1 AND invoice_type='TAX INVOICE'${dateWhere}
       GROUP BY product_code
       ORDER BY ${orderCol} DESC
       LIMIT ${limit}`,
      params
    );

    // Latest prices from product_price_history
    const codes = r.rows.map(row => row.product_code);
    let priceMap = new Map();
    if (codes.length) {
      const ph = await client.query(
        `SELECT DISTINCT ON (product_code) product_code, unit_price_ex_gst, unit_price_inc_gst
         FROM product_price_history
         WHERE user_id=$1 AND product_code = ANY($2::text[])
         ORDER BY product_code, recorded_month DESC`,
        [uid, codes]
      );
      ph.rows.forEach(pr => priceMap.set(pr.product_code, pr));
    }

    res.json({
      products: r.rows.map(row => {
        const price = priceMap.get(row.product_code) || {};
        return {
          productCode: row.product_code,
          productDescription: row.product_description,
          category: row.category,
          unit: row.unit,
          timesOrdered: parseInt(row.times_ordered),
          totalQty: parseFloat(row.total_qty),
          totalSpendExGST: parseFloat(row.total_spend_ex_gst),
          latestUnitPriceExGST: price.unit_price_ex_gst ? parseFloat(price.unit_price_ex_gst) : null,
          latestUnitPriceIncGST: price.unit_price_inc_gst ? parseFloat(price.unit_price_inc_gst) : null,
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
        };
      })
    });
  } catch (err) {
    console.error('[purchase-analytics/products/top]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/prices/trends
router.get('/prices/trends', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code param is required' });

  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const desc = await client.query(
      `SELECT MAX(product_description) AS d FROM product_price_history WHERE user_id=$1 AND product_code=$2`,
      [uid, code]
    );
    const r = await client.query(
      `SELECT recorded_month, AVG(unit_price_ex_gst) AS avg_ex, AVG(unit_price_inc_gst) AS avg_inc
       FROM product_price_history
       WHERE user_id=$1 AND product_code=$2
       GROUP BY recorded_month ORDER BY recorded_month`,
      [uid, code]
    );
    res.json({
      productCode: code,
      productDescription: desc.rows[0]?.d || code,
      points: r.rows.map(row => ({
        month: row.recorded_month,
        avgPriceExGST: parseFloat(row.avg_ex),
        avgPriceIncGST: parseFloat(row.avg_inc),
      }))
    });
  } catch (err) {
    console.error('[purchase-analytics/prices/trends]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/prices/alerts
router.get('/prices/alerts', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const threshold = parseFloat(req.query.threshold) || 10;
  const EXCLUDED = ['1534107-1', '1534109-1'];

  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    // Get first and last price per product
    const r = await client.query(
      `SELECT
        product_code,
        MAX(product_description) AS product_description,
        MAX(category) AS category,
        MIN(recorded_month) AS first_month,
        MAX(recorded_month) AS last_month
       FROM product_price_history
       WHERE user_id=$1 AND product_code != ALL($2::text[])
       GROUP BY product_code
       HAVING COUNT(DISTINCT recorded_month) >= 2`,
      [uid, EXCLUDED]
    );

    const alerts = [];
    for (const row of r.rows) {
      const prices = await client.query(
        `SELECT unit_price_ex_gst FROM product_price_history
         WHERE user_id=$1 AND product_code=$2 AND recorded_month IN ($3,$4)
         ORDER BY recorded_month`,
        [uid, row.product_code, row.first_month, row.last_month]
      );
      if (prices.rows.length < 2) continue;
      const first = parseFloat(prices.rows[0].unit_price_ex_gst);
      const last = parseFloat(prices.rows[prices.rows.length - 1].unit_price_ex_gst);
      if (!first) continue;
      const changePct = ((last - first) / first) * 100;
      if (Math.abs(changePct) < threshold) continue;
      alerts.push({
        productCode: row.product_code,
        productDescription: row.product_description,
        category: row.category,
        firstMonth: row.first_month,
        lastMonth: row.last_month,
        firstPrice: first,
        lastPrice: last,
        changePercent: parseFloat(changePct.toFixed(1)),
        changeAbs: parseFloat((last - first).toFixed(4)),
        flag: changePct >= 30 ? 'high' : changePct >= 10 ? 'medium' : 'low',
      });
    }
    alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    res.json({ alerts });
  } catch (err) {
    console.error('[purchase-analytics/prices/alerts]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/delivery/monthly
router.get('/delivery/monthly', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const r = await client.query(
      `SELECT
        SUBSTR(invoice_date,1,7) AS month,
        COUNT(*) AS delivery_count,
        COALESCE(SUM(line_total_ex_gst),0) AS total_ex_gst,
        COALESCE(SUM(line_total_inc_gst),0) AS total_inc_gst,
        COALESCE(SUM(CASE WHEN billable_delivery=0 THEN line_total_ex_gst ELSE 0 END),0) AS absorbed_ex_gst,
        COALESCE(SUM(CASE WHEN billable_delivery=1 THEN line_total_ex_gst ELSE 0 END),0) AS billable_ex_gst
       FROM supplier_invoices
       WHERE user_id=$1 AND is_delivery_item=1 AND invoice_type='TAX INVOICE'
       GROUP BY SUBSTR(invoice_date,1,7)
       ORDER BY month`,
      [uid]
    );
    res.json({
      months: r.rows.map(row => ({
        month: row.month,
        deliveryCount: parseInt(row.delivery_count),
        totalExGST: parseFloat(row.total_ex_gst),
        totalIncGST: parseFloat(row.total_inc_gst),
        absorbedExGST: parseFloat(row.absorbed_ex_gst),
        billableExGST: parseFloat(row.billable_ex_gst),
      }))
    });
  } catch (err) {
    console.error('[purchase-analytics/delivery/monthly]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/purchase-analytics/delivery/summary
router.get('/delivery/summary', async (req, res) => {
  await ensurePurchaseAnalyticsTables();
  const client = await pool.connect();
  try {
    const uid = req.user.userId;
    const r = await client.query(
      `SELECT
        COALESCE(SUM(line_total_ex_gst),0) AS total_ex_gst,
        COALESCE(SUM(line_total_inc_gst),0) AS total_inc_gst,
        COUNT(*) AS total_charges,
        COALESCE(SUM(CASE WHEN billable_delivery=0 THEN line_total_ex_gst ELSE 0 END),0) AS absorbed,
        COALESCE(SUM(CASE WHEN billable_delivery=1 THEN line_total_ex_gst ELSE 0 END),0) AS billable
       FROM supplier_invoices
       WHERE user_id=$1 AND is_delivery_item=1 AND invoice_type='TAX INVOICE'`,
      [uid]
    );
    const row = r.rows[0];
    const total = parseFloat(row.total_ex_gst) || 1;
    const months = await client.query(
      `SELECT COUNT(DISTINCT SUBSTR(invoice_date,1,7)) AS m FROM supplier_invoices WHERE user_id=$1 AND is_delivery_item=1 AND invoice_type='TAX INVOICE'`,
      [uid]
    );
    const monthCount = parseInt(months.rows[0].m) || 1;
    res.json({
      totalExGST: parseFloat(row.total_ex_gst),
      totalIncGST: parseFloat(row.total_inc_gst),
      avgMonthlyExGST: parseFloat(row.total_ex_gst) / monthCount,
      totalCharges: parseInt(row.total_charges),
      absorbedPct: parseFloat(((parseFloat(row.absorbed) / total) * 100).toFixed(1)),
      billablePct: parseFloat(((parseFloat(row.billable) / total) * 100).toFixed(1)),
    });
  } catch (err) {
    console.error('[purchase-analytics/delivery/summary]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory"
git add server/src/routes/purchaseAnalytics.js
git commit -m "feat: add purchase analytics API routes"
```

---

## Task 7: Wire new routes into app.js

**Files:**
- Modify: `server/src/app.js`

- [ ] **Step 1: Add imports after the existing voiceNotesRoutes import (line 47)**

Add these two lines:
```js
import importRoutes from './routes/import.js';
import purchaseAnalyticsRoutes from './routes/purchaseAnalytics.js';
```

- [ ] **Step 2: Mount after the voice-notes route (after line 287)**

```js
  app.use('/api/import', importRoutes);
  app.use('/api/purchase-analytics', purchaseAnalyticsRoutes);
```

- [ ] **Step 3: Restart server and smoke-test**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory/server" && npm run dev &
# Wait a few seconds, then:
curl -s http://localhost:5001/health | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).status))"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory"
git add server/src/app.js
git commit -m "feat: mount import and purchase-analytics routes in app.js"
```

---

## Task 8: Frontend API client

**Files:**
- Create: `lib/purchaseAnalyticsAPI.ts`

- [ ] **Step 1: Create the client**

```ts
// lib/purchaseAnalyticsAPI.ts
import api from './api';

export interface PASummary {
  totalGrossExGST: number;
  totalNetExGST: number;
  totalIncGST: number;
  totalInvoices: number;
  totalUniqueProducts: number;
  totalDeliveryExGST: number;
  avgMonthlyGross: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface PAMonthlySpend {
  month: string;
  grossExGST: number;
  netExGST: number;
  grossIncGST: number;
  credits: number;
  invoiceCount: number;
  lineItems: number;
}

export interface PAAnnualSpend {
  year: string;
  grossExGST: number;
  netExGST: number;
  grossIncGST: number;
  credits: number;
  invoiceCount: number;
}

export interface PACategory {
  category: string;
  totalExGST: number;
  lineItems: number;
  uniqueProducts: number;
  percentOfTotal: number;
}

export interface PAProduct {
  productCode: string;
  productDescription: string;
  category: string;
  unit: string;
  timesOrdered: number;
  totalQty: number;
  totalSpendExGST: number;
  latestUnitPriceExGST: number | null;
  latestUnitPriceIncGST: number | null;
  firstSeen: string;
  lastSeen: string;
}

export interface PAPriceTrend {
  productCode: string;
  productDescription: string;
  points: Array<{ month: string; avgPriceExGST: number; avgPriceIncGST: number }>;
}

export interface PAPriceAlert {
  productCode: string;
  productDescription: string;
  category: string;
  firstMonth: string;
  lastMonth: string;
  firstPrice: number;
  lastPrice: number;
  changePercent: number;
  changeAbs: number;
  flag: 'high' | 'medium' | 'low';
}

export interface PADeliveryMonth {
  month: string;
  deliveryCount: number;
  totalExGST: number;
  totalIncGST: number;
  absorbedExGST: number;
  billableExGST: number;
}

export interface PADeliverySummary {
  totalExGST: number;
  totalIncGST: number;
  avgMonthlyExGST: number;
  totalCharges: number;
  absorbedPct: number;
  billablePct: number;
}

export interface ImportBatch {
  id: string;
  filename: string;
  imported_at: string;
  row_count: number;
  invoice_count: number;
  gross_total_ex_gst: number;
  credit_total_ex_gst: number;
  status: string;
}

export interface ImportSummary {
  batchId: string;
  rowCount: number;
  invoiceCount: number;
  creditCount: number;
  skippedCount: number;
  grossTotal: number;
  creditTotal: number;
}

function fmt(p: Record<string, string | number | undefined>) {
  const q = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

export const purchaseAnalyticsAPI = {
  getSummary: async (): Promise<PASummary> => {
    const { data } = await api.get('/purchase-analytics/summary');
    return data;
  },

  getMonthlySpend: async (params?: { year?: number; from?: string; to?: string }): Promise<{ months: PAMonthlySpend[] }> => {
    const { data } = await api.get(`/purchase-analytics/spend/monthly${fmt(params || {})}`);
    return data;
  },

  getAnnualSpend: async (): Promise<{ years: PAAnnualSpend[] }> => {
    const { data } = await api.get('/purchase-analytics/spend/annual');
    return data;
  },

  getCategories: async (params?: { from?: string; to?: string }): Promise<{ categories: PACategory[] }> => {
    const { data } = await api.get(`/purchase-analytics/categories${fmt(params || {})}`);
    return data;
  },

  getTopProducts: async (params?: { limit?: number; sortBy?: string; from?: string; to?: string }): Promise<{ products: PAProduct[] }> => {
    const { data } = await api.get(`/purchase-analytics/products/top${fmt(params || {})}`);
    return data;
  },

  getPriceTrends: async (code: string): Promise<PAPriceTrend> => {
    const { data } = await api.get(`/purchase-analytics/prices/trends?code=${encodeURIComponent(code)}`);
    return data;
  },

  getPriceAlerts: async (threshold = 10): Promise<{ alerts: PAPriceAlert[] }> => {
    const { data } = await api.get(`/purchase-analytics/prices/alerts?threshold=${threshold}`);
    return data;
  },

  getDeliveryMonthly: async (): Promise<{ months: PADeliveryMonth[] }> => {
    const { data } = await api.get('/purchase-analytics/delivery/monthly');
    return data;
  },

  getDeliverySummary: async (): Promise<PADeliverySummary> => {
    const { data } = await api.get('/purchase-analytics/delivery/summary');
    return data;
  },

  importReece: async (file: File): Promise<ImportSummary> => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/import/reece', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getBatches: async (): Promise<{ batches: ImportBatch[] }> => {
    const { data } = await api.get('/import/batches');
    return data;
  },

  deleteBatch: async (id: string): Promise<void> => {
    await api.delete(`/import/batches/${id}`);
  },
};

export default purchaseAnalyticsAPI;
```

---

## Task 9: StatCard component

**Files:**
- Create: `components/analytics/StatCard.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/analytics/StatCard.tsx
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string; // e.g. '+12%' or '-5%'
}

export function StatCard({ label, value, sub, trend }: StatCardProps) {
  const isPositive = trend?.startsWith('+');
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      <div className="flex items-center gap-2 mt-1">
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
        {trend && (
          <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## Task 10: AnalyticsDashboard container

**Files:**
- Create: `components/analytics/AnalyticsDashboard.tsx`

- [ ] **Step 1: Create container component**

```tsx
// components/analytics/AnalyticsDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Upload, RefreshCw } from 'lucide-react';
import { StatCard } from './StatCard';
import { SpendOverview } from './SpendOverview';
import { InventoryInsights } from './InventoryInsights';
import { PriceTrends } from './PriceTrends';
import { DeliveryCosts } from './DeliveryCosts';
import { ReeceImportModal } from '../import/ReeceImportModal';
import { purchaseAnalyticsAPI, type PASummary } from '../../lib/purchaseAnalyticsAPI';
import { format, subMonths } from 'date-fns';

type Tab = 'spend' | 'inventory' | 'price-trends' | 'delivery';

const TABS: { id: Tab; label: string }[] = [
  { id: 'spend', label: 'Spend Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'price-trends', label: 'Price Trends' },
  { id: 'delivery', label: 'Delivery Costs' },
];

function getTabFromUrl(): Tab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as Tab;
  return TABS.some(t => t.id === tab) ? tab : 'spend';
}

function setTabInUrl(tab: Tab) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState(null, '', url.toString());
}

function fmtMoney(n?: number) {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromUrl);
  const [summary, setSummary] = useState<PASummary | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange] = useState({
    from: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const loadSummary = useCallback(async () => {
    try {
      const s = await purchaseAnalyticsAPI.getSummary();
      setSummary(s);
    } catch (_) {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setTabInUrl(tab);
  };

  const handleImportSuccess = () => {
    setShowImport(false);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Analytics</h1>
          {summary?.dateFrom && (
            <p className="text-sm text-slate-500 mt-0.5">
              Data from {summary.dateFrom} to {summary.dateTo}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Upload size={14} /> Import Invoices
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Gross Spend" value={fmtMoney(summary?.totalGrossExGST)} sub="ex GST" />
        <StatCard label="Net Spend" value={fmtMoney(summary?.totalNetExGST)} sub="after credits" />
        <StatCard label="Total Invoices" value={summary?.totalInvoices?.toString() ?? '—'} />
        <StatCard label="Avg Monthly" value={fmtMoney(summary?.avgMonthlyGross)} sub="ex GST" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'spend' && <SpendOverview dateRange={dateRange} refreshKey={refreshKey} />}
      {activeTab === 'inventory' && <InventoryInsights dateRange={dateRange} refreshKey={refreshKey} />}
      {activeTab === 'price-trends' && <PriceTrends refreshKey={refreshKey} />}
      {activeTab === 'delivery' && <DeliveryCosts refreshKey={refreshKey} />}

      {showImport && (
        <ReeceImportModal
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
```

---

## Task 11: SpendOverview tab

**Files:**
- Create: `components/analytics/SpendOverview.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/analytics/SpendOverview.tsx
import React, { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { purchaseAnalyticsAPI, type PAMonthlySpend, type PAAnnualSpend, type PACategory } from '../../lib/purchaseAnalyticsAPI';

const CATEGORY_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899',
  '#14b8a6','#f97316','#64748b','#0ea5e9','#a855f7','#84cc16',
];

const YEAR_COLORS: Record<string, string> = { '2024': '#3b82f6', '2025': '#10b981', '2026': '#8b5cf6' };

interface Props { dateRange: { from: string; to: string }; refreshKey: number; }

function fmtK(v: number) { return `$${(v / 1000).toFixed(0)}k`; }

export function SpendOverview({ refreshKey }: Props) {
  const [monthly, setMonthly] = useState<PAMonthlySpend[]>([]);
  const [annual, setAnnual] = useState<PAAnnualSpend[]>([]);
  const [categories, setCategories] = useState<PACategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getMonthlySpend(),
      purchaseAnalyticsAPI.getAnnualSpend(),
      purchaseAnalyticsAPI.getCategories(),
    ]).then(([m, a, c]) => {
      setMonthly(m.months);
      setAnnual(a.years);
      setCategories(c.categories);
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const monthlyData = monthly.map(m => ({
    month: m.month.slice(5, 7) + '/' + m.month.slice(2, 4),
    gross: m.grossExGST,
    net: m.netExGST,
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Monthly bar + line */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Monthly Spend (ex GST)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            <Legend />
            <Bar dataKey="gross" name="Gross" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Line dataKey="net" name="Net (after credits)" stroke="#10b981" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Category donut + legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Spend by Category</h2>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <ResponsiveContainer width={240} height={240}>
            <PieChart>
              <Pie data={categories} dataKey="totalExGST" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-y-2 gap-x-4 flex-1">
            {categories.map((cat, i) => (
              <div key={cat.category} className="flex items-center gap-2 min-w-[160px]">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                <span className="text-xs text-slate-600 truncate">{cat.category}</span>
                <span className="text-xs font-medium text-slate-800 ml-auto">{cat.percentOfTotal}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annual comparison */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Annual Comparison</h2>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={annual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            <Bar dataKey="grossExGST" name="Gross ex GST" radius={[4, 4, 0, 0]}>
              {annual.map(row => (
                <Cell key={row.year} fill={YEAR_COLORS[row.year] || '#64748b'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

---

## Task 12: InventoryInsights tab

**Files:**
- Create: `components/analytics/InventoryInsights.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/analytics/InventoryInsights.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { purchaseAnalyticsAPI, type PAProduct } from '../../lib/purchaseAnalyticsAPI';

interface Props { dateRange: { from: string; to: string }; refreshKey: number; }

type SortKey = 'timesOrdered' | 'totalSpendExGST';

export function InventoryInsights({ refreshKey }: Props) {
  const [products, setProducts] = useState<PAProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('timesOrdered');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    purchaseAnalyticsAPI.getTopProducts({ limit: 100, sortBy: sortKey })
      .then(r => setProducts(r.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey, sortKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const barData = products.slice(0, 15).map(p => ({
    name: p.productDescription.slice(0, 38),
    orders: p.timesOrdered,
  }));

  const maxSpend = Math.max(...products.map(p => p.totalSpendExGST), 1);
  const paged = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Top 15 horizontal bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Top 15 Products by Order Frequency</h2>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Product table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-600">All Products</h2>
          <div className="flex gap-2 text-xs text-slate-500">
            Sort by:
            <button onClick={() => setSortKey('timesOrdered')} className={`px-2 py-0.5 rounded ${sortKey === 'timesOrdered' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:text-slate-700'}`}>Orders</button>
            <button onClick={() => setSortKey('totalSpendExGST')} className={`px-2 py-0.5 rounded ${sortKey === 'totalSpendExGST' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:text-slate-700'}`}>Spend</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Spend ex GST</th>
                <th className="px-3 py-2 text-right">Latest Price</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.productCode} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{p.productDescription}</div>
                    <div className="text-xs text-slate-400">{p.productCode}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.category}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{p.timesOrdered}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{p.totalQty.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 bg-blue-100 rounded-full w-16 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(p.totalSpendExGST / maxSpend) * 100}%` }} />
                      </div>
                      <span className="text-slate-700 tabular-nums">${p.totalSpendExGST.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {p.latestUnitPriceExGST !== null ? `$${p.latestUnitPriceExGST.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">‹ Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">Next ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Task 13: PriceTrends tab

**Files:**
- Create: `components/analytics/PriceTrends.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/analytics/PriceTrends.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { purchaseAnalyticsAPI, type PAProduct, type PAPriceTrend, type PAPriceAlert } from '../../lib/purchaseAnalyticsAPI';

interface Props { refreshKey: number; }

export function PriceTrends({ refreshKey }: Props) {
  const [products, setProducts] = useState<PAProduct[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [trend, setTrend] = useState<PAPriceTrend | null>(null);
  const [alerts, setAlerts] = useState<PAPriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getTopProducts({ limit: 20, sortBy: 'orders' }),
      purchaseAnalyticsAPI.getPriceAlerts(10),
    ]).then(([p, a]) => {
      setProducts(p.products);
      setAlerts(a.alerts);
      if (p.products.length && !selectedCode) {
        setSelectedCode(p.products[0].productCode);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedCode) return;
    purchaseAnalyticsAPI.getPriceTrends(selectedCode).then(setTrend).catch(console.error);
  }, [selectedCode]);

  const lineColor = () => {
    if (!trend || trend.points.length < 2) return '#64748b';
    const first = trend.points[0].avgPriceExGST;
    const last = trend.points[trend.points.length - 1].avgPriceExGST;
    const pct = ((last - first) / first) * 100;
    if (pct > 10) return '#ef4444';
    if (pct > 5) return '#f59e0b';
    return '#10b981';
  };

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Product selector + chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-600">Price Trend</h2>
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            className="ml-auto text-sm border border-slate-200 rounded-lg px-3 py-1.5 max-w-sm"
          >
            {products.map(p => (
              <option key={p.productCode} value={p.productCode}>
                {p.productDescription.slice(0, 60)}
              </option>
            ))}
          </select>
        </div>
        {trend && trend.points.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v.toFixed(2)}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Line dataKey="avgPriceExGST" name="Unit Price (ex GST)" stroke={lineColor()} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-400 text-sm py-8 text-center">No price history for this product yet.</div>
        )}
      </div>

      {/* Price alerts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-600">Price Alerts (≥10% change)</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center">No significant price changes detected.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">First Price</th>
                <th className="px-3 py-2 text-right">Latest Price</th>
                <th className="px-3 py-2 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.productCode} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{a.productDescription}</div>
                    <div className="text-xs text-slate-400">{a.productCode}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{a.category}</td>
                  <td className="px-3 py-2 text-right text-slate-500">${a.firstPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">${a.lastPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      a.flag === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.changePercent > 0 ? '+' : ''}{a.changePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

---

## Task 14: DeliveryCosts tab

**Files:**
- Create: `components/analytics/DeliveryCosts.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/analytics/DeliveryCosts.tsx
import React, { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { purchaseAnalyticsAPI, type PADeliveryMonth, type PADeliverySummary } from '../../lib/purchaseAnalyticsAPI';

interface Props { refreshKey: number; }

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export function DeliveryCosts({ refreshKey }: Props) {
  const [months, setMonths] = useState<PADeliveryMonth[]>([]);
  const [summary, setSummary] = useState<PADeliverySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getDeliveryMonthly(),
      purchaseAnalyticsAPI.getDeliverySummary(),
    ]).then(([m, s]) => {
      setMonths(m.months);
      setSummary(s);
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const chartData = months.map(m => ({
    month: m.month.slice(5, 7) + '/' + m.month.slice(2, 4),
    cost: m.totalExGST,
    count: m.deliveryCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Dual-axis chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Monthly Delivery Cost & Count</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="cost" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="cost" dataKey="cost" name="Cost (ex GST)" fill="#f87171" radius={[3, 3, 0, 0]} />
            <Line yAxisId="count" dataKey="count" name="Deliveries" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Delivery Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total delivery charges</dt><dd className="font-medium">{fmtMoney(summary.totalExGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total charges (inc GST)</dt><dd className="font-medium">{fmtMoney(summary.totalIncGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Avg monthly</dt><dd className="font-medium">{fmtMoney(summary.avgMonthlyExGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total line items</dt><dd className="font-medium">{summary.totalCharges}</dd></div>
            </dl>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Billable vs Absorbed</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Absorbed (business cost)</dt><dd className="font-medium text-amber-600">{summary.absorbedPct}%</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Billable (passed through)</dt><dd className="font-medium text-emerald-600">{summary.billablePct}%</dd></div>
            </dl>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${summary.billablePct}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 15: Import modal and history

**Files:**
- Create: `components/import/ReeceImportModal.tsx`
- Create: `components/import/ImportHistory.tsx`

- [ ] **Step 1: Create ReeceImportModal**

```tsx
// components/import/ReeceImportModal.tsx
import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { purchaseAnalyticsAPI, type ImportSummary } from '../../lib/purchaseAnalyticsAPI';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ReeceImportModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { setError('Only CSV files are accepted'); return; }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await purchaseAnalyticsAPI.importReece(file);
      setResult(summary);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Import failed. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Import Reece Invoices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            Invoice (Cash) rows will be automatically excluded.
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Upload size={28} className="mx-auto text-slate-400 mb-2" />
              {file ? (
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Drag & drop or click to select</p>
                  <p className="text-xs text-slate-400 mt-1">Reece "Detailed with Full Codes" CSV, max 10 MB</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Success summary */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-700 font-medium mb-3">
                <CheckCircle size={16} /> Import complete
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-slate-500">Invoices imported</dt><dd className="font-medium text-slate-800">{result.invoiceCount}</dd>
                <dt className="text-slate-500">Credits found</dt><dd className="font-medium text-slate-800">{result.creditCount}</dd>
                <dt className="text-slate-500">Rows skipped</dt><dd className="font-medium text-slate-800">{result.skippedCount}</dd>
                <dt className="text-slate-500">Total spend (ex GST)</dt>
                <dd className="font-medium text-slate-800">${result.grossTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</dd>
              </dl>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          {result ? (
            <button onClick={onSuccess} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!file || loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing…' : 'Import invoices'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ImportHistory**

```tsx
// components/import/ImportHistory.tsx
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { purchaseAnalyticsAPI, type ImportBatch } from '../../lib/purchaseAnalyticsAPI';

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    purchaseAnalyticsAPI.getBatches()
      .then(r => setBatches(r.batches))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this import batch and all its invoice data?')) return;
    await purchaseAnalyticsAPI.deleteBatch(id);
    load();
  };

  if (loading) return <div className="text-slate-400 text-sm py-4 text-center">Loading…</div>;

  if (!batches.length) return <div className="text-slate-400 text-sm py-4 text-center">No imports yet.</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-600">Import History</h3>
        <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw size={14} /></button>
      </div>
      {batches.map(b => (
        <div key={b.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <div>
            <div className="font-medium text-slate-700">{b.filename}</div>
            <div className="text-xs text-slate-400">
              {new Date(b.imported_at).toLocaleDateString('en-AU')} · {b.invoice_count} invoices · ${Number(b.gross_total_ex_gst).toLocaleString('en-AU', { maximumFractionDigits: 0 })} ex GST
            </div>
          </div>
          <button onClick={() => handleDelete(b.id)} className="text-slate-300 hover:text-red-500 ml-3">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Task 16: PurchaseAnalyticsView and navigation wiring

**Files:**
- Create: `views/PurchaseAnalyticsView.tsx`
- Modify: `app/lazyViews.ts`
- Modify: `app/AppViewRouter.tsx`
- Modify: `components/Navigation.tsx`

- [ ] **Step 1: Create the view**

```tsx
// views/PurchaseAnalyticsView.tsx
import React from 'react';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { ImportHistory } from '../components/import/ImportHistory';

export function PurchaseAnalyticsView() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-slate-50 p-4">
      <div className="flex-1 min-w-0">
        <AnalyticsDashboard />
      </div>
      <div className="w-full lg:w-72 flex-shrink-0">
        <ImportHistory />
      </div>
    </div>
  );
}

export default PurchaseAnalyticsView;
```

- [ ] **Step 2: Add to lazyViews.ts** — add after the last existing export:

```ts
export const PurchaseAnalyticsView = lazy(() => import('../views/PurchaseAnalyticsView'));
```

- [ ] **Step 3: Add `purchase-analytics` to NavTab union in Navigation.tsx**

Locate the `NavTab` type (line 19–25) and add `'purchase-analytics'` to the union:

```ts
export type NavTab =
  | 'dashboard' | 'inventory' | 'calendar' | 'job-planning' | 'project-stages' | 'contacts'
  | 'ordering' | 'history' | 'approvals' | 'purchase-orders' | 'stock-returns'
  | 'supplier-dashboard' | 'quotes' | 'invoices' | 'reports' | 'team'
  | 'settings' | 'analytics' | 'ai-forecast' | 'workflows' | 'kits' | 'assets'
  | 'performance' | 'leads' | 'subcontractors' | 'van-stock' | 'sync-dashboard'
  | 'franchise' | 'developer' | 'purchase-analytics';
```

- [ ] **Step 4: Add to Insights group in NAVIGATION_CONFIG** (around line 125)

```ts
  { id: 'purchase-analytics', label: 'Purchase Analytics' },
```

Add it after `{ id: 'ai-forecast', label: 'AI Forecast' }`.

- [ ] **Step 5: Add to AppViewRouter.tsx** — add before the `{activeTab === 'settings'` line:

```tsx
      {activeTab === 'purchase-analytics' && <PurchaseAnalyticsView />}
```

Also add `PurchaseAnalyticsView` to the import from `'./lazyViews'`.

- [ ] **Step 6: Commit all frontend work**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory"
git add lib/purchaseAnalyticsAPI.ts components/analytics/ components/import/ views/PurchaseAnalyticsView.tsx app/lazyViews.ts app/AppViewRouter.tsx components/Navigation.tsx
git commit -m "feat: add Purchase Analytics frontend (dashboard, charts, import modal)"
```

---

## Task 17: Seed script

**Files:**
- Create: `scripts/seedReeceData.js`
- Create: `data/reece/.gitkeep`

- [ ] **Step 1: Create the data folder and gitkeep**

```bash
mkdir -p "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory/data/reece"
touch "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory/data/reece/.gitkeep"
```

- [ ] **Step 2: Create the seed script**

```js
// scripts/seedReeceData.js
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/.env') });

// Must import AFTER dotenv so DB picks up env vars
const { default: pool } = await import('../server/src/config/database.js');
const { ensurePurchaseAnalyticsTables } = await import('../server/src/db/purchaseAnalyticsTables.js');
const { parseCsvFile, importReeceRows } = await import('../server/src/services/reeceImportService.js');

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/reece');

// Use a fixed seed user id (update if your demo user id is different)
const SEED_USER_ID = process.env.SEED_USER_ID || 'seed';

async function main() {
  await ensurePurchaseAnalyticsTables();

  const files = (await readdir(DATA_DIR)).filter(f => f.endsWith('.csv'));
  if (!files.length) {
    console.log('No CSV files found in data/reece/. Add files and re-run.');
    process.exit(0);
  }

  let totalRows = 0;
  let totalInvoices = 0;

  for (const filename of files) {
    const filePath = path.join(DATA_DIR, filename);

    // Check for existing batch with this filename (idempotency)
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id FROM import_batches WHERE filename=$1 AND user_id=$2`,
        [filename, SEED_USER_ID]
      );
      if (existing.rows.length) {
        console.log(`⏭  Skipping ${filename} (already imported)`);
        continue;
      }

      console.log(`⬆  Importing ${filename}…`);
      const rows = await parseCsvFile(filePath);
      const summary = await importReeceRows(client, SEED_USER_ID, filename, rows);
      console.log(`   ✓ ${summary.invoiceCount} invoices, ${summary.creditCount} credits, ${summary.skippedCount} skipped, $${summary.grossTotal.toFixed(0)} gross`);
      totalRows += summary.rowCount;
      totalInvoices += summary.invoiceCount;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone. ${files.length} file(s) processed. ${totalInvoices} total invoices imported.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/ryan_sinclair/Documents/GitHub/PlumbPro Inventory/PlumbPro-Inventory"
git add scripts/seedReeceData.js data/reece/.gitkeep
git commit -m "feat: add Reece seed script and data/reece/ folder"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `curl -s -X POST http://localhost:5001/api/import/reece -H "Authorization: Bearer $TOKEN" -F "file=@test.csv"` → returns batchId + counts
- [ ] `curl -s http://localhost:5001/api/purchase-analytics/summary -H "Authorization: Bearer $TOKEN"` → returns totalGrossExGST etc.
- [ ] Upload a non-CSV file to import endpoint → returns 400
- [ ] Open browser → navigate to "Purchase Analytics" tab → dashboard renders
- [ ] Import modal opens, drag-and-drop zone visible, warning banner shown
- [ ] After import, analytics refresh and show data
- [ ] Delete a batch → data removed
- [ ] `node scripts/seedReeceData.js` (with CSV in data/reece/) → imports data; re-run → skips
