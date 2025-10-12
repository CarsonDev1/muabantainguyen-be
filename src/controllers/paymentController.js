'use strict';

import { createSepayTransaction, getPaymentInstructions, verifySepaySignature, handleSepayWebhook } from '../services/sepayService.js';
import { handleDepositWebhook as handleWalletDepositWebhook } from '../services/walletService.js';
import { checkout } from '../services/orderService.js';

async function startPaymentController(req, res) {
  try {
    const { orderId, amount } = req.body;
    if (!orderId || !amount) return res.status(400).json({ message: 'Missing fields' });
    const tx = await createSepayTransaction({ orderId, amount });
    const instructions = getPaymentInstructions({ amount, code: tx.code });
    return res.status(201).json({ message: 'Payment initiated successfully', transactionId: tx.transactionId, instructions });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to start payment', error: err.message });
  }
}

async function checkoutAndCreatePaymentController(req, res) {
  try {
    const result = await checkout(req.user.id, { paymentMethod: 'sepay' });
    const tx = await createSepayTransaction({ orderId: result.orderId, amount: result.total });
    const instructions = getPaymentInstructions({ amount: result.total, code: tx.code });
    return res.status(201).json({ message: 'Checkout and payment initiated successfully', orderId: result.orderId, transactionId: tx.transactionId, instructions });
  } catch (err) {
    const code = err.message.includes('empty') ? 400 : 500;
    return res.status(code).json({ message: 'Checkout failed', error: err.message });
  }
}

async function sepayWebhookController(req, res) {
  try {
    if (!verifySepaySignature(req)) return res.status(401).json({ message: 'Invalid signature' });
    const body = req.body;
    // If content contains a DEP code, forward to wallet deposit handler as well
    const rawContent = body.content || body.code || body.description || '';
    const depMatch = String(rawContent).toUpperCase().match(/DEP[A-Z0-9]+/);
    let result = await handleSepayWebhook(body);
    if (depMatch) {
      try { await handleWalletDepositWebhook(body); } catch (e) { /* swallow to not fail main webhook */ }
    }
    return res.json({ message: 'Webhook processed successfully', ...result });
  } catch (err) {
    return res.status(400).json({ message: 'Webhook error', error: err.message });
  }
}

export { startPaymentController, checkoutAndCreatePaymentController, sepayWebhookController };

