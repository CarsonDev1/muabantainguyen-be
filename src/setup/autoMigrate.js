'use strict';

import { pool } from './db.js';

// Auto-migration for all database tables
export async function autoMigrateAll() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        phone VARCHAR(20),
        avatar_url TEXT,
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 1. Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Password resets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 3. Wallets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_deposited NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_spent NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 4. Wallet transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        balance_before NUMERIC(15,2) NOT NULL,
        balance_after NUMERIC(15,2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50),
        reference_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        provider VARCHAR(50),
        provider_tx_id TEXT,
        meta JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 5. Deposit requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
        amount NUMERIC(15,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_code TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        provider VARCHAR(50) NOT NULL,
        provider_tx_id TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        meta JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 6. Announcements
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 7. FAQs
    await client.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 8. Site settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 9. Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status)`);

    // 10. Trigger: auto create wallet when new user created
    await client.query(`
      CREATE OR REPLACE FUNCTION create_user_wallet()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO wallets (user_id) VALUES (NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`DROP TRIGGER IF EXISTS trigger_create_user_wallet ON users`);
    await client.query(`
      CREATE TRIGGER trigger_create_user_wallet
        AFTER INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION create_user_wallet()
    `);

    // 11. Trigger: auto update updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    const tablesWithUpdatedAt = [
      'users',
      'refresh_tokens',
      'password_resets',
      'wallets',
      'wallet_transactions',
      'deposit_requests',
      'announcements',
      'faqs',
      'site_settings'
    ];

    for (const tbl of tablesWithUpdatedAt) {
      await client.query(`DROP TRIGGER IF EXISTS update_${tbl}_updated_at ON ${tbl}`);
      await client.query(`
        CREATE TRIGGER update_${tbl}_updated_at
          BEFORE UPDATE ON ${tbl}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
      `);
    }

    await client.query('COMMIT');
    console.log('✅ All database tables auto-migration completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database auto-migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-migration runner
export async function runAutoMigrations() {
  try {
    console.log('🔄 Starting auto-migrations...');
    await autoMigrateAll();
    console.log('✅ All auto-migrations completed successfully');
  } catch (error) {
    console.error('❌ Auto-migration failed:', error.message);
    process.exit(1);
  }
}
