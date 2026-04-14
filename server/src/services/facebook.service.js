const axios = require('axios');
const pool = require('../config/db');
const fb = require('../config/facebook');
const { encrypt, decrypt } = require('./token.service');
const logger = require('../utils/logger');

// ── OAuth Flow ──

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: fb.appId,
    redirect_uri: fb.redirectUri,
    scope: fb.FB_PERMISSIONS,
    response_type: 'code',
    state,
  });
  return `${fb.FB_OAUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  // Step 1: Get short-lived user token
  const { data } = await axios.get(`${fb.FB_GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: fb.appId,
      client_secret: fb.appSecret,
      redirect_uri: fb.redirectUri,
      code,
    },
  });

  const shortLivedToken = data.access_token;

  // Step 2: Exchange for long-lived token (60 days)
  const { data: longLivedData } = await axios.get(`${fb.FB_GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: fb.appId,
      client_secret: fb.appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });

  return {
    accessToken: longLivedData.access_token,
    expiresIn: longLivedData.expires_in, // seconds
  };
}

async function fetchPagesAndInstagram(userAccessToken, userId, teamId) {
  // Get pages the user manages
  const { data: pagesData } = await axios.get(`${fb.FB_GRAPH_URL}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: 'id,name,access_token,picture{url}',
    },
  });

  const accounts = [];

  for (const page of pagesData.data || []) {
    // Store Facebook Page
    const encryptedToken = encrypt(page.access_token);
    const profilePic = page.picture?.data?.url || null;

    await pool.execute(
      `INSERT INTO social_accounts (platform, platform_account_id, account_name, access_token, token_expires_at, profile_picture_url, connected_by, team_id)
       VALUES ('facebook_page', ?, ?, ?, NULL, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), account_name = VALUES(account_name), profile_picture_url = VALUES(profile_picture_url), is_active = 1`,
      [page.id, page.name, encryptedToken, profilePic, userId, teamId || null]
    );

    accounts.push({ platform: 'facebook_page', id: page.id, name: page.name });

    // Check for linked Instagram Business account
    try {
      const { data: igData } = await axios.get(`${fb.FB_GRAPH_URL}/${page.id}`, {
        params: {
          fields: 'instagram_business_account{id,name,username,profile_picture_url}',
          access_token: page.access_token,
        },
      });

      if (igData.instagram_business_account) {
        const ig = igData.instagram_business_account;
        const igName = ig.username || ig.name || `IG @${ig.id}`;

        await pool.execute(
          `INSERT INTO social_accounts (platform, platform_account_id, account_name, access_token, token_expires_at, fb_page_id, profile_picture_url, connected_by, team_id)
           VALUES ('instagram_business', ?, ?, ?, NULL, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), account_name = VALUES(account_name), profile_picture_url = VALUES(profile_picture_url), fb_page_id = VALUES(fb_page_id), is_active = 1`,
          [ig.id, igName, encryptedToken, page.id, ig.profile_picture_url || null, userId, teamId || null]
        );

        accounts.push({ platform: 'instagram_business', id: ig.id, name: igName });
      }
    } catch (igErr) {
      logger.warn(`Could not fetch IG account for page ${page.id}: ${igErr.message}`);
    }
  }

  return accounts;
}

// ── Publishing ──

async function publishToPage(pageId, pageToken, content, mediaFiles) {
  const token = decrypt(pageToken);

  if (!mediaFiles || mediaFiles.length === 0) {
    // Text-only post
    const { data } = await axios.post(`${fb.FB_GRAPH_URL}/${pageId}/feed`, {
      message: content,
      access_token: token,
    });
    return data.id;
  }

  if (mediaFiles.length === 1 && mediaFiles[0].mimeType.startsWith('image/')) {
    // Single photo post
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');

    const filePath = path.join(__dirname, '../../uploads', mediaFiles[0].filePath);
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    form.append('caption', content);
    form.append('access_token', token);

    const { data } = await axios.post(`${fb.FB_GRAPH_URL}/${pageId}/photos`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return data.id || data.post_id;
  }

  if (mediaFiles.length === 1 && mediaFiles[0].mimeType.startsWith('video/')) {
    // Single video post
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');

    const filePath = path.join(__dirname, '../../uploads', mediaFiles[0].filePath);
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    form.append('description', content);
    form.append('access_token', token);

    const { data } = await axios.post(`${fb.FB_GRAPH_URL}/${pageId}/videos`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return data.id;
  }

  // Multiple photos — upload each unpublished, then create multi-photo post
  const photoIds = [];
  for (const media of mediaFiles) {
    if (!media.mimeType.startsWith('image/')) continue;

    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');

    const filePath = path.join(__dirname, '../../uploads', media.filePath);
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    form.append('published', 'false');
    form.append('access_token', token);

    const { data } = await axios.post(`${fb.FB_GRAPH_URL}/${pageId}/photos`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    photoIds.push(data.id);
  }

  // Create the multi-photo post
  const postBody = {
    message: content,
    access_token: token,
  };
  photoIds.forEach((id, i) => {
    postBody[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });

  const { data } = await axios.post(`${fb.FB_GRAPH_URL}/${pageId}/feed`, postBody);
  return data.id;
}

// ── Token Refresh ──

async function refreshLongLivedToken(currentToken) {
  const token = decrypt(currentToken);
  const { data } = await axios.get(`${fb.FB_GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: fb.appId,
      client_secret: fb.appSecret,
      fb_exchange_token: token,
    },
  });
  return {
    accessToken: encrypt(data.access_token),
    expiresIn: data.expires_in,
  };
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  fetchPagesAndInstagram,
  publishToPage,
  refreshLongLivedToken,
};
