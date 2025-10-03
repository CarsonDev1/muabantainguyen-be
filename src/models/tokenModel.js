'use strict';

import { pool } from '../setup/db.js';

async function saveRefreshToken({ userId, token, expiresAt, userAgent, ipAddress }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, token, expiresAt, userAgent || null, ipAddress || null]
  );
}

async function revokeRefreshToken(token) {
  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
}

async function revokeAllTokensForUser(userId) {
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}

async function isRefreshTokenValid(token) {
  const result = await pool.query(
    `SELECT token, expires_at FROM refresh_tokens WHERE token = $1 LIMIT 1`,
    [token]
  );
  const row = result.rows[0];
  if (!row) return false;
  return new Date(row.expires_at) > new Date();
}

export { saveRefreshToken, revokeRefreshToken, revokeAllTokensForUser, isRefreshTokenValid };

