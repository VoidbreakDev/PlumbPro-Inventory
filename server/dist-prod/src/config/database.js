import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbType = process.env.DB_TYPE || 'postgres';
let pool;
let sqliteDb = null;

// Initialize database based on type
async function initDatabase() {
  if (dbType === 'sqlite') {
    // SQLite mode for desktop app
    try {
      const { default: Database } = await import('better-sqlite3');
      const fs = await import('fs');
      
      const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'plumbpro.db');
      
      // Ensure directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      sqliteDb = new Database(dbPath);
      console.log('✅ SQLite database connected:', dbPath);
      
      // Enable WAL mode for better concurrency
      sqliteDb.pragma('journal_mode = WAL');
      
      // Initialize SQLite schema
      initSQLiteSchema(sqliteDb);
      
      // Create SQLite-compatible pool interface
      pool = {
        query: async (text, params) => {
          try {
            // Convert PostgreSQL $1, $2 params to ? for SQLite
            const sqliteText = text.replace(/\$\d+/g, '?');
            const stmt = sqliteDb.prepare(sqliteText);
            
            if (text.trim().toLowerCase().startsWith('select')) {
              const rows = stmt.all(...(params || []));
              return { rows, rowCount: rows.length };
            } else {
              const result = stmt.run(...(params || []));
              return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
            }
          } catch (err) {
            console.error('SQLite query error:', err);
            console.error('Query:', text);
            console.error('Params:', params);
            throw err;
          }
        },
        // Add connect method for compatibility with pg pool
        connect: async () => {
          return {
            query: async (text, params) => {
              return pool.query(text, params);
            },
            release: () => {
              // SQLite doesn't need explicit release, but pg does
            }
          };
        },
        on: () => {}, // No-op for events
        end: async () => {
          if (sqliteDb) {
            sqliteDb.close();
          }
        }
      };
    } catch (error) {
      console.error('❌ SQLite connection failed:', error);
      throw error;
    }
  } else {
    // PostgreSQL mode (default)
    try {
      const { default: pg } = await import('pg');
      const { Pool: PgPool } = pg;
      
      pool = new PgPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'plumbpro_inventory',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      pool.on('connect', () => {
        console.log('✅ PostgreSQL connected successfully');
      });

      pool.on('error', (err) => {
        console.error('❌ Unexpected PostgreSQL error:', err);
      });
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error);
      throw error;
    }
  }
}

