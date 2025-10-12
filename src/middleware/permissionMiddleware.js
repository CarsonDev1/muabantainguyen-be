// src/middleware/permissionMiddleware.js
import { pool } from '../setup/db.js';
import { verifyAccessToken } from '../utils/jwt.js';

// Cache permissions để tăng hiệu suất
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

async function getUserPermissions(userId) {
  const cacheKey = `permissions_${userId}`;
  const cached = permissionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  const { rows } = await pool.query(`
    SELECT DISTINCT p.name
    FROM users u
    LEFT JOIN admin_roles r ON r.id = u.admin_role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = $1 AND r.is_active = TRUE
  `, [userId]);

  const permissions = rows.map(row => row.name).filter(Boolean);

  // Cache permissions
  permissionCache.set(cacheKey, {
    permissions,
    timestamp: Date.now()
  });

  return permissions;
}

function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

      if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const payload = verifyAccessToken(token);

      // Super admin có tất cả quyền
      if (payload.role === 'super') {
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          permissions: ['*'] // Super admin có tất cả quyền
        };
        return next();
      }

      // Kiểm tra quyền cụ thể
      const userPermissions = await getUserPermissions(payload.sub);

      if (!userPermissions.includes(requiredPermission)) {
        return res.status(403).json({
          message: 'Forbidden',
          required_permission: requiredPermission,
          user_permissions: userPermissions
        });
      }

      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: userPermissions
      };

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

// Clear cache khi cần
function clearPermissionCache(userId = null) {
  if (userId) {
    permissionCache.delete(`permissions_${userId}`);
  } else {
    permissionCache.clear();
  }
}

export { requirePermission, getUserPermissions, clearPermissionCache };