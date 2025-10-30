'use strict';

import { Pool } from 'pg';

const pool = new Pool({
	host: process.env.PGHOST || 'localhost',
	port: Number(process.env.PGPORT || 5432),
	database: process.env.PGDATABASE || 'muabantainguyen',
	user: process.env.PGUSER || 'postgres',
	password: process.env.PGPASSWORD || '123',
	ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
	max: 10,
	// Keep connections alive to avoid NAT/idle drops in production
	keepAlive: true,
	keepAliveInitialDelayMillis: 30000,
	idleTimeoutMillis: 30000,
	// Be more tolerant to slow network/db starts
	connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
	// Optional query/statement timeouts (supported by node-postgres)
	statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 30000),
	query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 30000),
});

// Surface background errors from the pool (e.g., network resets)
pool.on('error', (err) => {
	// Avoid leaking credentials; log succinctly
	console.error('[db] Unexpected client error:', err?.code || err?.name || 'unknown', err?.message);
});

// Lightweight DB probe for health checks
async function probeDatabase() {
	try {
		await pool.query('SELECT 1');
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err?.message || 'unknown' };
	}
}

export { pool };
export { probeDatabase };
