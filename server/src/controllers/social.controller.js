const crypto = require('crypto');
const pool = require('../config/db');
const facebookService = require('../services/facebook.service');
const instagramService = require('../services/instagram.service');
const { decrypt } = require('../services/token.service');
const logger = require('../utils/logger');

// In-memory store for CSRF state tokens (adequate for ~20 users)
const pendingStates = new Map();

async function listAccounts(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT sa.id, sa.platform, sa.platform_account_id, sa.account_name, sa.token_expires_at,
              sa.fb_page_id, sa.profile_picture_url, sa.is_active, sa.connected_by, sa.team_id, sa.created_at,
              u.first_name, u.last_name
       FROM social_accounts sa
       JOIN users u ON sa.connected_by = u.id
       ORDER BY sa.created_at DESC`
    );

    const accounts = rows.map(r => ({
      id: r.id,
      platform: r.platform,
      platformAccountId: r.platform_account_id,
      accountName: r.account_name,
      tokenExpiresAt: r.token_expires_at,
      fbPageId: r.fb_page_id,
      profilePictureUrl: r.profile_picture_url,
      isActive: !!r.is_active,
      connectedBy: r.connected_by,
      connectedByName: `${r.first_name} ${r.last_name}`,
      teamId: r.team_id,
      createdAt: r.created_at,
      tokenStatus: getTokenStatus(r.token_expires_at),
    }));

    res.json(accounts);
  } catch (err) {
    next(err);
  }
}

function getTokenStatus(expiresAt) {
  if (!expiresAt) return 'valid'; // Page tokens don't expire
  const now = new Date();
  const expires = new Date(expiresAt);
  const daysLeft = (expires - now) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return 'expired';
  if (daysLeft < 7) return 'expiring';
  return 'valid';
}

async function startOAuth(req, res, next) {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, {
      userId: req.user.userId,
      teamId: req.query.teamId || null,
      timestamp: Date.now(),
    });

    // Clean old states (> 10 minutes)
    for (const [key, val] of pendingStates) {
      if (Date.now() - val.timestamp > 600000) pendingStates.delete(key);
    }

    const authUrl = facebookService.getAuthUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
}

async function oauthCallback(req, res, next) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn(`Facebook OAuth denied: ${error}`);
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/accounts?error=oauth_denied`);
    }

    if (!state || !pendingStates.has(state)) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/accounts?error=invalid_state`);
    }

    const { userId, teamId } = pendingStates.get(state);
    pendingStates.delete(state);

    // Exchange code for token
    const { accessToken } = await facebookService.exchangeCodeForToken(code);

    // Fetch pages and Instagram accounts
    const accounts = await facebookService.fetchPagesAndInstagram(accessToken, userId, teamId);

    logger.info(`Facebook OAuth: connected ${accounts.length} account(s) for user ${userId}`);

    // Redirect back to accounts page with success
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/accounts?connected=${accounts.length}`);
  } catch (err) {
    logger.error('Facebook OAuth callback error:', { error: err.message });
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/accounts?error=connection_failed`);
  }
}

async function startInstagramOAuth(req, res, next) {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, {
      userId: req.user.userId,
      teamId: req.query.teamId || null,
      platform: 'instagram',
      timestamp: Date.now(),
    });

    // Clean old states
    for (const [key, val] of pendingStates) {
      if (Date.now() - val.timestamp > 600000) pendingStates.delete(key);
    }

    const authUrl = instagramService.getAuthUrl(state);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
}

async function instagramCallback(req, res, next) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      logger.warn(`Instagram OAuth denied: ${error} - ${error_description}`);
      return res.redirect(`${clientUrl}/accounts?error=oauth_denied`);
    }

    if (!state || !pendingStates.has(state)) {
      return res.redirect(`${clientUrl}/accounts?error=invalid_state`);
    }

    const { userId, teamId } = pendingStates.get(state);
    pendingStates.delete(state);

    // Step 1: Exchange code for short-lived token
    const { accessToken: shortToken, userId: igUserId } = await instagramService.exchangeCodeForToken(code);

    // Step 2: Exchange for long-lived token (60 days)
    const { accessToken: longToken } = await instagramService.exchangeForLongLivedToken(shortToken);

    // Step 3: Fetch profile and store account
    await instagramService.fetchInstagramAccount(longToken, igUserId, userId, teamId);

    logger.info(`Instagram OAuth: connected account ${igUserId} for user ${userId}`);
    res.redirect(`${clientUrl}/accounts?connected=1`);
  } catch (err) {
    logger.error('Instagram OAuth callback error:', {
      error: err.message,
      response: err.response?.data,
    });
    res.redirect(`${clientUrl}/accounts?error=connection_failed`);
  }
}

async function disconnectAccount(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.execute('UPDATE social_accounts SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Account disconnected' });
  } catch (err) {
    next(err);
  }
}

async function reconnectAccount(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.execute('UPDATE social_accounts SET is_active = 1 WHERE id = ?', [id]);
    res.json({ message: 'Account reconnected' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAccounts,
  startOAuth,
  oauthCallback,
  startInstagramOAuth,
  instagramCallback,
  disconnectAccount,
  reconnectAccount,
};
