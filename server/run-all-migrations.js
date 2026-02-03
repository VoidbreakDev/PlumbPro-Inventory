import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaFiles = [
  'src/db/schema.sql',                    // Base schema
  'src/db/quotes-schema.sql',             // Quotes system
  'src/db/invoices-schema.sql',           // Invoices system
  'src/db/customer-enhancements-schema.sql', // Customer enhancements
  'src/db/notifications-schema.sql',      // Notifications
  'src/db/locations-schema.sql',          // Multi-location support
  'src/db/smart-ordering-schema.sql',     // Smart ordering
  'src/db/team-management-schema.sql',    // Team management
  'src/db/workflow-schema.sql',           // Workflow automation
  'src/db/mobile-schema.sql',             // Mobile features
  'src/db/approvals-schema.sql',          // Approval workflows
  'src/db/purchase-orders-schema.sql',    // Purchase orders
  'src/db/stock-returns-schema.sql',      // Stock returns
  'src/db/stock-transfers-schema.sql',    // Stock transfers
  'src/db/van-stock-schema.sql',          // Van stock
  'src/db/xero-integration-schema.sql',   // Xero integration
  'src/db/advanced-analytics-schema.sql', // Advanced analytics
  'src/db/white-label-schema.sql',        // White label
  'src/db/franchise-schema.sql',          // Franchise
  'src/db/portal-schema.sql',             // Customer portal
  'src/db/api-access-schema.sql',         // API access
  'src/db/permissions-schema.sql',        // Advanced permissions
];

async function runAllMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting comprehensive database migration...\n');

    for (const file of schemaFiles) {
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${file} (not found)`);
        continue;
      }

      try {
        const schema = fs.readFileSync(filePath, 'utf8');
        await client.query(schema);
        console.log(`✅ Applied: ${file}`);
      } catch (error) {
        console.error(`❌ Failed: ${file}`);
        console.error(`   Error: ${error.message}`);
        // Continue with other files instead of stopping
      }
    }

    console.log('\n🎉 Migration process completed!');
    console.log('\n📊 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Refresh your browser page');
    console.log('   3. The contacts should load without errors');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runAllMigrations().catch(console.error);
