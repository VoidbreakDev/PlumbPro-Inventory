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
