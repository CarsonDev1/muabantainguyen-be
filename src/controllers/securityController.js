'use strict';

import { enableTOTP, disableTOTP, verifyTOTP } from '../services/totpService.js';

async function enableTotpController(req, res) {
  try {
    const data = await enableTOTP(req.user.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to enable 2FA', error: err.message });
  }
}

async function disableTotpController(req, res) {
  try {
    await disableTOTP(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to disable 2FA', error: err.message });
  }
}

async function verifyTotpController(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Missing token' });
    const ok = await verifyTOTP(req.user.id, token);
    return res.json({ valid: ok });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to verify 2FA', error: err.message });
  }
}

export { enableTotpController, disableTotpController, verifyTotpController };

