const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'dmm_scheduly',
  });

  // Check if admin already exists
  const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', ['admin@dmm.com']);
  if (existing.length > 0) {
    console.log('Admin user already exists. Skipping seed.');
    await connection.end();
    return;
  }

  const hash = await bcrypt.hash('Admin@123', 12);
  await connection.execute(
    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
    ['admin@dmm.com', hash, 'Admin', 'User', 'admin']
  );

  console.log('Default admin user created:');
  console.log('  Email: admin@dmm.com');
  console.log('  Password: Admin@123');
  console.log('  Role: admin');

  await connection.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
