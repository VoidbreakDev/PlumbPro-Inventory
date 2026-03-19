import bcrypt from 'bcryptjs';

export function initSQLiteSchema(db) {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      role TEXT DEFAULT 'technician',
      company_name TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
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
    `CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quote_number TEXT UNIQUE,
      customer_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      job_id TEXT,
      title TEXT,
      description TEXT,
      subtotal REAL,
      tax REAL,
      total REAL,
      status TEXT DEFAULT 'draft',
      valid_from TEXT,
      valid_until TEXT,
      discount_type TEXT,
      discount_value REAL,
      discount_amount REAL,
      tax_rate REAL,
      tax_amount REAL,
      default_markup_percentage REAL,
      terms TEXT,
      notes TEXT,
      customer_notes TEXT,
      requires_approval INTEGER DEFAULT 0,
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      sent_at TEXT,
      viewed_at TEXT,
      responded_at TEXT,
      converted_to_invoice_id TEXT,
      version INTEGER DEFAULT 1,
      parent_quote_id TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      item_type TEXT DEFAULT 'labor',
      inventory_item_id TEXT,
      item_name TEXT,
      item_description TEXT,
      item_code TEXT,
      description TEXT,
      quantity REAL,
      unit TEXT,
      unit_cost REAL,
      markup_percentage REAL,
      unit_price REAL,
      total REAL,
      line_total REAL,
      profit_margin REAL,
      sort_order INTEGER DEFAULT 0,
      group_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
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
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL,
      unit_price REAL,
      total REAL
    )`,
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
    `CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      type TEXT DEFAULT 'warehouse',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
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
    `CREATE TABLE IF NOT EXISTS subcontractors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      address_street TEXT,
      address_city TEXT,
      address_state TEXT,
      address_postcode TEXT,
      address_country TEXT,
      abn TEXT,
      billing_email TEXT,
      website TEXT,
      primary_contact_name TEXT,
      primary_contact_phone TEXT,
      primary_contact_email TEXT,
      tags_json TEXT,
      status TEXT,
      internal_notes TEXT,
      preferred_contact_method TEXT,
      business_name TEXT,
      trading_name TEXT,
      trade_type_json TEXT,
      expertise_json TEXT,
      insurance_documents_json TEXT,
      license_documents_json TEXT,
      availability_status TEXT DEFAULT 'available',
      typical_lead_time INTEGER,
      preferred_job_types_json TEXT,
      service_area_json TEXT,
      hourly_rate REAL,
      daily_rate REAL,
      call_out_fee REAL,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      bank_account_name TEXT,
      bank_bsb TEXT,
      bank_account_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      kit_type TEXT,
      category TEXT,
      status TEXT DEFAULT 'draft',
      color TEXT,
      icon TEXT,
      applicable_job_types_json TEXT,
      items_json TEXT,
      variations_json TEXT,
      total_cost_price REAL,
      total_sell_price REAL,
      total_labor_hours REAL,
      default_markup_percentage REAL,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      average_job_profit REAL,
      average_completion_time REAL,
      tags_json TEXT,
      version INTEGER DEFAULT 1,
      parent_kit_id TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER NOT NULL,
      inventory_item_id INTEGER,
      quantity REAL NOT NULL,
      unit_cost REAL,
      unit_sale REAL
    )`,
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

  for (const sql of tables) {
    try {
      db.exec(sql);
    } catch (err) {
      console.error('Error creating table:', err.message);
      console.error('SQL:', sql.substring(0, 100));
    }
  }

  console.log('✅ SQLite schema initialized');

  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);

      db.prepare(`
        INSERT INTO users (email, password_hash, first_name, last_name, full_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('admin@plumbpro.local', hashedPassword, 'Admin', 'User', 'Admin User', 'admin');

      console.log('✅ Default admin user created (admin@plumbpro.local / admin123)');
    }
  } catch (err) {
    console.error('Error creating admin user:', err.message);
  }

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
