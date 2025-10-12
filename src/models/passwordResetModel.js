'use strict';

import { pool } from '../setup/db.js';

async function createPasswordReset({ userId, token, expiresAt }) {
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

async function findValidResetByToken(token) {
  const result = await pool.query(
    `SELECT pr.id, pr.user_id, pr.token, pr.expires_at, pr.used
     FROM password_resets pr
     WHERE pr.token = $1 AND pr.used = FALSE AND pr.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

async function markResetUsed(id) {
  await pool.query(`UPDATE password_resets SET used = TRUE WHERE id = $1`, [id]);
}

export { createPasswordReset, findValidResetByToken, markResetUsed };

