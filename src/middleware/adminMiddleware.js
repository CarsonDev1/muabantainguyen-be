'use strict';

import { verifyAccessToken } from '../utils/jwt.js';

function adminOnly(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = verifyAccessToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'super')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export { adminOnly };

