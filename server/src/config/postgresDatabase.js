export async function createPostgresDatabase() {
  try {
    const { default: pg } = await import('pg');
    const { Pool: PgPool } = pg;

    const pool = new PgPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'plumbpro_inventory',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    pool.on('connect', () => {
      console.log('✅ PostgreSQL connected successfully');
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected PostgreSQL error:', err);
    });

    return { pool, sqliteDb: null };
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
}
