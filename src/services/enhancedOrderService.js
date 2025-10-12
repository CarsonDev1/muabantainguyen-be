'use strict';

import { getOrCreateCart, getCartItems, clearCart } from '../models/cartModel.js';
import { createOrder, listOrders, getOrderDetail } from '../models/orderModel.js';
import { payWithWallet } from '../services/walletService.js';
import { getUserWallet } from '../models/walletModel.js';
import { pool } from '../setup/db.js';
import { fulfillOrder } from './fulfillmentService.js';

// Enhanced checkout với hỗ trợ thanh toán ví
async function enhancedCheckout(userId, { paymentMethod = 'sepay', useWallet = false }) {
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

	const total = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);

	// Kiểm tra nếu muốn thanh toán bằng ví
	if (useWallet) {
		const wallet = await getUserWallet(userId);

		if (parseFloat(wallet.balance) < total) {
			throw new Error(`Insufficient wallet balance. Required: ${total}, Available: ${wallet.balance}`);
		}
	}

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Tạo đơn hàng
		const { orderId } = await createOrder({
			userId,
			items: orderItems,
			paymentMethod: useWallet ? 'wallet' : paymentMethod,
		});

		// Nếu thanh toán bằng ví, trừ tiền ngay
		if (useWallet) {
			await payWithWallet(userId, {
				amount: total,
				description: `Payment for order ${orderId}`,
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
			total,
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
