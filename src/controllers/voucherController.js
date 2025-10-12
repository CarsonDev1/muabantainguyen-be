'use strict';

import { pool } from '../setup/db.js';

async function applyVoucherController(req, res) {
  try {
    const { code, amount } = req.body;
    if (!code || amount == null) return res.status(400).json({ message: 'Missing fields' });
    const { rows } = await pool.query(`SELECT * FROM vouchers WHERE code = $1 AND is_active = TRUE`, [code]);
    const v = rows[0];
    if (!v) return res.status(404).json({ message: 'Voucher not found' });
    const now = new Date();
    if ((v.valid_from && now < new Date(v.valid_from)) || (v.valid_to && now > new Date(v.valid_to))) {
      return res.status(400).json({ message: 'Voucher not valid' });
    }
    if (v.max_uses && v.used_count >= v.max_uses) return res.status(400).json({ message: 'Voucher limit reached' });
    let discounted = Number(amount);
    if (v.discount_percent) discounted = discounted * (1 - v.discount_percent / 100);
    if (v.discount_amount) discounted = Math.max(0, discounted - Number(v.discount_amount));
    return res.json({ message: 'Voucher applied successfully', discountedAmount: Number(discounted.toFixed(2)) });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to apply voucher', error: err.message });
  }
}

export { applyVoucherController };

