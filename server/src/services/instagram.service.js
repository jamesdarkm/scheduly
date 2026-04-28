const axios = require('axios');
const pool = require('../config/db');
const ig = require('../config/instagram');
const { encrypt, decrypt } = require('./token.service');
const logger = require('../utils/logger');

// ── OAuth Flow (Instagram Business Login - direct, no Facebook Page needed) ──

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: ig.appId,
    redirect_uri: ig.redirectUri,
    response_type: 'code',
    scope: ig.IG_SCOPES,
    state,
  });
  return `${ig.IG_OAUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const formData = new URLSearchParams();
  formData.append('client_id', ig.appId);
  formData.append('client_secret', ig.appSecret);
  formData.append('grant_type', 'authorization_code');
  formData.append('redirect_uri', ig.redirectUri);
  formData.append('code', code);

  const { data } = await axios.post(ig.IG_TOKEN_URL, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return {
    accessToken: data.access_token,
    userId: data.user_id,
  };
}

async function exchangeForLongLivedToken(shortLivedToken) {
  const { data } = await axios.get(`${ig.IG_GRAPH_URL}/access_token`, {
    params: {
      grant_type: 'ig_exchange_token',
      client_secret: ig.appSecret,
      access_token: shortLivedToken,
    },
  });

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in, // ~60 days
  };
}

async function refreshLongLivedToken(encryptedToken) {
  const token = decrypt(encryptedToken);
  const { data } = await axios.get(`${ig.IG_GRAPH_URL}/refresh_access_token`, {
    params: {
      grant_type: 'ig_refresh_token',
      access_token: token,
    },
  });

  return {
    accessToken: encrypt(data.access_token),
    expiresIn: data.expires_in,
  };
}

async function fetchInstagramAccount(accessToken, userId, connectedBy, teamId) {
  const { data: profile } = await axios.get(`${ig.IG_GRAPH_URL}/${userId}`, {
    params: {
      fields: 'id,username,name,account_type,profile_picture_url',
      access_token: accessToken,
    },
  });

  const encryptedToken = encrypt(accessToken);
  const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

  await pool.execute(
    `INSERT INTO social_accounts (platform, platform_account_id, account_name, access_token, token_expires_at, profile_picture_url, connected_by, team_id)
     VALUES ('instagram_business', ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), token_expires_at = VALUES(token_expires_at), account_name = VALUES(account_name), profile_picture_url = VALUES(profile_picture_url), is_active = 1`,
    [
      profile.id,
      profile.username || profile.name || `IG @${profile.id}`,
      encryptedToken,
      tokenExpiresAt,
      profile.profile_picture_url || null,
      connectedBy,
      teamId || null,
    ]
  );

  return {
    platform: 'instagram_business',
    id: profile.id,
    name: profile.username,
  };
}

// ── Publishing ──

/**
 * Publishes content to Instagram via the direct Instagram API.
 * Note: Instagram still requires media to be accessible via a public URL.
 */
async function publishToInstagram(igAccountId, encryptedToken, content, mediaFiles, publicBaseUrl) {
  const token = decrypt(encryptedToken);

  if (!mediaFiles || mediaFiles.length === 0) {
    throw new Error('Instagram requires at least one image or video');
  }

  if (!publicBaseUrl) {
    throw new Error(
      'Instagram requires media to be accessible via public URL. Set IG_PUBLIC_BASE_URL in .env to your server\'s public URL.'
    );
  }

  // Safety net: ensure each image meets Instagram's 1440px limit before we hand it to the API.
  // Images uploaded before the upload-time normaliser was added may still be oversized.
  const sharp = require('sharp');
  const fs = require('fs');
  const path = require('path');
  const IG_MAX = 1440;

  for (const media of mediaFiles) {
    if (!media.mimeType?.startsWith('image/')) continue;
    const fullPath = path.join(__dirname, '../../uploads', media.filePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const meta = await sharp(fullPath).metadata();
      if (meta.width > IG_MAX || meta.height > IG_MAX || meta.format !== 'jpeg') {
        const buffer = await sharp(fullPath)
          .rotate()
          .resize(IG_MAX, IG_MAX, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();
        fs.writeFileSync(fullPath, buffer);
        logger.info(`IG publish: normalised ${media.filePath} from ${meta.width}x${meta.height} (${meta.format}) to fit Instagram`);
      }
    } catch (e) {
      logger.warn(`IG publish: could not normalise ${media.filePath}: ${e.message}`);
    }
  }

  if (mediaFiles.length === 1) {
    return publishSingleMedia(igAccountId, token, content, mediaFiles[0], publicBaseUrl);
  }

  return publishCarousel(igAccountId, token, content, mediaFiles, publicBaseUrl);
}

async function publishSingleMedia(igAccountId, token, content, media, publicBaseUrl) {
  const isVideo = media.mimeType.startsWith('video/');
  const mediaUrl = `${publicBaseUrl}/uploads/${media.filePath}`;

  const containerParams = {
    caption: content,
    access_token: token,
  };

  if (isVideo) {
    containerParams.video_url = mediaUrl;
    containerParams.media_type = 'REELS';
  } else {
    containerParams.image_url = mediaUrl;
  }

  const { data: container } = await axios.post(
    `${ig.IG_GRAPH_URL}/${igAccountId}/media`,
    containerParams
  );

  if (isVideo) {
    await waitForMediaProcessing(container.id, token);
  }

  const { data: publishData } = await axios.post(
    `${ig.IG_GRAPH_URL}/${igAccountId}/media_publish`,
    { creation_id: container.id, access_token: token }
  );

  return publishData.id;
}

async function publishCarousel(igAccountId, token, content, mediaFiles, publicBaseUrl) {
  const childIds = [];

  for (const media of mediaFiles) {
    const isVideo = media.mimeType.startsWith('video/');
    const mediaUrl = `${publicBaseUrl}/uploads/${media.filePath}`;
    const params = {
      is_carousel_item: true,
      access_token: token,
    };

    if (isVideo) {
      params.video_url = mediaUrl;
      params.media_type = 'VIDEO';
    } else {
      params.image_url = mediaUrl;
    }

    const { data } = await axios.post(`${ig.IG_GRAPH_URL}/${igAccountId}/media`, params);
    childIds.push(data.id);

    if (isVideo) await waitForMediaProcessing(data.id, token);
  }

  const { data: carousel } = await axios.post(`${ig.IG_GRAPH_URL}/${igAccountId}/media`, {
    caption: content,
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    access_token: token,
  });

  const { data: publishData } = await axios.post(
    `${ig.IG_GRAPH_URL}/${igAccountId}/media_publish`,
    { creation_id: carousel.id, access_token: token }
  );

  return publishData.id;
}

async function waitForMediaProcessing(containerId, token, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(`${ig.IG_GRAPH_URL}/${containerId}`, {
      params: { fields: 'status_code', access_token: token },
    });

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram media processing failed');

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Instagram media processing timed out');
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  fetchInstagramAccount,
  publishToInstagram,
};
