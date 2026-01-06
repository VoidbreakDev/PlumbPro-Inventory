import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixUserIdConstraints() {
  const client = await pool.connect();

  try {
    console.log('🔧 Removing NOT NULL constraints from user_id columns...\n');

    const tables = [
      'contacts',
      'inventory_items',
      'jobs',
      'job_templates',
      'stock_movements'
    ];

    for (const table of tables) {
      try {
        console.log(`📋 Processing table: ${table}`);

        // Check if user_id column exists
        const checkColumn = await client.query(`
          SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'user_id'
        `, [table]);

        if (checkColumn.rows.length > 0) {
          const isNullable = checkColumn.rows[0].is_nullable;
          console.log(`   Current status: ${isNullable === 'YES' ? 'nullable' : 'NOT NULL'}`);

          if (isNullable === 'NO') {
            // Remove NOT NULL constraint
            await client.query(`
              ALTER TABLE ${table}
              ALTER COLUMN user_id DROP NOT NULL
            `);
            console.log(`   ✅ Removed NOT NULL constraint from ${table}.user_id`);
          } else {
            console.log(`   ℹ️  Already nullable, no change needed`);
          }
        } else {
          console.log(`   ⚠️  No user_id column found in ${table}`);
        }

        console.log('');
      } catch (err) {
        console.error(`   ❌ Error processing ${table}:`, err.message);
        console.log('');
      }
    }

    console.log('✅ Database schema updated successfully!');
    console.log('');
    console.log('All user_id columns now allow NULL values for testing.');
    console.log('You can now create contacts, inventory, jobs, etc. without authentication.');

  } catch (error) {
    console.error('❌ Failed to update database schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixUserIdConstraints().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
