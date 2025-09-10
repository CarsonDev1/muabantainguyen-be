'use strict';

import { register as registerSvc, login as loginSvc, logout as logoutSvc, refresh as refreshSvc } from '../services/authService.js';
import { getMe, updateMe, changePasswordService } from '../services/userService.js';

function getTokenExpiryDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

async function register(req, res) {
  try {
    const result = await registerSvc({ ...req.body, userAgent: req.headers['user-agent'], ip: req.ip });
    return res.status(201).json({ success: true, message: 'Registration successful', ...result });
  } catch (err) {
    const code = err.message.includes('required') ? 400 :
      err.message.includes('already registered') ? 409 : 500;
    return res.status(code).json({ success: false, message: 'Registration failed', error: err.message });
  }
}

async function login(req, res) {
  try {
    const result = await loginSvc({ ...req.body, userAgent: req.headers['user-agent'], ip: req.ip });
    return res.json({ success: true, message: 'Login successful', ...result });
  } catch (err) {
    const code = err.message.includes('Invalid credentials') ? 401 : 500;
    return res.status(code).json({ success: false, message: 'Login failed', error: err.message });
  }
}

async function logout(req, res) {
  try {
    const result = await logoutSvc({ refreshToken: req.body.refreshToken });
    return res.json({ success: true, message: 'Logout successful', ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed', error: err.message });
  }
}

async function refresh(req, res) {
  try {
    const result = await refreshSvc({ refreshToken: req.body.refreshToken });
    return res.json({ success: true, message: 'Token refreshed', ...result });
  } catch (err) {
    const code = err.message.includes('Missing') ? 400 : 401;
    return res.status(code).json({ success: false, message: 'Invalid refresh token' });
  }
}

async function me(req, res) {
  const user = await getMe(req.user.id);
  return res.json({ success: true, message: 'User profile retrieved', user });
}

async function updateProfile(req, res) {
  try {
    const user = await updateMe(req.user.id, req.body);
    return res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Update profile failed', error: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const result = await changePasswordService(req.user.id, req.body);
    return res.json({ success: true, message: 'Password changed successfully', ...result });
  } catch (err) {
    const code = err.message.includes('Missing') ? 400 : err.message.includes('incorrect') ? 401 : 500;
    return res.status(code).json({ success: false, message: 'Change password failed', error: err.message });
  }
}

export { register, login, logout, refresh, me, updateProfile, changePassword };

