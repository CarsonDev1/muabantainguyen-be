'use strict';

import { pool } from '../setup/db.js';

async function activityLogger(req, res, next) {
  res.on('finish', () => {
    const userId = req.user?.id || null;
    const action = `${req.method} ${res.statusCode}`;
    pool
      .query(
        `INSERT INTO user_activity (user_id, action, path, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, req.originalUrl, req.ip, req.headers['user-agent']]
      )
      .catch(() => { });
  });
  next();
}

export { activityLogger };

