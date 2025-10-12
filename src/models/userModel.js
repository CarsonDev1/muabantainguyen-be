'use strict';

import { pool } from '../setup/db.js';

async function createUser({ name, email, phone, passwordHash, avatarUrl }) {
  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, avatar_url, role, created_at`,
    [name, email, phone, passwordHash, avatarUrl || null]
  );
  return result.rows[0];
}

async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getUserByPhone(phone) {
  const result = await pool.query(
    `SELECT * FROM users WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await pool.query(`SELECT id, name, email, phone, avatar_url, role, created_at FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function updateUserProfile(userId, { name, phone, avatarUrl, email }) {
  const result = await pool.query(
    `UPDATE users
     SET name = COALESCE($2, name),
         phone = COALESCE($3, phone),
         avatar_url = COALESCE($4, avatar_url),
         email = COALESCE($5, email)
     WHERE id = $1
     RETURNING id, name, email, phone, avatar_url, role, created_at`,
    [userId, name || null, phone || null, avatarUrl || null, email || null]
  );
  return result.rows[0];
}

async function updatePassword(userId, newHash) {
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, newHash]);
}

export { createUser, getUserByEmail, getUserByPhone, getUserById, updateUserProfile, updatePassword };

