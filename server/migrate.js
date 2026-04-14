const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  // Create database if not exists
  await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'dmm_scheduly'}\``);
  await connection.changeUser({ database: process.env.DB_NAME || 'dmm_scheduly' });

  // Create migrations tracking table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already applied migrations
  const [applied] = await connection.execute('SELECT filename FROM migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  // Read migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  SKIP: ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  APPLYING: ${file}`);
    await connection.query(sql);
    await connection.execute('INSERT INTO migrations (filename) VALUES (?)', [file]);
    count++;
  }

  console.log(`\nDone. ${count} migration(s) applied.`);
  await connection.end();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
