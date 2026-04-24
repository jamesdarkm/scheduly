#!/bin/sh
# Deploy entrypoint: try to run migrations (non-fatal), then always start the server.

echo "=== DMM Scheduly boot ==="
echo "Node: $(node --version)"
echo "PWD : $(pwd)"

# Wait up to ~30s for the DB to accept connections.
# If it never does we still start the server so /api/health responds and the deploy completes.
echo "Waiting for database..."
node -e "
const mysql = require('mysql2/promise');
const env = require('./src/config/env');
(async () => {
  for (let i = 1; i <= 10; i++) {
    try {
      const c = await mysql.createConnection({
        host: env.db.host, port: env.db.port,
        user: env.db.user, password: env.db.password,
      });
      await c.ping();
      await c.end();
      console.log('DB reachable on attempt ' + i + ' (host=' + env.db.host + ')');
      process.exit(0);
    } catch (e) {
      console.log('DB attempt ' + i + ' failed: ' + e.code + ' ' + e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log('DB not reachable after retries — continuing anyway');
  process.exit(0);
})();
"

echo "Running migrations..."
if node migrate.js; then
  echo "Migrations OK"
else
  echo "WARNING: migrations failed — server will still start. Fix DB config and redeploy."
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding admin user..."
  node seed.js || echo "Seed skipped (admin already exists or seed failed)"
fi

echo "Starting server..."
exec node server.js
