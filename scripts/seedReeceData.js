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
