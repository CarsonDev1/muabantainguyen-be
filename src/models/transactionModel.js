'use strict';

import { pool } from '../setup/db.js';

async function createTransaction({ orderId, provider, providerTxId, amount, status = 'pending', meta }) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (order_id, provider, provider_tx_id, amount, status, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id` ,
    [orderId, provider, providerTxId || null, amount, status, meta ? JSON.stringify(meta) : null]
  );
  return rows[0].id;
}

async function updateTransactionById(id, fields) {
  const updates = [];
  const params = [id];
  let idx = 2;
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = $${idx}`);
    params.push(key === 'meta' ? JSON.stringify(value) : value);
    idx++;
  }
  if (!updates.length) return;
  await pool.query(`UPDATE transactions SET ${updates.join(', ')} WHERE id = $1`, params);
}

async function findTransactionByMetaCode(code) {
  const { rows } = await pool.query(
    `SELECT id, order_id, amount, status FROM transactions WHERE meta->>'code' = $1 LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

async function markOrderPaid(orderId) {
  await pool.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
}

export { createTransaction, updateTransactionById, findTransactionByMetaCode, markOrderPaid };

