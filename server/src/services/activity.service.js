const pool = require('../config/db');

async function getRecentActivity({ limit = 20, entityType, entityId }) {
  let where = '1=1';
  const params = [];

  if (entityType) {
    where += ' AND a.entity_type = ?';
    params.push(entityType);
  }
  if (entityId) {
    where += ' AND a.entity_id = ?';
    params.push(entityId);
  }

  const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
  const [rows] = await pool.execute(
    `SELECT a.*, u.first_name, u.last_name
     FROM activity_log a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ${safeLimit}`,
    params
  );

  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.first_name ? `${r.first_name} ${r.last_name}` : 'System',
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details: r.details ? (typeof r.details === 'string' ? JSON.parse(r.details) : r.details) : null,
    createdAt: r.created_at,
  }));
}

async function log(userId, action, entityType, entityId, details) {
  await pool.execute(
    'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
}

module.exports = { getRecentActivity, log };
