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

  // Normalise each image so it satisfies Instagram's strict requirements:
  //   - baseline (non-progressive) JPEG
  //   - max 1440px on the longest side
  //   - aspect ratio between 4:5 (0.8) and 1.91:1
  // We always re-encode (rather than gating on size/format) because some valid-
  // looking files are still rejected (e.g. progressive JPEGs at correct dimensions).
  const sharp = require('sharp');
  const fs = require('fs');
  const path = require('path');
  const IG_MAX = 1440;
  const IG_MIN_ASPECT = 0.8;   // 4:5 portrait
  const IG_MAX_ASPECT = 1.91;  // 1.91:1 landscape

  for (const media of mediaFiles) {
    if (!media.mimeType?.startsWith('image/')) continue;
    const fullPath = path.join(__dirname, '../../uploads', media.filePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const meta = await sharp(fullPath).rotate().metadata();
      let targetW = meta.width;
      let targetH = meta.height;
      const aspect = targetW / targetH;

      // 1) Constrain longest side to 1440
      if (targetW > IG_MAX || targetH > IG_MAX) {
        if (targetW >= targetH) {
          targetH = Math.round(targetH * (IG_MAX / targetW));
          targetW = IG_MAX;
        } else {
          targetW = Math.round(targetW * (IG_MAX / targetH));
          targetH = IG_MAX;
        }
      }

      // 2) Determine final canvas size that fits within IG's allowed aspect range
      let canvasW = targetW;
      let canvasH = targetH;
      if (aspect < IG_MIN_ASPECT) {
        // Image is too tall — widen canvas (pad sides) to reach 4:5
        canvasW = Math.round(targetH * IG_MIN_ASPECT);
      } else if (aspect > IG_MAX_ASPECT) {
        // Image is too wide — make canvas taller (pad top/bottom)
        canvasH = Math.round(targetW / IG_MAX_ASPECT);
      }

      const buffer = await sharp(fullPath)
        .rotate()
        .resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
        .extend({
          top:    Math.round((canvasH - targetH) / 2),
          bottom: canvasH - targetH - Math.round((canvasH - targetH) / 2),
          left:   Math.round((canvasW - targetW) / 2),
          right:  canvasW - targetW - Math.round((canvasW - targetW) / 2),
          background: { r: 255, g: 255, b: 255 },
        })
        .jpeg({ quality: 90, progressive: false, optimiseCoding: true }) // baseline JPEG required by IG (mozjpeg forces progressive)
        .toBuffer();

      fs.writeFileSync(fullPath, buffer);
      logger.info(`IG publish: normalised ${media.filePath} ${meta.width}x${meta.height} → ${canvasW}x${canvasH} baseline jpeg`);
    } catch (e) {
      logger.warn(`IG publish: could not normalise ${media.filePath}: ${e.message}`);
    }
  }

  // Diagnostic: log the IG account profile to confirm the token actually works,
  // and check which permissions the token has been granted.
  try {
    const { data: profile } = await axios.get(`${ig.IG_GRAPH_URL}/${igAccountId}`, {
      params: { fields: 'id,username,account_type,name', access_token: token },
    });
    logger.info(`IG publish: token works for ${profile.username} (${profile.account_type})`, profile);
  } catch (e) {
    logger.error(`IG publish: token check FAILED — ${e.response?.data?.error?.message || e.message}`, {
      status: e.response?.status,
      response: e.response?.data,
    });
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
    containerParams.media_type = 'IMAGE'; // explicit per IG Login API
  }

  logger.info(`IG publish: creating media container at ${ig.IG_GRAPH_URL}/${igAccountId}/media`, {
    image_url: containerParams.image_url,
    video_url: containerParams.video_url,
    media_type: containerParams.media_type,
    caption_length: content?.length || 0,
  });

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
