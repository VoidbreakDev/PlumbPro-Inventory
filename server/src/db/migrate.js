import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    const existingTables = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'users',
          'contacts',
          'inventory_items',
          'job_templates',
          'jobs',
          'purchase_orders',
          'locations'
        )
    `);

    if (existingTables.rows[0].count > 0 && process.env.ALLOW_DESTRUCTIVE_RESET !== 'true') {
      throw new Error(
        'Refusing to run destructive schema reset against a non-empty database. Use `npm run migrate` for additive upgrades or set ALLOW_DESTRUCTIVE_RESET=true to force a reset.'
      );
    }

    console.log('🚀 Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await client.query(schema);

    console.log('✅ Database migration completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - contacts');
    console.log('   - inventory_items');
    console.log('   - job_templates');
    console.log('   - template_items');
    console.log('   - jobs');
    console.log('   - job_workers');
    console.log('   - job_allocated_items');
    console.log('   - stock_movements');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
