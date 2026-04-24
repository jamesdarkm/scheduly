const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const env = require('./src/config/env');

async function run() {
  console.log(`Connecting to ${env.db.host}:${env.db.port} as ${env.db.user} (db=${env.db.database})...`);

  // Connect without selecting a DB first, so we can CREATE DATABASE if needed.
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  // Create the target DB if the user has permission. If it fails (shared hosting / Railway managed DB),
  // assume the DB already exists and move on.
  try {
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\``);
  } catch (e) {
    console.log(`Note: could not CREATE DATABASE (${e.code}) — assuming it already exists.`);
  }

  await connection.changeUser({ database: env.db.database });
  console.log(`Using database: ${env.db.database}`);

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
