const pool = require('../config/db');
const { fetchInsightsForTarget } = require('../services/analytics.service');
const logger = require('../utils/logger');

async function runAnalyticsFetchJob() {
  try {
    // Find published post targets that need insights fetched
    // Fetch daily for posts published in the last 7 days, weekly after that
    const [targets] = await pool.execute(
      `SELECT pt.id, pt.post_id, pt.platform_post_id, p.published_at
       FROM post_targets pt
       JOIN posts p ON pt.post_id = p.id
       WHERE pt.status = 'published'
         AND pt.platform_post_id IS NOT NULL
         AND (
           (p.published_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
           OR
           (p.published_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND DAYOFWEEK(NOW()) = 2)
         )
       ORDER BY p.published_at DESC
       LIMIT 50`
    );

    if (targets.length === 0) {
      logger.debug('Analytics fetch: no targets to fetch');
      return;
    }

    logger.info(`Analytics fetch: fetching insights for ${targets.length} target(s)`);

    let success = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await fetchInsightsForTarget(target.id);
        success++;
      } catch (err) {
        failed++;
        logger.error(`Analytics fetch: failed for target ${target.id}: ${err.message}`);
      }
    }

    logger.info(`Analytics fetch complete: ${success} success, ${failed} failed`);
  } catch (err) {
    logger.error('Analytics fetch job: fatal error', { error: err.message });
  }
}

module.exports = { runAnalyticsFetchJob };
