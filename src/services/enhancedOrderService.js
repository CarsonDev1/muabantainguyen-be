'use strict';

import { getOrCreateCart, getCartItems, clearCart } from '../models/cartModel.js';
import { createOrder, listOrders, getOrderDetail } from '../models/orderModel.js';
import { payWithWallet } from '../services/walletService.js';
import { getUserWallet } from '../models/walletModel.js';
import { pool } from '../setup/db.js';
import { fulfillOrder } from './fulfillmentService.js';

// Apply voucher and calculate discount
async function applyVoucherDiscount(voucherCode, amount) {
	if (!voucherCode) {
		return { finalAmount: amount, discount: 0 };
	}

	const client = await pool.connect();
	try {
		// Get voucher
		const { rows } = await client.query(`SELECT * FROM vouchers WHERE code = $1 AND is_active = TRUE`, [
			voucherCode,
		]);

		const voucher = rows[0];
		if (!voucher) {
			throw new Error('Voucher not found or inactive');
		}

		// Check validity
		const now = new Date();
		if (voucher.valid_from && now < new Date(voucher.valid_from)) {
			throw new Error('Voucher not yet valid');
		}
		if (voucher.valid_to && now > new Date(voucher.valid_to)) {
			throw new Error('Voucher expired');
		}

		// Check max uses
		if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
			throw new Error('Voucher limit reached');
		}

		// Calculate discount
		let discounted = Number(amount);
		let discount = 0;

		if (voucher.discount_percent) {
			discount = discounted * (voucher.discount_percent / 100);
			discounted = discounted - discount;
		}

		if (voucher.discount_amount) {
			discount = Math.min(Number(voucher.discount_amount), discounted);
			discounted = Math.max(0, discounted - Number(voucher.discount_amount));
		}

		// Increment used count
		await client.query(`UPDATE vouchers SET used_count = used_count + 1 WHERE id = $1`, [voucher.id]);

		return {
			finalAmount: Number(discounted.toFixed(2)),
			discount: Number(discount.toFixed(2)),
			voucherId: voucher.id,
		};
	} finally {
		client.release();
	}
}

