// src/controllers/siteSettingsController.js
import { pool } from '../setup/db.js';

// Get all settings (admin)
async function getAllSettingsController(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM site_settings 
      ORDER BY category, key
    `);

    // Group by category
    const grouped = rows.reduce((acc, setting) => {
      if (!acc[setting.category]) acc[setting.category] = {};
      acc[setting.category][setting.key] = {
        value: setting.value,
        type: setting.type,
        display_name: setting.display_name,
        description: setting.description,
        is_public: setting.is_public
      };
      return acc;
    }, {});

    return res.json({
      success: true,
      message: 'Settings retrieved successfully',
      settings: grouped
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get settings',
      error: err.message
    });
  }
}

// Update settings
async function updateSettingsController(req, res) {
  try {
    const updates = req.body; // { key1: value1, key2: value2, ... }

    for (const [key, value] of Object.entries(updates)) {
      await pool.query(`
        UPDATE site_settings 
        SET value = $2, updated_at = NOW()
        WHERE key = $1
      `, [key, String(value)]);
    }

    return res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: err.message
    });
  }
}

// Get public settings (no auth required)
async function getPublicSettingsController(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT key, value, type FROM site_settings 
      WHERE is_public = TRUE
    `);

    const settings = rows.reduce((acc, setting) => {
      let value = setting.value;

      // Convert value based on type
      if (setting.type === 'boolean') {
        value = value === 'true';
      } else if (setting.type === 'number') {
        value = Number(value);
      } else if (setting.type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = null;
        }
      }

      acc[setting.key] = value;
      return acc;
    }, {});

    return res.json({
      success: true,
      message: 'Public settings retrieved successfully',
      settings
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get public settings',
      error: err.message
    });
  }
}

export {
  getAllSettingsController,
  updateSettingsController,
  getPublicSettingsController
};