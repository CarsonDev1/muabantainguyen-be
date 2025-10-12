'use strict';

import { getUserById, getUserByEmail, updateUserProfile, updatePassword } from '../models/userModel.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { revokeAllTokensForUser } from '../models/tokenModel.js';

async function getMe(userId) {
  return getUserById(userId);
}

async function updateMe(userId, { name, phone, avatarUrl, email }) {
  return updateUserProfile(userId, { name, phone, avatarUrl, email });
}

async function changePasswordService(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) throw new Error('Missing fields');
  const existing = await getUserById(userId);
  const existingFull = await getUserByEmail(existing.email);
  const ok = await comparePassword(currentPassword, existingFull.password_hash);
  if (!ok) throw new Error('Current password incorrect');

  const newHash = await hashPassword(newPassword);
  await updatePassword(userId, newHash);
  await revokeAllTokensForUser(userId);
  return { success: true };
}

export { getMe, updateMe, changePasswordService };

