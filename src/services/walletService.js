'use strict';

import {
  getUserWallet,
  createDepositRequest,
  updateDepositRequest,
  findDepositRequestByCode,
  getUserDepositRequests,
  processSuccessfulDeposit,
  getWalletTransactions,
  getWalletStats,
  deductFromWallet,
  refundToWallet
} from '../models/walletModel.js';

// Lấy thông tin ví và thống kê
async function getWalletInfo(userId) {
  const [wallet, stats] = await Promise.all([
    getUserWallet(userId),
    getWalletStats(userId)
  ]);

  return {
    wallet: {
      id: wallet.id,
      balance: parseFloat(wallet.balance),
      total_deposited: parseFloat(wallet.total_deposited),
      total_spent: parseFloat(wallet.total_spent),
      created_at: wallet.created_at,
      updated_at: wallet.updated_at
    },
    stats: {
      balance: parseFloat(stats.balance),
      total_deposits: parseFloat(stats.total_deposits),
      total_purchases: parseFloat(stats.total_purchases),
      total_refunds: parseFloat(stats.total_refunds),
      deposit_count: parseInt(stats.deposit_count),
      purchase_count: parseInt(stats.purchase_count)
    }
  };
}

// Tạo yêu cầu nạp tiền
async function createDepositRequestService(userId, { amount, paymentMethod = 'sepay' }) {
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }

  const minAmount = 10000; // 10k VND
  const maxAmount = 50000000; // 50M VND

  if (amount < minAmount) {
    throw new Error(`Minimum deposit amount is ${minAmount} VND`);
  }

  if (amount > maxAmount) {
    throw new Error(`Maximum deposit amount is ${maxAmount} VND`);
  }

  // Tạo mã thanh toán unique
  const timestamp = Date.now().toString();
  const paymentCode = `DEP${timestamp.slice(-8)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // Hết hạn sau 30 phút
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const meta = {
    payment_method: paymentMethod,
    user_agent: 'wallet_deposit'
  };

  const depositRequest = await createDepositRequest({
    userId,
    amount,
    paymentMethod,
    paymentCode,
    provider: paymentMethod,
    expiresAt,
    meta
  });

  // Tạo hướng dẫn thanh toán
  const paymentInstructions = getPaymentInstructions({
    amount,
    code: paymentCode,
    method: paymentMethod
  });

  return {
    requestId: depositRequest.id,
    amount: parseFloat(amount),
    paymentCode,
    paymentMethod,
    expiresAt,
    instructions: paymentInstructions
  };
}

// Lấy hướng dẫn thanh toán
function getPaymentInstructions({ amount, code, method }) {
  const instructions = {
    amount: parseFloat(amount),
    code,
    method,
    note: 'Chuyển khoản với đúng nội dung để tự động nạp tiền vào ví'
  };

  switch (method) {
    case 'sepay':
      instructions.bankAccount = process.env.SEPAY_ACCOUNT || 'Thông tin tài khoản ngân hàng';
      instructions.bankName = 'Techcombank';
      instructions.accountNumber = '19037856172016';
      instructions.accountName = 'NGUYEN VAN A';
      break;

    case 'momo':
      instructions.momoNumber = process.env.MOMO_ACCOUNT || '0123456789';
      instructions.momoName = 'NGUYEN VAN A';
      break;

    default:
      instructions.note = 'Phương thức thanh toán không được hỗ trợ';
  }

  return instructions;
}

// Xử lý webhook nạp tiền thành công
async function handleDepositWebhook(payload) {
  const { content, amount, status, provider_tx_id } = payload;

  if (status !== 'success') {
    return { success: false, message: 'Payment not successful' };
  }

  // Tìm deposit request theo code
  const depositRequest = await findDepositRequestByCode(content);

  if (!depositRequest) {
    throw new Error('Deposit request not found');
  }

  if (depositRequest.status !== 'pending') {
    return { success: true, message: 'Deposit already processed' };
  }

  // Kiểm tra số tiền
  if (parseFloat(amount) < parseFloat(depositRequest.amount)) {
    throw new Error('Amount mismatch');
  }

  // Xử lý nạp tiền thành công
  await processSuccessfulDeposit(depositRequest.id, provider_tx_id);

  return {
    success: true,
    message: 'Deposit processed successfully',
    depositRequestId: depositRequest.id,
    userId: depositRequest.user_id,
    amount: depositRequest.amount
  };
}

// Lấy lịch sử nạp tiền
async function getDepositHistory(userId, filters = {}) {
  return getUserDepositRequests(userId, filters);
}

// Lấy lịch sử giao dịch ví
async function getTransactionHistory(userId, filters = {}) {
  return getWalletTransactions(userId, filters);
}

// Thanh toán bằng ví
async function payWithWallet(userId, { amount, description, referenceType, referenceId }) {
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }

  const wallet = await getUserWallet(userId);

  if (parseFloat(wallet.balance) < amount) {
    throw new Error('Insufficient wallet balance');
  }

  return deductFromWallet(userId, amount, description, referenceType, referenceId);
}

// Hoàn tiền vào ví
async function processRefund(userId, { amount, description, referenceType, referenceId }) {
  if (!amount || amount <= 0) {
    throw new Error('Invalid refund amount');
  }

  return refundToWallet(userId, amount, description, referenceType, referenceId);
}

// Kiểm tra trạng thái deposit request
async function checkDepositStatus(userId, requestId) {
  const { rows } = await pool.query(
    `SELECT id, amount, payment_code, status, payment_method, expires_at, completed_at, created_at
     FROM deposit_requests 
     WHERE id = $1 AND user_id = $2`,
    [requestId, userId]
  );

  if (rows.length === 0) {
    throw new Error('Deposit request not found');
  }

  const request = rows[0];

  return {
    id: request.id,
    amount: parseFloat(request.amount),
    paymentCode: request.payment_code,
    status: request.status,
    paymentMethod: request.payment_method,
    expiresAt: request.expires_at,
    completedAt: request.completed_at,
    createdAt: request.created_at,
    isExpired: request.status === 'pending' && new Date() > new Date(request.expires_at)
  };
}

// Admin: Thêm/trừ tiền thủ công
async function adminAdjustWallet(userId, { amount, type, description, adminId }) {
  if (!amount || amount === 0) {
    throw new Error('Invalid amount');
  }

  const transactionType = amount > 0 ? 'deposit' : 'withdraw';
  const wallet = await getUserWallet(userId);

  if (amount < 0 && parseFloat(wallet.balance) < Math.abs(amount)) {
    throw new Error('Insufficient wallet balance for withdrawal');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT update_wallet_balance($1, $2, $3, $4, 'admin_adjustment', $5, 'admin') as transaction_id`,
      [
        wallet.id,
        Math.abs(amount),
        transactionType,
        description || `Admin ${transactionType} by ${adminId}`,
        adminId
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      transactionId: rows[0].transaction_id,
      newBalance: await getUserWallet(userId).then(w => parseFloat(w.balance))
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export {
  getWalletInfo,
  createDepositRequestService,
  handleDepositWebhook,
  getDepositHistory,
  getTransactionHistory,
  payWithWallet,
  processRefund,
  checkDepositStatus,
  adminAdjustWallet,
  getPaymentInstructions
};