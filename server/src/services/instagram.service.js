const axios = require('axios');
const fb = require('../config/facebook');
const { decrypt } = require('./token.service');
const logger = require('../utils/logger');

/**
 * Instagram Content Publishing API uses a two-step process:
 * 1. Create a media container
 * 2. Publish the container
 *
 * IMPORTANT: Instagram requires media to be accessible via a public URL.
 * For self-hosted servers, we need to either:
 * - Use a publicly accessible URL (if server is public)
 * - Upload to temporary cloud storage first
 * - Use the server's public URL if available
 *
 * The `publicBaseUrl` parameter should be set in .env as IG_PUBLIC_BASE_URL
 * If not set, publishing to Instagram will fail with a helpful error.
 */

async function publishToInstagram(igAccountId, encryptedPageToken, content, mediaFiles, publicBaseUrl) {
  const token = decrypt(encryptedPageToken);

  if (!mediaFiles || mediaFiles.length === 0) {
    throw new Error('Instagram requires at least one image or video');
  }

  if (!publicBaseUrl) {
    throw new Error(
      'Instagram requires media to be accessible via public URL. Set IG_PUBLIC_BASE_URL in your .env file to your server\'s public URL.'
    );
  }

  if (mediaFiles.length === 1) {
    return publishSingleMedia(igAccountId, token, content, mediaFiles[0], publicBaseUrl);
  }

  return publishCarousel(igAccountId, token, content, mediaFiles, publicBaseUrl);
}

async function publishSingleMedia(igAccountId, token, content, media, publicBaseUrl) {
  const isVideo = media.mimeType.startsWith('video/');
  const mediaUrl = `${publicBaseUrl}/uploads/${media.filePath}`;

  // Step 1: Create container
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

  const { data: containerData } = await axios.post(
    `${fb.FB_GRAPH_URL}/${igAccountId}/media`,
    containerParams
  );

  const containerId = containerData.id;

  // For videos, wait for processing
  if (isVideo) {
    await waitForMediaProcessing(containerId, token);
  }

  // Step 2: Publish
  const { data: publishData } = await axios.post(
    `${fb.FB_GRAPH_URL}/${igAccountId}/media_publish`,
    {
      creation_id: containerId,
      access_token: token,
    }
  );

  return publishData.id;
}

async function publishCarousel(igAccountId, token, content, mediaFiles, publicBaseUrl) {
  // Step 1: Create child containers for each media item
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

    const { data } = await axios.post(
      `${fb.FB_GRAPH_URL}/${igAccountId}/media`,
      params
    );

    childIds.push(data.id);

    // Wait for video processing
    if (isVideo) {
      await waitForMediaProcessing(data.id, token);
    }
  }

  // Step 2: Create carousel container
  const { data: carouselData } = await axios.post(
    `${fb.FB_GRAPH_URL}/${igAccountId}/media`,
    {
      caption: content,
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      access_token: token,
    }
  );

  // Step 3: Publish carousel
  const { data: publishData } = await axios.post(
    `${fb.FB_GRAPH_URL}/${igAccountId}/media_publish`,
    {
      creation_id: carouselData.id,
      access_token: token,
    }
  );

  return publishData.id;
}

async function waitForMediaProcessing(containerId, token, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(
      `${fb.FB_GRAPH_URL}/${containerId}`,
      {
        params: {
          fields: 'status_code',
          access_token: token,
        },
      }
    );

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error('Instagram media processing failed');
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Instagram media processing timed out');
}

module.exports = { publishToInstagram };
