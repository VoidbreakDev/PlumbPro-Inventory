import pool from '../config/database.js';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node server/src/db/backfill-null-user-ids.js <user-id>');
  process.exit(1);
}

const tables = [
  'contacts',
  'inventory_items',
  'job_templates',
  'jobs',
  'stock_movements'
];

async function backfillNullUserIds() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updates = [];
    for (const table of tables) {
      const result = await client.query(
        `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`,
        [userId]
      );
      updates.push({ table, count: result.rowCount });
    }

    await client.query('COMMIT');

    console.log('✅ Backfill complete.');
    updates.forEach(({ table, count }) => {
      console.log(` - ${table}: ${count} row(s) updated`);
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillNullUserIds();
