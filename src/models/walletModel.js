'use strict';

import { pool } from '../setup/db.js';

// Lấy ví của user (tự động tạo nếu chưa có)
async function getUserWallet(userId) {
  let { rows } = await pool.query(
    `SELECT id, balance, total_deposited, total_spent, created_at, updated_at 
     FROM wallets WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    // Tạo ví mới nếu chưa có
    const { rows: newWallet } = await pool.query(
      `INSERT INTO wallets (user_id) VALUES ($1) 
       RETURNING id, balance, total_deposited, total_spent, created_at, updated_at`,
      [userId]
    );
    return newWallet[0];
  }

  return rows[0];
}

// Tạo yêu cầu nạp tiền
async function createDepositRequest({ userId, amount, paymentMethod, paymentCode, provider, expiresAt, meta }) {
  const wallet = await getUserWallet(userId);

  const { rows } = await pool.query(
    `INSERT INTO deposit_requests (user_id, wallet_id, amount, payment_method, payment_code, provider, expires_at, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, wallet.id, amount, paymentMethod, paymentCode, provider, expiresAt, meta ? JSON.stringify(meta) : null]
  );

  return rows[0];
}

// Cập nhật trạng thái deposit request
async function updateDepositRequest(id, updates) {
  const setParts = [];
  const values = [id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'meta') {
      setParts.push(`${key} = $${paramIndex}`);
      values.push(JSON.stringify(value));
    } else {
      setParts.push(`${key} = $${paramIndex}`);
      values.push(value);
    }
    paramIndex++;
  }

  if (setParts.length === 0) return null;

  setParts.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE deposit_requests SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );

  return rows[0];
}

// Tìm deposit request theo payment code
async function findDepositRequestByCode(paymentCode) {
  const { rows } = await pool.query(
    `SELECT * FROM deposit_requests WHERE payment_code = $1 ORDER BY created_at DESC LIMIT 1`,
    [paymentCode]
  );
  return rows[0] || null;
}

// Lấy lịch sử deposit requests của user
async function getUserDepositRequests(userId, { page = 1, pageSize = 20, status }) {
  const offset = (page - 1) * pageSize;
  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  params.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT id, amount, payment_method, payment_code, status, provider, 
            expires_at, completed_at, created_at, updated_at
     FROM deposit_requests 
     WHERE ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  // Get total count
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total FROM deposit_requests WHERE ${whereClause}`,
    params.slice(0, -2)
  );

  return {
    items: rows,
    total: parseInt(countRows[0].total),
    page,
    pageSize,
    totalPages: Math.ceil(parseInt(countRows[0].total) / pageSize)
  };
}

// Xử lý nạp tiền thành công
async function processSuccessfulDeposit(depositRequestId, providerTxId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lấy thông tin deposit request
    const { rows: depositRows } = await client.query(
      `SELECT * FROM deposit_requests WHERE id = $1 AND status = 'pending'`,
      [depositRequestId]
    );

    if (depositRows.length === 0) {
      throw new Error('Deposit request not found or already processed');
    }

    const deposit = depositRows[0];

    // Cập nhật deposit request
    await client.query(
      `UPDATE deposit_requests 
       SET status = 'completed', provider_tx_id = $2, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [depositRequestId, providerTxId]
    );

    // Cập nhật số dư ví
    await client.query(
      `SELECT update_wallet_balance($1, $2, 'deposit', $3, 'deposit_request', $4, $5)`,
      [
        deposit.wallet_id,
        deposit.amount,
        `Nạp tiền qua ${deposit.payment_method}`,
        depositRequestId,
        deposit.provider
      ]
    );

    await client.query('COMMIT');

    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Lấy lịch sử giao dịch ví
async function getWalletTransactions(userId, { page = 1, pageSize = 20, type, startDate, endDate }) {
  const offset = (page - 1) * pageSize;
  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIndex = 2;

  if (type) {
    conditions.push(`type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  params.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT id, type, amount, balance_before, balance_after, description,
            reference_type, reference_id, status, provider, created_at
     FROM wallet_transactions 
     WHERE ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  // Get total count
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total FROM wallet_transactions WHERE ${whereClause}`,
    params.slice(0, -2)
  );

  return {
    items: rows,
    total: parseInt(countRows[0].total),
    page,
    pageSize,
    totalPages: Math.ceil(parseInt(countRows[0].total) / pageSize)
  };
}

// Tính tổng giao dịch theo type
async function getWalletStats(userId) {
  const { rows } = await pool.query(
    `SELECT 
       w.balance,
       w.total_deposited,
       w.total_spent,
       COALESCE(SUM(CASE WHEN wt.type = 'deposit' THEN wt.amount ELSE 0 END), 0) as total_deposits,
       COALESCE(SUM(CASE WHEN wt.type = 'purchase' THEN ABS(wt.amount) ELSE 0 END), 0) as total_purchases,
       COALESCE(SUM(CASE WHEN wt.type = 'refund' THEN wt.amount ELSE 0 END), 0) as total_refunds,
       COUNT(CASE WHEN wt.type = 'deposit' THEN 1 END) as deposit_count,
       COUNT(CASE WHEN wt.type = 'purchase' THEN 1 END) as purchase_count
     FROM wallets w
     LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
     WHERE w.user_id = $1
     GROUP BY w.id, w.balance, w.total_deposited, w.total_spent`,
    [userId]
  );

  return rows[0] || {
    balance: 0,
    total_deposited: 0,
    total_spent: 0,
    total_deposits: 0,
    total_purchases: 0,
    total_refunds: 0,
    deposit_count: 0,
    purchase_count: 0
  };
}

// Trừ tiền từ ví (dùng khi thanh toán bằng ví)
async function deductFromWallet(userId, amount, description, referenceType, referenceId) {
  const wallet = await getUserWallet(userId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Sử dụng function để trừ tiền
    const { rows } = await client.query(
      `SELECT update_wallet_balance($1, $2, 'purchase', $3, $4, $5, 'wallet') as transaction_id`,
      [wallet.id, amount, description, referenceType, referenceId]
    );

    await client.query('COMMIT');

    return { success: true, transactionId: rows[0].transaction_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Hoàn tiền vào ví
async function refundToWallet(userId, amount, description, referenceType, referenceId) {
  const wallet = await getUserWallet(userId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT update_wallet_balance($1, $2, 'refund', $3, $4, $5, 'system') as transaction_id`,
      [wallet.id, amount, description, referenceType, referenceId]
    );

    await client.query('COMMIT');

    return { success: true, transactionId: rows[0].transaction_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Hủy các deposit request hết hạn
async function cancelExpiredDepositRequests() {
  const { rows } = await pool.query(
    `UPDATE deposit_requests 
     SET status = 'expired', updated_at = NOW()
     WHERE status = 'pending' AND expires_at < NOW()
     RETURNING id, user_id, amount`
  );

  return rows;
}

export {
  getUserWallet,
  createDepositRequest,
  updateDepositRequest,
  findDepositRequestByCode,
  getUserDepositRequests,
  processSuccessfulDeposit,
  getWalletTransactions,
  getWalletStats,
  deductFromWallet,
  refundToWallet,
  cancelExpiredDepositRequests
};