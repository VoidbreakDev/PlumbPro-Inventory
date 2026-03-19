import dotenv from 'dotenv';
import { createPostgresDatabase } from './postgresDatabase.js';
import { createSqliteDatabase } from './sqliteDatabase.js';

dotenv.config();

const dbType = process.env.DB_TYPE || 'postgres';
let pool;
let sqliteDb = null;

// Initialize database based on type
async function initDatabase() {
  if (dbType === 'sqlite') {
    const result = await createSqliteDatabase();
    pool = result.pool;
    sqliteDb = result.sqliteDb;
  } else {
    const result = await createPostgresDatabase();
    pool = result.pool;
    sqliteDb = result.sqliteDb;
  }
}

// Initialize database
await initDatabase();

export default pool;
export { dbType, sqliteDb };
