'use strict';

import crypto from 'crypto';
import { getUserByEmail, updatePassword } from '../models/userModel.js';
import { createPasswordReset, findValidResetByToken, markResetUsed } from '../models/passwordResetModel.js';
import { hashPassword } from '../utils/password.js';
import { revokeAllTokensForUser } from '../models/tokenModel.js';
import { sendPasswordResetEmail } from './emailService.js';

function getExpiry(hoursFromNow) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
}

async function requestReset({ email }) {
  const user = await getUserByEmail(email);
  if (!user) return { success: true };

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = getExpiry(1);

  await createPasswordReset({ userId: user.id, token, expiresAt });

  try {
    await sendPasswordResetEmail(email, token);
    return { success: true };
  } catch (error) {
    console.error('Failed to send reset email:', error);
    return { success: true, warning: 'Token created but email could not be sent' };
  }
}

async function resetPasswordService({ token, newPassword }) {
  const record = await findValidResetByToken(token);
  if (!record) throw new Error('Invalid or expired token');
  const hashed = await hashPassword(newPassword);
  await updatePassword(record.user_id, hashed);
  await revokeAllTokensForUser(record.user_id);
  await markResetUsed(record.id);
  return { success: true };
}

export { requestReset, resetPasswordService };

