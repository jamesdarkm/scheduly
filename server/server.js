const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { startScheduler } = require('./src/jobs/scheduler');

// Crash reporting — log but don't kill the process so healthchecks stay up.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', { message: err.message, stack: err.stack });
});

// Ensure upload directories exist (fresh deployments start with an empty filesystem)
const uploadDirs = ['uploads/images', 'uploads/videos', 'uploads/thumbnails'];
for (const dir of uploadDirs) {
  const full = path.join(__dirname, dir);
  try {
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      logger.info(`Created upload directory: ${dir}`);
    }
  } catch (e) {
    logger.warn(`Could not create upload directory ${dir}: ${e.message}`);
  }
}

// Railway & similar platforms bind to 0.0.0.0; listening on the assigned PORT is required.
app.listen(env.port, '0.0.0.0', () => {
  logger.info(`DMM Scheduly server running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
  logger.info(`DB host: ${env.db.host}`);

  // Start background job scheduler (don't let scheduler errors kill the process).
  try {
    startScheduler();
  } catch (e) {
    logger.error('Failed to start scheduler:', { error: e.message });
  }
});
