'use strict';

import 'dotenv/config';

/**
 * Middleware xác thực webhook từ SePay
 * SePay gửi API Key trong header: Authorization: Apikey YOUR_API_KEY
 */
export function webhookAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Missing Authorization header'
    });
  }

  // SePay gửi: Authorization: Apikey YOUR_API_KEY
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Apikey') {
    return res.status(401).json({
      success: false,
      message: 'Invalid Authorization header format'
    });
  }

  const receivedApiKey = parts[1];
  const expectedApiKey = process.env.SEPAY_WEBHOOK_API_KEY;

  if (!expectedApiKey) {
    console.error('SEPAY_WEBHOOK_API_KEY not configured in environment');
    return res.status(500).json({
      success: false,
      message: 'Webhook authentication not configured'
    });
  }

  if (receivedApiKey !== expectedApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  // Xác thực thành công
  next();
}

/**
 * Middleware xác thực webhook từ SePay (không bắt buộc)
 * Chỉ log warning nếu không có API key
 */
export function optionalWebhookAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn('SePay webhook called without Authorization header');
    return next();
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Apikey') {
    console.warn('SePay webhook called with invalid Authorization header format');
    return next();
  }

  const receivedApiKey = parts[1];
  const expectedApiKey = process.env.SEPAY_WEBHOOK_API_KEY;

  if (!expectedApiKey) {
    console.warn('SEPAY_WEBHOOK_API_KEY not configured, accepting webhook without verification');
    return next();
  }

  if (receivedApiKey !== expectedApiKey) {
    console.warn('SePay webhook called with invalid API key');
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  // Xác thực thành công
  next();
}
