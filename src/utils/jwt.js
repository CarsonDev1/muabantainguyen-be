'use strict';
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TTL_MIN = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: `${ACCESS_TTL_MIN}m` });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };

