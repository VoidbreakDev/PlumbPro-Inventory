/**
 * Initialize notifications schema (email_queue table)
 * Run this if you're getting "email_queue does not exist" errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initNotifications() {
  try {
    console.log('🔧 Initializing notifications schema...');
    
    // Read the notifications schema SQL
    const schemaPath = path.join(__dirname, 'notifications-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the SQL
    await pool.query(schemaSQL);
    
    console.log('✅ Notifications schema initialized successfully!');
    console.log('   - email_queue table created');
    console.log('   - Indexes created');
    
  } catch (error) {
    console.error('❌ Failed to initialize notifications schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initNotifications();
