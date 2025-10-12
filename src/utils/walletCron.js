'use strict';

import { cancelExpiredDepositRequests } from '../models/walletModel.js';

// Chạy mỗi 5 phút để hủy các deposit request hết hạn
export async function cleanupExpiredDeposits() {
  try {
    const expired = await cancelExpiredDepositRequests();

    if (expired.length > 0) {
      console.log(`[wallet-cleanup] Cancelled ${expired.length} expired deposit requests`);

      // Log chi tiết nếu cần debug
      expired.forEach(req => {
        console.log(`[wallet-cleanup] Cancelled deposit: User ${req.user_id}, Amount ${req.amount}`);
      });
    }

    return { cancelled: expired.length };
  } catch (error) {
    console.error('[wallet-cleanup] Error cleaning up expired deposits:', error);
    throw error;
  }
}

// Khởi tạo cron job
export function startWalletCleanupCron() {
  // Chạy ngay lập tức
  cleanupExpiredDeposits().catch(console.error);

  // Chạy mỗi 5 phút
  const interval = setInterval(() => {
    cleanupExpiredDeposits().catch(console.error);
  }, 5 * 60 * 1000);

  console.log('[wallet-cleanup] Cleanup cron job started (runs every 5 minutes)');

  return interval;
}

// Dừng cron job
export function stopWalletCleanupCron(interval) {
  if (interval) {
    clearInterval(interval);
    console.log('[wallet-cleanup] Cleanup cron job stopped');
  }
}