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
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

export { pool };
