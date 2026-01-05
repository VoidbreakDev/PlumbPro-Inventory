const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAdmin() {
    const email = process.argv[2];
    const password = process.argv[3];
    const company = process.argv[4] || '';

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `INSERT INTO users (email, password, company, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, email`,
        [email, hashedPassword, company]
    );

    console.log('Admin user created:', result.rows[0].email);
    await pool.end();
}

createAdmin().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
