'use strict';

import {
  getWalletInfo,
  createDepositRequestService,
  handleDepositWebhook,
  getDepositHistory,
  getTransactionHistory,
  payWithWallet,
  processRefund,
  checkDepositStatus,
  adminAdjustWallet
} from '../services/walletService.js';

// GET /api/wallet - Lấy thông tin ví và thống kê
async function getWalletController(req, res) {
  try {
    const data = await getWalletInfo(req.user.id);

    return res.json({
      success: true,
      message: 'Wallet info retrieved successfully',
      ...data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet info',
      error: error.message
    });
  }
}

// POST /api/wallet/deposit - Tạo yêu cầu nạp tiền
async function createDepositController(req, res) {
  try {
    const { amount, paymentMethod = 'sepay' } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    const data = await createDepositRequestService(req.user.id, {
      amount: parseFloat(amount),
      paymentMethod
    });

    return res.status(201).json({
      success: true,
      message: 'Deposit request created successfully',
      ...data
    });
  } catch (error) {
    const statusCode = error.message.includes('Invalid') ||
      error.message.includes('Minimum') ||
      error.message.includes('Maximum') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to create deposit request',
      error: error.message
    });
  }
}

// GET /api/wallet/deposit/:id - Kiểm tra trạng thái nạp tiền
async function checkDepositController(req, res) {
  try {
    const { id } = req.params;
    const data = await checkDepositStatus(req.user.id, id);

    return res.json({
      success: true,
      message: 'Deposit status retrieved successfully',
      deposit: data
    });
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to check deposit status',
      error: error.message
    });
  }
}

// GET /api/wallet/deposits - Lịch sử nạp tiền
async function getDepositsController(req, res) {
  try {
    const {
      page = 1,
      pageSize = 20,
      status
    } = req.query;

    const filters = {
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };

    if (status) {
      filters.status = status;
    }

    const data = await getDepositHistory(req.user.id, filters);

    return res.json({
      success: true,
      message: 'Deposit history retrieved successfully',
      ...data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get deposit history',
      error: error.message
    });
  }
}

// GET /api/wallet/transactions - Lịch sử giao dịch ví
async function getTransactionsController(req, res) {
  try {
    const {
      page = 1,
      pageSize = 20,
      type,
      startDate,
      endDate
    } = req.query;

    const filters = {
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };

    if (type) filters.type = type;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const data = await getTransactionHistory(req.user.id, filters);

    return res.json({
      success: true,
      message: 'Transaction history retrieved successfully',
      ...data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history',
      error: error.message
    });
  }
}

// POST /api/wallet/pay - Thanh toán bằng ví
async function payWithWalletController(req, res) {
  try {
    const { amount, description, referenceType, referenceId } = req.body;

    if (!amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Amount and description are required'
      });
    }

    const data = await payWithWallet(req.user.id, {
      amount: parseFloat(amount),
      description,
      referenceType,
      referenceId
    });

    return res.json({
      success: true,
      message: 'Payment processed successfully',
      ...data
    });
  } catch (error) {
    const statusCode = error.message.includes('Insufficient') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Payment failed',
      error: error.message
    });
  }
}

// POST /api/wallet/webhook - Webhook xử lý nạp tiền
async function walletWebhookController(req, res) {
  try {
    // Verify signature nếu cần
    const data = await handleDepositWebhook(req.body);

    return res.json({
      success: true,
      message: 'Webhook processed successfully',
      ...data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
}

// Admin Controllers

// POST /api/wallet/admin/adjust - Admin điều chỉnh ví
async function adminAdjustWalletController(req, res) {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || !amount || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and non-zero amount are required'
      });
    }

    const data = await adminAdjustWallet(userId, {
      amount: parseFloat(amount),
      description: description || 'Admin adjustment',
      adminId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Wallet adjusted successfully',
      ...data
    });
  } catch (error) {
    const statusCode = error.message.includes('Insufficient') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to adjust wallet',
      error: error.message
    });
  }
}

// GET /api/wallet/admin/:userId - Admin xem thông tin ví user
async function adminGetWalletController(req, res) {
  try {
    const { userId } = req.params;
    const data = await getWalletInfo(userId);

    return res.json({
      success: true,
      message: 'User wallet info retrieved successfully',
      ...data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get user wallet info',
      error: error.message
    });
  }
}

// POST /api/wallet/admin/refund - Admin hoàn tiền
async function adminRefundController(req, res) {
  try {
    const { userId, amount, description, referenceType, referenceId } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and positive amount are required'
      });
    }

    const data = await processRefund(userId, {
      amount: parseFloat(amount),
      description: description || 'Admin refund',
      referenceType,
      referenceId
    });

    return res.json({
      success: true,
      message: 'Refund processed successfully',
      ...data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
}

export {
  getWalletController,
  createDepositController,
  checkDepositController,
  getDepositsController,
  getTransactionsController,
  payWithWalletController,
  walletWebhookController,
  adminAdjustWalletController,
  adminGetWalletController,
  adminRefundController
};