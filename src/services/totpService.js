'use strict';

import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { pool } from '../setup/db.js';

async function enableTOTP(userId, issuer = 'Muabantainguyen') {
  const secret = authenticator.generateSecret();
  const { rows } = await pool.query(`UPDATE users SET totp_secret = $2, is_2fa_enabled = TRUE WHERE id = $1 RETURNING email`, [userId, secret]);
  const email = rows[0].email;
  const otpauth = authenticator.keyuri(email, issuer, secret);
  const qr = await qrcode.toDataURL(otpauth);
  return { otpauth, qr };
}

async function disableTOTP(userId) {
  await pool.query(`UPDATE users SET totp_secret = NULL, is_2fa_enabled = FALSE WHERE id = $1`, [userId]);
}

async function verifyTOTP(userId, token) {
  const { rows } = await pool.query(`SELECT totp_secret FROM users WHERE id = $1`, [userId]);
  const secret = rows[0]?.totp_secret;
  if (!secret) return false;
  return authenticator.verify({ token, secret });
}

export { enableTOTP, disableTOTP, verifyTOTP };

