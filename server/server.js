const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { startScheduler } = require('./src/jobs/scheduler');

// Ensure upload directories exist (fresh deployments start with an empty filesystem)
const uploadDirs = ['uploads/images', 'uploads/videos', 'uploads/thumbnails'];
for (const dir of uploadDirs) {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
}

// Railway & similar platforms bind to 0.0.0.0; listening on the assigned PORT is required.
app.listen(env.port, '0.0.0.0', () => {
  logger.info(`DMM Scheduly server running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);

  // Start background job scheduler
  startScheduler();
});
