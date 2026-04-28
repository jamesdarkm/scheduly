const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../config/db');

// Instagram requires images to be:
//   - JPEG, baseline-encoded
//   - Width/height between 320 and 1440 px
//   - Aspect ratio 4:5 (0.8) to 1.91:1 (1.91)
// We normalise on upload so the same file works for both Facebook and Instagram.
const IG_MAX_DIMENSION = 1440;
const IG_MIN_DIMENSION = 320;

async function processUpload(file, userId, teamId) {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  let width = null;
  let height = null;
  let thumbnailPath = null;
  let finalSize = file.size;
  let finalMime = file.mimetype;

  if (isImage) {
    try {
      const meta = await sharp(file.path).metadata();
      // Always re-encode to baseline JPEG: Instagram rejects progressive JPEGs,
      // and we want EXIF stripped for consistency. mozjpeg keeps quality high.
      const buffer = await sharp(file.path)
        .rotate() // honour EXIF orientation, then strip
        .resize(IG_MAX_DIMENSION, IG_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true, progressive: false })
        .toBuffer();
      fs.writeFileSync(file.path, buffer);
      finalSize = buffer.length;
      finalMime = 'image/jpeg';

      // Re-read metadata after potential resize
      const finalMeta = await sharp(file.path).metadata();
      width = finalMeta.width;
      height = finalMeta.height;

      // Pad-to-square thumbnail (300x300) for the media library grid
      const thumbName = `thumb_${file.filename}`;
      const thumbDir = path.join(__dirname, '../../uploads/thumbnails');
      thumbnailPath = `thumbnails/${thumbName}`;

      await sharp(file.path)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(path.join(thumbDir, thumbName));
    } catch (err) {
      // If processing fails we still want the upload to succeed so the user
      // sees their file. They can re-upload if it doesn't publish.
      console.error('Image processing failed:', err.message);
    }
  }

  const relativePath = `${isVideo ? 'videos' : 'images'}/${file.filename}`;

  const [result] = await pool.execute(
    `INSERT INTO media (original_name, file_name, file_path, mime_type, file_size, width, height, thumbnail_path, uploaded_by, team_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [file.originalname, file.filename, relativePath, finalMime, finalSize, width, height, thumbnailPath, userId, teamId || null]
  );

  return getMedia(result.insertId);
}

async function getMedia(id) {
  const [rows] = await pool.execute(
    `SELECT m.*, u.first_name, u.last_name FROM media m
     JOIN users u ON m.uploaded_by = u.id
     WHERE m.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Media not found'), { status: 404 });
  }
  return formatMedia(rows[0]);
}

async function listMedia({ page = 1, limit = 24, type, uploadedBy, teamId }) {
  let where = '1=1';
  const params = [];

  if (type === 'image') {
    where += " AND m.mime_type LIKE 'image/%'";
  } else if (type === 'video') {
    where += " AND m.mime_type LIKE 'video/%'";
  }

  if (uploadedBy) {
    where += ' AND m.uploaded_by = ?';
    params.push(uploadedBy);
  }

  if (teamId) {
    where += ' AND m.team_id = ?';
    params.push(teamId);
  }

  const offset = (page - 1) * limit;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as total FROM media m WHERE ${where}`,
    params
  );

  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
  const [rows] = await pool.execute(
    `SELECT m.*, u.first_name, u.last_name FROM media m
     JOIN users u ON m.uploaded_by = u.id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  return {
    data: rows.map(formatMedia),
    pagination: {
      page,
      limit,
      total: countRows[0].total,
      pages: Math.ceil(countRows[0].total / limit),
    },
  };
}

async function deleteMedia(id, userId, userRole) {
  const media = await getMedia(id);

  if (userRole !== 'admin' && userRole !== 'manager' && media.uploadedBy !== userId) {
    throw Object.assign(new Error('Not authorized to delete this media'), { status: 403 });
  }

  // Delete physical files
  const filePath = path.join(__dirname, '../../uploads', media.filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (media.thumbnailPath) {
    const thumbPath = path.join(__dirname, '../../uploads', media.thumbnailPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  await pool.execute('DELETE FROM media WHERE id = ?', [id]);
}

function formatMedia(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    thumbnailPath: row.thumbnail_path,
    uploadedBy: row.uploaded_by,
    uploaderName: row.first_name ? `${row.first_name} ${row.last_name}` : undefined,
    teamId: row.team_id,
    createdAt: row.created_at,
    url: `/uploads/${row.file_path}`,
    thumbnailUrl: row.thumbnail_path ? `/uploads/${row.thumbnail_path}` : null,
  };
}

module.exports = { processUpload, getMedia, listMedia, deleteMedia };
