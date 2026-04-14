const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');

async function login(email, password) {
  const [rows] = await pool.execute(
    'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = ?',
    [email]
  );

  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const user = rows[0];

  if (!user.is_active) {
    throw Object.assign(new Error('Account is deactivated'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    },
  };
}

async function getProfile(userId) {
  const [rows] = await pool.execute(
    'SELECT id, email, first_name, last_name, role, avatar_url, created_at FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  const u = rows[0];
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    avatarUrl: u.avatar_url,
    createdAt: u.created_at,
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
}

module.exports = { login, getProfile, changePassword };
