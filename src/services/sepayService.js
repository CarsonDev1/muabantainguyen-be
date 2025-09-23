'use strict';

import crypto from 'crypto';
import 'dotenv/config';
import { createTransaction, updateTransactionById, findTransactionByMetaCode, markOrderPaid } from '../models/transactionModel.js';
import { fulfillOrder } from './fulfillmentService.js';

function generatePaymentCode(orderId) {
  return `ORD-${orderId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

async function createSepayTransaction({ orderId, amount }) {
  const code = generatePaymentCode(orderId);
  const txId = await createTransaction({
    orderId,
    provider: 'sepay',
    amount,
    status: 'pending',
    meta: { code },
  });
  return { transactionId: txId, code };
}

function getPaymentInstructions({ amount, code }) {
  return {
    provider: 'sepay',
    amount,
    content: code,
    bank_account: process.env.SEPAY_ACCOUNT || '',
    note: 'Chuyển khoản với đúng nội dung để tự động xác nhận',
  };
}

function verifySepaySignature(req) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = req.headers['x-sepay-signature'] || req.headers['x-signature'];
  if (!signature) return false;
  const bodyString = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  return signature === hmac;
}

async function handleSepayWebhook(payload) {
  // Expected payload example: { content: 'ORD-XXXX', amount: 100000, status: 'success', provider_tx_id: '...' }
  const code = payload.content || payload.code;
  if (!code) throw new Error('Missing code');
  const tx = await findTransactionByMetaCode(code);
  if (!tx) throw new Error('Transaction not found');
  if (tx.status === 'success') return { ok: true };
  if (Number(payload.amount) < Number(tx.amount)) throw new Error('Amount mismatch');
  await updateTransactionById(tx.id, { status: payload.status === 'success' ? 'success' : 'failed', provider_tx_id: payload.provider_tx_id || null, meta: { code } });
  if (payload.status === 'success') {
    await markOrderPaid(tx.order_id);
    await fulfillOrder(tx.order_id);
  }
  return { ok: true };
}

export { createSepayTransaction, getPaymentInstructions, verifySepaySignature, handleSepayWebhook };

