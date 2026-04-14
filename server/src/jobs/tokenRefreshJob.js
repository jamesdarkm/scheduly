const pool = require('../config/db');
const { refreshLongLivedToken } = require('../services/facebook.service');
const { encrypt } = require('../services/token.service');
const logger = require('../utils/logger');

async function runTokenRefreshJob() {
  try {
    // Find tokens expiring within 7 days
    const [expiring] = await pool.execute(
      `SELECT id, platform, account_name, access_token, token_expires_at
       FROM social_accounts
       WHERE is_active = 1
         AND token_expires_at IS NOT NULL
         AND token_expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)`
    );

    if (expiring.length === 0) {
      logger.debug('Token refresh: no tokens need refreshing');
      return;
    }

    logger.info(`Token refresh: found ${expiring.length} token(s) expiring soon`);

    for (const account of expiring) {
      try {
        const { accessToken, expiresIn } = await refreshLongLivedToken(account.access_token);
        const newExpiry = new Date(Date.now() + expiresIn * 1000);

        await pool.execute(
          'UPDATE social_accounts SET access_token = ?, token_expires_at = ? WHERE id = ?',
          [accessToken, newExpiry, account.id]
        );

        logger.info(`Token refresh: refreshed token for ${account.account_name} (expires ${newExpiry.toISOString()})`);
      } catch (err) {
        logger.error(`Token refresh: failed for account ${account.id} (${account.account_name}): ${err.message}`);
      }
    }
  } catch (err) {
    logger.error('Token refresh job: fatal error', { error: err.message });
  }
}

module.exports = { runTokenRefreshJob };
