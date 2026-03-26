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
