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
import cors from 'cors';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { pool, probeDatabase } from './setup/db.js';
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

// *** CHỐNG DDOS/SPAM – GLOBAL CONFIG ***
app.set('trust proxy', 1); // bắt buộc khi chạy sau Nginx

const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 300,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests. Please try again later.' },
});

const speedLimiter = slowDown({
	windowMs: 60 * 1000,
	delayAfter: 120,
	delayMs: () => 250, // NEW behavior for express-slow-down v2
});

// Rate limit cho login
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	message: { error: 'Too many login attempts. Try again later.' },
});

// *** SECURITY HEADERS ***
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: 'cross-origin' },
		crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
	})
);

// *** CORS ***
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
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// *** BODY PROTECTION ***
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// *** BASE MIDDLEWARE ***
app.use(cookieParser());
app.use(morgan('combined'));
// app.use(activityLogger);

// *** HEALTH CHECK FOR DOCKER ***
app.get('/api/health', async (_req, res) => {
	const db = await probeDatabase();
	const status = db.ok ? 200 : 503;
	return res.status(status).json({ ok: true, db: db.ok ? 'up' : 'down', error: db.ok ? undefined : db.error });
});

// *** APPLY PROTECTION FOR ALL API ***
app.use('/api', speedLimiter, apiLimiter); // chống spam global

// *** ROUTES ***
app.use('/api/auth', speedLimiter, apiLimiter, loginLimiter, authRoutes);
app.use('/api/products', speedLimiter, apiLimiter, productRoutes);
app.use('/api/password', passwordResetRoutes);
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

// *** SWAGGER DOCS ***
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.join(__dirname, 'docs', 'openapi.json');

let cachedSpec = null;
app.get('/api-docs.json', (req, res) => {
	if (!cachedSpec) {
		cachedSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
	}
	res.json(cachedSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/api-docs.json' }));

// *** SERVER START ***
const port = process.env.PORT || 4000;
app.listen(port, async () => {
	try {
		await pool.query('SELECT 1');
		// await initDatabase();
		console.log(`[server] Listening on port ${port}`);
	} catch (err) {
		console.error('[server] Database connection failed:', err.message);
		process.exit(1);
	}
});

// *** CRON JOB ***
cron.schedule('0 2 * * *', async () => {
	console.log('[cron] Running expired deliveries cleanup...');
	try {
		await cleanupExpiredDeliveries();
	} catch (error) {
		console.error('[cron] Cleanup failed:', error);
	}
});

export default app;
