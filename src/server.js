'use strict';

import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { activityLogger } from './middleware/activityLogger.js';
import cors from 'cors';
import cron from 'node-cron';

import { pool } from './setup/db.js';
import { initDatabase } from './setup/init.js';
import authRoutes from './routes/authRoutes.js';
import passwordResetRoutes from './routes/passwordResetRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import voucherRoutes from './routes/voucherRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import { cleanupExpiredDeliveries } from './models/deliveryModel.js';

const app = express();

const corsOptions = {
	origin: [
		'http://localhost:3000',
		'http://localhost:3001',
		'https://shopmmo.pro.vn',
		'http://shopmmo.pro.vn',
		'https://tainguyemmoshop.com',
		'http://tainguyemmoshop.com',
	],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
	allowedHeaders: [
		'Content-Type',
		'Authorization',
		'X-Requested-With',
		'Accept',
		'Origin',
		'refreshtoken',
		'refreshToken',
	],
	exposedHeaders: ['Content-Range', 'X-Content-Range'],
	maxAge: 600,
};

app.use(
	helmet({
		crossOriginResourcePolicy: { policy: 'cross-origin' },
		crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
	})
);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(activityLogger);

app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/password', passwordResetRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/wallet', walletRoutes);

// Swagger UI and raw spec
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.join(__dirname, 'docs', 'openapi.json');
app.get('/api-docs.json', (req, res) => {
	try {
		const openapiDoc = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
		res.json(openapiDoc);
	} catch (e) {
		res.status(500).json({ message: 'Failed to load OpenAPI spec', error: e.message });
	}
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/api-docs.json' }));

const port = process.env.PORT || 4000;

app.listen(port, async () => {
	try {
		// Probe the DB on startup
		await pool.query('SELECT 1');
		// Ensure schema exists without manual migration
		// await // initDatabase();;
		console.log(`[server] Listening on port ${port}`);
	} catch (err) {
		console.error('[server] Database connection failed:', err.message);
		process.exit(1);
	}
});

// Run cleanup every day at 2 AM
cron.schedule('0 2 * * *', async () => {
	console.log('[cron] Running expired deliveries cleanup...');
	try {
		await cleanupExpiredDeliveries();
	} catch (error) {
		console.error('[cron] Cleanup failed:', error);
	}
});

export default app;
