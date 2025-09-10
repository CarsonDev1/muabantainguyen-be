'use strict';

import { requestReset, resetPasswordService } from '../services/passwordResetService.js';

function getExpiry(hoursFromNow) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d;
}

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const result = await requestReset({ email });
    return res.json({ message: 'Password reset request sent', ...result });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create reset request', error: err.message });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Missing fields' });
    const result = await resetPasswordService({ token, newPassword });
    return res.json({ message: 'Password reset successfully', ...result });
  } catch (err) {
    const code = err.message.includes('Invalid or expired') ? 400 : 500;
    return res.status(code).json({ message: 'Reset failed', error: err.message });
  }
}

export { requestPasswordReset, resetPassword };

