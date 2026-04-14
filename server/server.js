const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { startScheduler } = require('./src/jobs/scheduler');

app.listen(env.port, () => {
  logger.info(`DMM Scheduly server running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);

  // Start background job scheduler
  startScheduler();
});
