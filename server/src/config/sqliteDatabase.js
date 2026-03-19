import path from 'path';
import { initSQLiteSchema } from './sqliteSchema.js';

export async function createSqliteDatabase() {
  try {
    const { default: Database } = await import('better-sqlite3');
    const fs = await import('fs');

    const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'plumbpro.db');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sqliteDb = new Database(dbPath);
    console.log('✅ SQLite database connected:', dbPath);

    sqliteDb.pragma('journal_mode = WAL');
    initSQLiteSchema(sqliteDb);

    const pool = {
      query: async (text, params) => {
        try {
          const orderedParams = [];
          const sqliteText = text.replace(/\$(\d+)/g, (_match, index) => {
            const paramIndex = Number(index) - 1;
            orderedParams.push((params || [])[paramIndex]);
            return '?';
          });
          const stmt = sqliteDb.prepare(sqliteText);
          const normalized = text.trim().toLowerCase();
          const hasReturning = normalized.includes(' returning ');

          if (normalized.startsWith('select') || hasReturning) {
            const rows = stmt.all(...orderedParams);
            return { rows, rowCount: rows.length };
          }

          const result = stmt.run(...orderedParams);
          return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
        } catch (err) {
          console.error('SQLite query error:', err);
          console.error('Query:', text);
          console.error('Params:', params);
          throw err;
        }
      },
      connect: async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {}
      }),
      on: () => {},
      end: async () => {
        sqliteDb.close();
      }
    };

    return { pool, sqliteDb };
  } catch (error) {
    console.error('❌ SQLite connection failed:', error);
    throw error;
  }
}
