const pool = require('../config/db');

async function listComments(postId) {
  const [rows] = await pool.execute(
    `SELECT c.*, u.first_name, u.last_name, u.avatar_url, u.role
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [postId]
  );
  return rows.map(formatComment);
}

async function addComment(postId, userId, body) {
  const [result] = await pool.execute(
    'INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)',
    [postId, userId, body]
  );

  // Log activity
  await pool.execute(
    "INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, 'comment.added', 'post', ?, ?)",
    [userId, postId, JSON.stringify({ commentId: result.insertId })]
  );

  const [rows] = await pool.execute(
    `SELECT c.*, u.first_name, u.last_name, u.avatar_url, u.role
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [result.insertId]
  );
  return formatComment(rows[0]);
}

async function updateComment(commentId, userId, body) {
  const [existing] = await pool.execute('SELECT user_id FROM comments WHERE id = ?', [commentId]);
  if (existing.length === 0) throw Object.assign(new Error('Comment not found'), { status: 404 });
  if (existing[0].user_id !== userId) throw Object.assign(new Error('Not authorized'), { status: 403 });

  await pool.execute('UPDATE comments SET body = ? WHERE id = ?', [body, commentId]);
  const [rows] = await pool.execute(
    `SELECT c.*, u.first_name, u.last_name, u.avatar_url, u.role
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [commentId]
  );
  return formatComment(rows[0]);
}

async function deleteComment(commentId, userId, userRole) {
  const [existing] = await pool.execute('SELECT user_id FROM comments WHERE id = ?', [commentId]);
  if (existing.length === 0) throw Object.assign(new Error('Comment not found'), { status: 404 });

  if (existing[0].user_id !== userId && userRole !== 'admin' && userRole !== 'manager') {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  }

  await pool.execute('DELETE FROM comments WHERE id = ?', [commentId]);
}

function formatComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    userName: `${row.first_name} ${row.last_name}`,
    userRole: row.role,
    avatarUrl: row.avatar_url,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { listComments, addComment, updateComment, deleteComment };
