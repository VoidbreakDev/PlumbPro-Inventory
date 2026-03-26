import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const additiveMigrations = [
  path.resolve(__dirname, '../../migrations/006_restore_development_projects_and_inventory_sku.sql'),
  path.resolve(__dirname, '../../migrations/007_restore_permissions_settings_and_van_stock.sql')
];

async function runAdditiveMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting additive database migrations...');

    for (const migrationPath of additiveMigrations) {
      const migrationName = path.basename(migrationPath);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`✅ Applied: ${migrationName}`);
    }

    console.log('🎉 Additive migrations completed successfully!');
  } catch (error) {
    console.error('❌ Additive migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runAdditiveMigrations().catch(console.error);
