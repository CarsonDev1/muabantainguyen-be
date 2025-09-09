'use strict';

import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createUser, getUserByEmail, getUserById } from '../models/userModel.js';
import { saveRefreshToken, revokeRefreshToken, isRefreshTokenValid } from '../models/tokenModel.js';

function getTokenExpiryDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

async function register({ name, email, phone, password, userAgent, ip }) {
  if (!email || !password) throw new Error('Email and password are required');
  const existing = await getUserByEmail(email);
  if (existing) throw new Error('Email already registered');

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name: name || null, email, phone: phone || null, passwordHash });

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  await saveRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: getTokenExpiryDate(Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30)),
    userAgent,
    ipAddress: ip,
  });

  return { user, accessToken, refreshToken };
}

async function login({ email, password, userAgent, ip }) {
  const existing = await getUserByEmail(email);
  if (!existing) throw new Error('Invalid credentials');

  const ok = await comparePassword(password, existing.password_hash);
  if (!ok) throw new Error('Invalid credentials');

  const user = await getUserById(existing.id);
  const accessToken = signAccessToken({ sub: existing.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: existing.id });
  await saveRefreshToken({
    userId: existing.id,
    token: refreshToken,
    expiresAt: getTokenExpiryDate(Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30)),
    userAgent,
    ipAddress: ip,
  });

  return { user, accessToken, refreshToken };
}

async function logout({ refreshToken }) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return { success: true };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw new Error('Missing refresh token');
  const valid = await isRefreshTokenValid(refreshToken);
  if (!valid) throw new Error('Invalid refresh token');
  const payload = verifyRefreshToken(refreshToken);
  const user = await getUserById(payload.sub);
  if (!user) throw new Error('User not found');
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  return { accessToken };
}

export { register, login, logout, refresh };

