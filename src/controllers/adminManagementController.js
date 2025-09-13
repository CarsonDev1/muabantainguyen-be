// src/controllers/adminManagementController.js
import { pool } from '../setup/db.js';
import { createUser, updateUserProfile } from '../models/userModel.js';
import { hashPassword } from '../utils/password.js';
import { clearPermissionCache } from '../middleware/permissionMiddleware.js';

// List all admins
async function listAdminsController(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.avatar_url,
        u.role, u.is_blocked, u.created_at, u.updated_at,
        ar.name as admin_role_name, ar.display_name as admin_role_display,
        array_agg(p.name) as permissions
      FROM users u
      LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
      LEFT JOIN role_permissions rp ON rp.role_id = ar.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE u.role IN ('admin', 'super', 'staff')
      GROUP BY u.id, ar.id
      ORDER BY u.created_at DESC
    `);

    return res.json({
      success: true,
      message: 'Admins retrieved successfully',
      admins: rows
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list admins',
      error: err.message
    });
  }
}

// Create new admin
async function createAdminController(req, res) {
  try {
    const { name, email, phone, password, adminRoleId } = req.body;

    if (!email || !password || !adminRoleId) {
      return res.status(400).json({
        success: false,
        message: 'Email, password and admin role are required'
      });
    }

    const passwordHash = await hashPassword(password);

    // Create user với role admin
    const user = await createUser({
      name: name || null,
      email,
      phone: phone || null,
      passwordHash,
      avatarUrl: null
    });

    // Update role và admin_role_id
    await pool.query(`
      UPDATE users 
      SET role = 'admin', admin_role_id = $2
      WHERE id = $1
    `, [user.id, adminRoleId]);

    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: { ...user, admin_role_id: adminRoleId }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin',
      error: err.message
    });
  }
}

// Update admin role
async function updateAdminRoleController(req, res) {
  try {
    const { id } = req.params;
    const { adminRoleId } = req.body;

    await pool.query(`
      UPDATE users 
      SET admin_role_id = $2, updated_at = NOW()
      WHERE id = $1 AND role IN ('admin', 'super', 'staff')
    `, [id, adminRoleId]);

    // Clear cache permissions cho user này
    clearPermissionCache(id);

    return res.json({
      success: true,
      message: 'Admin role updated successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin role',
      error: err.message
    });
  }
}

// List roles
async function listRolesController(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        r.id, r.name, r.display_name, r.description, r.is_active,
        array_agg(
          json_build_object(
            'name', p.name,
            'display_name', p.display_name,
            'module', p.module
          )
        ) FILTER (WHERE p.id IS NOT NULL) as permissions
      FROM admin_roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.is_active = TRUE
      GROUP BY r.id
      ORDER BY r.name
    `);

    return res.json({
      success: true,
      message: 'Roles retrieved successfully',
      roles: rows
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list roles',
      error: err.message
    });
  }
}

// List all permissions
async function listPermissionsController(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM permissions 
      ORDER BY module, name
    `);

    // Group by module
    const grouped = rows.reduce((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    }, {});

    return res.json({
      success: true,
      message: 'Permissions retrieved successfully',
      permissions: grouped
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list permissions',
      error: err.message
    });
  }
}

export {
  listAdminsController,
  createAdminController,
  updateAdminRoleController,
  listRolesController,
  listPermissionsController
};