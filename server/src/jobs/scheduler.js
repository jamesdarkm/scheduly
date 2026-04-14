const cron = require('node-cron');
const { runPublishJob } = require('./publishJob');
const { runTokenRefreshJob } = require('./tokenRefreshJob');
const { runAnalyticsFetchJob } = require('./analyticsFetchJob');
const logger = require('../utils/logger');

function startScheduler() {
  // Check for due posts every minute
  cron.schedule('* * * * *', async () => {
    logger.debug('Scheduler: running publish job');
    await runPublishJob();
  });

  // Refresh expiring tokens daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Scheduler: running token refresh job');
    await runTokenRefreshJob();
  });

  // Fetch analytics for published posts daily at 6 AM
  cron.schedule('0 6 * * *', async () => {
    logger.info('Scheduler: running analytics fetch job');
    await runAnalyticsFetchJob();
  });

  logger.info('Scheduler started: publish (every min), token refresh (3 AM), analytics (6 AM)');
}

module.exports = { startScheduler };
