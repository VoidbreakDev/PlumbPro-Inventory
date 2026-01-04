import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seeding...');

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10);

    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, company_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, ['demo@plumbpro.com', hashedPassword, 'Demo User', 'admin', 'PlumbPro Demo']);

    const userId = userResult.rows[0].id;
    console.log('✅ Demo user created (email: demo@plumbpro.com, password: demo123)');

    // Clear existing data for this user
    await client.query('DELETE FROM contacts WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM inventory_items WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM job_templates WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM jobs WHERE user_id = $1', [userId]);

    // Seed contacts
    const contacts = [
      { name: 'PlumbSupply Ltd', type: 'Supplier', email: 'orders@plumbsupply.com', phone: '020 7123 4567', company: 'PlumbSupply Ltd' },
      { name: 'TradeBase', type: 'Supplier', email: 'sales@tradebase.co.uk', phone: '020 7234 5678', company: 'TradeBase' },
      { name: 'John Smith', type: 'Plumber', email: 'john@plumbpro.com', phone: '07700 900123', company: null },
      { name: 'Sarah Jones', type: 'Plumber', email: 'sarah@plumbpro.com', phone: '07700 900456', company: null },
      { name: 'Mike Wilson', type: 'Plumber', email: 'mike@plumbpro.com', phone: '07700 900789', company: null },
    ];

    const contactIds = {};
    for (const contact of contacts) {
      const result = await client.query(`
        INSERT INTO contacts (user_id, name, type, email, phone, company)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [userId, contact.name, contact.type, contact.email, contact.phone, contact.company]);
      contactIds[contact.name] = result.rows[0].id;
    }
    console.log('✅ Contacts seeded');

    // Seed inventory items
    const items = [
      { name: '15mm Copper Pipe (3m)', category: 'Pipes', price: 12.50, quantity: 45, reorderLevel: 20, supplier: 'PlumbSupply Ltd', code: 'CP-15-3M' },
      { name: '22mm Copper Pipe (3m)', category: 'Pipes', price: 18.75, quantity: 8, reorderLevel: 15, supplier: 'PlumbSupply Ltd', code: 'CP-22-3M' },
      { name: 'Basin Waste Kit', category: 'Fittings', price: 8.99, quantity: 25, reorderLevel: 10, supplier: 'TradeBase', code: 'BW-STD' },
      { name: 'Chrome Basin Tap Set', category: 'Taps', price: 45.00, quantity: 12, reorderLevel: 8, supplier: 'TradeBase', code: 'TAP-BAS-CHR' },
      { name: 'PTFE Tape', category: 'Consumables', price: 1.50, quantity: 50, reorderLevel: 20, supplier: 'PlumbSupply Ltd', code: 'PTFE-12M' },
      { name: '15mm Compression Fitting', category: 'Fittings', price: 2.25, quantity: 100, reorderLevel: 30, supplier: 'PlumbSupply Ltd', code: 'CF-15-STR' },
      { name: 'Radiator Valve Set', category: 'Heating', price: 22.50, quantity: 5, reorderLevel: 10, supplier: 'TradeBase', code: 'RV-TRV-15' },
      { name: 'Silicone Sealant', category: 'Consumables', price: 4.99, quantity: 30, reorderLevel: 15, supplier: 'PlumbSupply Ltd', code: 'SIL-CLEAR' },
    ];

    const itemIds = {};
    for (const item of items) {
      const result = await client.query(`
        INSERT INTO inventory_items (user_id, name, category, price, quantity, reorder_level, supplier_id, supplier_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [userId, item.name, item.category, item.price, item.quantity, item.reorderLevel, contactIds[item.supplier], item.code]);
      itemIds[item.name] = result.rows[0].id;
    }
    console.log('✅ Inventory items seeded');

    // Seed job templates
    const templateResult = await client.query(`
      INSERT INTO job_templates (user_id, name)
      VALUES ($1, $2)
      RETURNING id
    `, [userId, 'Basic Leak Repair Kit']);
    const templateId = templateResult.rows[0].id;

    await client.query(`
      INSERT INTO template_items (template_id, item_id, quantity)
      VALUES
        ($1, $2, 2),
        ($3, $4, 5),
        ($5, $6, 1)
    `, [
      templateId, itemIds['15mm Copper Pipe (3m)'],
      templateId, itemIds['15mm Compression Fitting'],
      templateId, itemIds['PTFE Tape']
    ]);
    console.log('✅ Job templates seeded');

    // Seed a sample job
    const jobResult = await client.query(`
      INSERT INTO jobs (user_id, title, builder, job_type, status, date, is_picked)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [userId, 'Kitchen Tap Replacement', 'ABC Builders', 'Installation', 'Scheduled', '2026-01-15', false]);
    const jobId = jobResult.rows[0].id;

    await client.query(`
      INSERT INTO job_workers (job_id, worker_id)
      VALUES ($1, $2)
    `, [jobId, contactIds['John Smith']]);

    await client.query(`
      INSERT INTO job_allocated_items (job_id, item_id, quantity)
      VALUES
        ($1, $2, 1),
        ($3, $4, 1)
    `, [
      jobId, itemIds['Chrome Basin Tap Set'],
      jobId, itemIds['Basin Waste Kit']
    ]);
    console.log('✅ Sample job seeded');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📝 Demo credentials:');
    console.log('   Email: demo@plumbpro.com');
    console.log('   Password: demo123');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
