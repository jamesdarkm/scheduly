#!/bin/sh
set -e

echo "Running migrations..."
node migrate.js

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding admin user..."
  node seed.js || echo "Seed skipped (admin already exists)"
fi

echo "Starting server..."
exec node server.js
