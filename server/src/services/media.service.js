const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../config/db');

async function processUpload(file, userId, teamId) {
  const isImage = file.mimetype.startsWith('image/');
  let width = null;
  let height = null;
  let thumbnailPath = null;

  if (isImage) {
    try {
      const metadata = await sharp(file.path).metadata();
      width = metadata.width;
      height = metadata.height;

      const thumbName = `thumb_${file.filename}`;
      const thumbDir = path.join(__dirname, '../../uploads/thumbnails');
      thumbnailPath = `thumbnails/${thumbName}`;

      await sharp(file.path)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(path.join(thumbDir, thumbName));
    } catch (err) {
      // If thumbnail generation fails, continue without it
    }
  }

  const isVideo = file.mimetype.startsWith('video/');
  const relativePath = `${isVideo ? 'videos' : 'images'}/${file.filename}`;

  const [result] = await pool.execute(
    `INSERT INTO media (original_name, file_name, file_path, mime_type, file_size, width, height, thumbnail_path, uploaded_by, team_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [file.originalname, file.filename, relativePath, file.mimetype, file.size, width, height, thumbnailPath, userId, teamId || null]
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

  const [rows] = await pool.execute(
    `SELECT m.*, u.first_name, u.last_name FROM media m
     JOIN users u ON m.uploaded_by = u.id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
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