// Initialize complete SQLite schema
function initSQLiteSchema(db) {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables one by one to handle errors better
  const tables = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'technician',
      company_name TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Categories table
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Contacts table (customers, suppliers)
    `CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      company_name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postcode TEXT,
      abn TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Inventory items table
    `CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      quantity INTEGER DEFAULT 0,
      unit TEXT,
      cost_price REAL,
      sale_price REAL,
      location TEXT,
      min_quantity INTEGER DEFAULT 0,
      max_quantity INTEGER,
      reorder_point INTEGER DEFAULT 0,
      barcode TEXT UNIQUE,
      sku TEXT,
      supplier_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Jobs table
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT UNIQUE,
      customer_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      address TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      assigned_to INTEGER,
      estimated_hours REAL,
      actual_hours REAL,
      quoted_amount REAL,
      actual_amount REAL,
      scheduled_date DATE,
      completed_at DATETIME,
      invoiced INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Job items (materials used)
    `CREATE TABLE IF NOT EXISTS job_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      inventory_item_id INTEGER,
      description TEXT,
      quantity REAL,
      unit_price REAL,
      total REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Quotes table
    `CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT UNIQUE,
      customer_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      address TEXT,
      title TEXT,
      description TEXT,
      subtotal REAL,
      tax REAL,
      total REAL,
      status TEXT DEFAULT 'draft',
      valid_until DATE,
      converted_to_job INTEGER,
      notes TEXT,
      terms TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Quote items
    `CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      item_id INTEGER,
      description TEXT,
      quantity REAL,
      unit_price REAL,
      total REAL,
      item_type TEXT DEFAULT 'labor'
    )`,
    
    // Invoices table
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      job_id INTEGER,
      customer_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      subtotal REAL,
      tax REAL,
      total REAL,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      issue_date DATE,
      due_date DATE,
      paid_at DATETIME,
      xero_invoice_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Invoice items
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL,
      unit_price REAL,
      total REAL
    )`,
    
    // Stock movements
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      from_location TEXT,
      to_location TEXT,
      job_id INTEGER,
      quote_id INTEGER,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Locations
    `CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      type TEXT DEFAULT 'warehouse',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Job templates
    `CREATE TABLE IF NOT EXISTS job_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      estimated_hours REAL,
      default_price REAL,
      category TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Equipment (for assets/vehicles/tools)
    `CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      model TEXT,
      serial_number TEXT,
      registration TEXT,
      purchase_date DATE,
      purchase_price REAL,
      current_value REAL,
      status TEXT DEFAULT 'active',
      assigned_to INTEGER,
      location TEXT,
      notes TEXT,
      last_service_date DATE,
      next_service_date DATE,
      service_interval_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Subcontractors
    `CREATE TABLE IF NOT EXISTS subcontractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER,
      business_name TEXT,
      abn TEXT,
      trade_type TEXT,
      hourly_rate REAL,
      rating REAL,
      insurance_expiry DATE,
      license_expiry DATE,
      compliance_status TEXT DEFAULT 'pending',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Kits (Bill of Materials)
    `CREATE TABLE IF NOT EXISTS kits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      total_cost_price REAL,
      total_sale_price REAL,
      margin_percent REAL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Kit items
    `CREATE TABLE IF NOT EXISTS kit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER NOT NULL,
      inventory_item_id INTEGER,
      quantity REAL NOT NULL,
      unit_cost REAL,
      unit_sale REAL
    )`,
    
    // Purchase orders
    `CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE,
      supplier_id INTEGER,
      status TEXT DEFAULT 'draft',
      subtotal REAL,
      tax REAL,
      shipping REAL,
      total REAL,
      notes TEXT,
      expected_delivery DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Purchase order items
    `CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      inventory_item_id INTEGER,
      description TEXT,
      quantity INTEGER,
      quantity_received INTEGER DEFAULT 0,
      unit_price REAL,
      line_total REAL
    )`,
    
    // Suppliers table (extended contact info)
    `CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER,
      account_number TEXT,
      payment_terms TEXT,
      lead_time_days INTEGER,
      min_order_amount REAL,
      rating REAL,
      is_preferred INTEGER DEFAULT 0
    )`,
    
    // Email queue for notifications
    `CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT,
      template_id TEXT,
      template_data TEXT,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 5,
      scheduled_at DATETIME,
      sent_at DATETIME,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Scheduled tasks
    `CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cron_expression TEXT,
      is_active INTEGER DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Activity log
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  
  // Execute each table creation separately
  for (const sql of tables) {
    try {
      db.exec(sql);
    } catch (err) {
      console.error('Error creating table:', err.message);
      console.error('SQL:', sql.substring(0, 100));
      // Continue with other tables
    }
  }
  
  console.log('✅ SQLite schema initialized');
  
  // Insert default admin user if no users exist
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      db.prepare(`
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('admin@plumbpro.local', hashedPassword, 'Admin', 'User', 'admin');
      
      console.log('✅ Default admin user created (admin@plumbpro.local / admin123)');
    }
  } catch (err) {
    console.error('Error creating admin user:', err.message);
  }
  
  // Insert default location if none exist
  try {
    const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get();
    if (locationCount.count === 0) {
      db.prepare(`
        INSERT INTO locations (name, type) VALUES (?, ?)
      `).run('Main Warehouse', 'warehouse');
      console.log('✅ Default location created');
    }
  } catch (err) {
    console.error('Error creating default location:', err.message);
  }
}

// Initialize database
await initDatabase();

export default pool;
export { dbType, sqliteDb };