// Enhanced checkout với hỗ trợ thanh toán ví và voucher
async function enhancedCheckout(userId, { paymentMethod = 'sepay', useWallet = false, voucherCode = null }) {
	const cartId = await getOrCreateCart(userId);
	const items = await getCartItems(cartId);

	if (!items.length) {
		throw new Error('Cart is empty');
	}

	const orderItems = items.map((it) => ({
		productId: it.product_id,
		price: it.price,
		quantity: it.quantity,
	}));

	const subtotal = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);

	// Apply voucher if provided
	let finalTotal = subtotal;
	let discount = 0;
	let voucherId = null;

	if (voucherCode) {
		try {
			const voucherResult = await applyVoucherDiscount(voucherCode, subtotal);
			finalTotal = voucherResult.finalAmount;
			discount = voucherResult.discount;
			voucherId = voucherResult.voucherId;
		} catch (error) {
			throw new Error(`Voucher error: ${error.message}`);
		}
	}

	// Kiểm tra nếu muốn thanh toán bằng ví
	if (useWallet) {
		const wallet = await getUserWallet(userId);

		if (parseFloat(wallet.balance) < finalTotal) {
			throw new Error(`Insufficient wallet balance. Required: ${finalTotal}, Available: ${wallet.balance}`);
		}
	}

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Tạo đơn hàng với final total (sau khi áp dụng voucher)
		const { rows } = await client.query(
			`INSERT INTO orders (user_id, status, total_amount, payment_method)
       VALUES ($1, 'pending', $2, $3)
       RETURNING id`,
			[userId, finalTotal, useWallet ? 'wallet' : paymentMethod]
		);
		const orderId = rows[0].id;

		// Insert order items
		for (const it of orderItems) {
			await client.query(
				`INSERT INTO order_items (order_id, product_id, name, price, quantity)
         SELECT $1, p.id, p.name, $2, $3 FROM products p WHERE p.id = $4`,
				[orderId, it.price, it.quantity, it.productId]
			);
			await client.query(`UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2`, [
				it.productId,
				it.quantity,
			]);
		}

		// Save voucher info if used
		if (voucherId) {
			await client.query(
				`INSERT INTO order_vouchers (order_id, voucher_id, discount_amount)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
				[orderId, voucherId, discount]
			);
		}

		// Nếu thanh toán bằng ví, trừ tiền ngay
		if (useWallet) {
			await payWithWallet(userId, {
				amount: finalTotal,
				description: `Payment for order ${orderId}${voucherCode ? ` (Voucher: ${voucherCode})` : ''}`,
				referenceType: 'order',
				referenceId: orderId,
			});

			// Cập nhật trạng thái đơn hàng thành paid
			await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);

			await fulfillOrder(orderId);
		}

		// Xóa giỏ hàng
		await clearCart(cartId);

		await client.query('COMMIT');

		return {
			orderId,
			subtotal,
			discount,
			total: finalTotal,
			voucherCode: voucherCode || null,
			paymentMethod: useWallet ? 'wallet' : paymentMethod,
			status: useWallet ? 'paid' : 'pending',
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// Lấy thông tin đơn hàng với thông tin thanh toán
async function getEnhancedOrderDetail(userId, orderId) {
	const order = await getOrderDetail(userId, orderId);

	if (!order) {
		throw new Error('Order not found');
	}

	// Lấy thông tin giao dịch ví nếu có
	if (order.payment_method === 'wallet') {
		const { rows } = await pool.query(
			`SELECT id, amount, created_at, status, description
       FROM wallet_transactions 
       WHERE reference_type = 'order' AND reference_id = $1 AND user_id = $2`,
			[orderId, userId]
		);

		if (rows.length > 0) {
			order.wallet_transaction = {
				id: rows[0].id,
				amount: parseFloat(rows[0].amount),
				created_at: rows[0].created_at,
				status: rows[0].status,
				description: rows[0].description,
			};
		}
	}

	// Lấy thông tin voucher nếu có
	const { rows: voucherRows } = await pool.query(
		`SELECT ov.discount_amount, v.code, v.description
     FROM order_vouchers ov
     JOIN vouchers v ON v.id = ov.voucher_id
     WHERE ov.order_id = $1`,
		[orderId]
	);

	if (voucherRows.length > 0) {
		order.voucher = {
			code: voucherRows[0].code,
			description: voucherRows[0].description,
			discount_amount: parseFloat(voucherRows[0].discount_amount),
		};
	}

	return order;
}

// Hoàn tiền đơn hàng (admin)
async function refundOrder(orderId, { reason, adminId }) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Lấy thông tin đơn hàng
		const { rows: orderRows } = await client.query(
			`SELECT id, user_id, total_amount, status, payment_method 
       FROM orders WHERE id = $1`,
			[orderId]
		);

		if (orderRows.length === 0) {
			throw new Error('Order not found');
		}

		const order = orderRows[0];

		if (order.status === 'refunded') {
			throw new Error('Order already refunded');
		}

		if (order.status !== 'paid') {
			throw new Error('Can only refund paid orders');
		}

		// Cập nhật trạng thái đơn hàng
		await client.query(`UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1`, [orderId]);

		// Hoàn tiền vào ví
		const { processRefund } = await import('./walletService.js');
		await processRefund(order.user_id, {
			amount: parseFloat(order.total_amount),
			description: `Refund for order ${orderId}. Reason: ${reason}`,
			referenceType: 'order_refund',
			referenceId: orderId,
		});

		// Khôi phục stock cho các sản phẩm
		const { rows: orderItems } = await client.query(
			`SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
			[orderId]
		);

		for (const item of orderItems) {
			await client.query(`UPDATE products SET stock = stock + $2 WHERE id = $1`, [
				item.product_id,
				item.quantity,
			]);
		}

		// Decrement voucher used count if applicable
		await client.query(
			`UPDATE vouchers v
       SET used_count = GREATEST(0, used_count - 1)
       FROM order_vouchers ov
       WHERE ov.order_id = $1 AND ov.voucher_id = v.id`,
			[orderId]
		);

		await client.query('COMMIT');

		return {
			success: true,
			orderId,
			refundAmount: order.total_amount,
			message: 'Order refunded successfully',
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// Lấy thống kê đơn hàng của user
async function getUserOrderStats(userId) {
	const { rows } = await pool.query(
		`SELECT 
       COUNT(*) as total_orders,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
       COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_orders,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_spent,
       COUNT(CASE WHEN payment_method = 'wallet' THEN 1 END) as wallet_payments,
       COUNT(CASE WHEN payment_method != 'wallet' THEN 1 END) as external_payments
     FROM orders 
     WHERE user_id = $1`,
		[userId]
	);

	return {
		total_orders: parseInt(rows[0].total_orders),
		pending_orders: parseInt(rows[0].pending_orders),
		paid_orders: parseInt(rows[0].paid_orders),
		refunded_orders: parseInt(rows[0].refunded_orders),
		total_spent: parseFloat(rows[0].total_spent),
		wallet_payments: parseInt(rows[0].wallet_payments),
		external_payments: parseInt(rows[0].external_payments),
	};
}

export { enhancedCheckout, getEnhancedOrderDetail, refundOrder, getUserOrderStats };
