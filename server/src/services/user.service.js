const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function listUsers() {
  const [rows] = await pool.execute(
    'SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
  );
  return rows.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    isActive: !!u.is_active,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  }));
}

async function getUser(id) {
  const [rows] = await pool.execute(
    'SELECT id, email, first_name, last_name, role, avatar_url, is_active, last_login_at, created_at FROM users WHERE id = ?',
    [id]
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
    isActive: !!u.is_active,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

async function createUser({ email, password, firstName, lastName, role }) {
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw Object.assign(new Error('Email already in use'), { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
    [email, hash, firstName, lastName, role || 'editor']
  );

  return getUser(result.insertId);
}

async function updateUser(id, { email, firstName, lastName, role, isActive }) {
  const fields = [];
  const values = [];

  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (firstName !== undefined) { fields.push('first_name = ?'); values.push(firstName); }
  if (lastName !== undefined) { fields.push('last_name = ?'); values.push(lastName); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }

  if (fields.length === 0) {
    throw Object.assign(new Error('No fields to update'), { status: 400 });
  }

  values.push(id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  return getUser(id);
}

async function deactivateUser(id) {
  await pool.execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
}

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser };
