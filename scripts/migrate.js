'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/setup/db.js';

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, '../sql');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`[migrate] Running ${file}`);
    await pool.query(sql);
  }
  console.log('[migrate] Done');
  process.exit(0);
}

run().catch((err) => {
  console.error('[migrate] Error:', err);
  process.exit(1);
});

