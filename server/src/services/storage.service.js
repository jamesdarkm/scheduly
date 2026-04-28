/**
 * Storage abstraction. When Cloudflare R2 (S3-compatible) credentials are set,
 * uploads go to R2 and we serve files from R2's public URL. Otherwise we fall
 * back to local disk (works in dev / single-host deployments).
 *
 * Required env vars to enable R2:
 *   R2_ACCOUNT_ID         (e.g. abc123def456 — Cloudflare account ID)
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET             (bucket name, e.g. scheduly-uploads)
 *   R2_PUBLIC_URL         (https://pub-xxxx.r2.dev or custom domain, no trailing slash)
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const isEnabled = () =>
  !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);

let _client = null;
function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

/**
 * Upload a file (path on local disk or Buffer) to R2 under the given key.
 * Returns the public URL.
 */
async function uploadToR2(key, body, contentType) {
  if (!isEnabled()) throw new Error('R2 is not configured');
  const Body = body instanceof Buffer ? body : fs.readFileSync(body);
  await client().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

async function deleteFromR2(key) {
  if (!isEnabled()) return;
  try {
    await client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    logger.warn(`R2 delete failed for ${key}: ${e.message}`);
  }
}

/**
 * Build the public URL for a stored file. Works for both R2 and local.
 *   storedPath = the value saved in media.file_path or media.thumbnail_path
 *                e.g. "images/abc.jpg" or "thumbnails/thumb_abc.jpg"
 */
function publicUrlFor(storedPath) {
  if (!storedPath) return null;
  if (isEnabled()) return `${R2_PUBLIC_URL}/${storedPath}`;
  return `/uploads/${storedPath}`;
}

module.exports = {
  isEnabled,
  uploadToR2,
  deleteFromR2,
  publicUrlFor,
};
