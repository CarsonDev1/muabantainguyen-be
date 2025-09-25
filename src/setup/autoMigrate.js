'use strict';

import { pool } from './db.js';

// Auto-migration for all database tables
export async function autoMigrateAll() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create wallets table
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

    // 2. Create wallet_transactions table
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

    // 3. Create deposit_requests table
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

    // 4. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deposit_requests_payment_code ON deposit_requests(payment_code)
    `);

    // 5. Create wallet creation function
    await client.query(`
      CREATE OR REPLACE FUNCTION create_user_wallet()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO wallets (user_id) VALUES (NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // 6. Create wallet creation trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_create_user_wallet ON users
    `);
    await client.query(`
      CREATE TRIGGER trigger_create_user_wallet
        AFTER INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION create_user_wallet()
    `);

    // 7. Create wallet balance update function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_wallet_balance(
        p_wallet_id UUID,
        p_amount NUMERIC,
        p_transaction_type VARCHAR(20),
        p_description TEXT DEFAULT NULL,
        p_reference_type VARCHAR(50) DEFAULT NULL,
        p_reference_id UUID DEFAULT NULL,
        p_provider VARCHAR(50) DEFAULT 'system'
      )
      RETURNS UUID AS $$
      DECLARE
        v_current_balance NUMERIC;
        v_new_balance NUMERIC;
        v_user_id UUID;
        v_transaction_id UUID;
      BEGIN
        SELECT balance, user_id INTO v_current_balance, v_user_id
        FROM wallets 
        WHERE id = p_wallet_id
        FOR UPDATE;

        IF p_transaction_type IN ('withdraw', 'purchase') AND v_current_balance < ABS(p_amount) THEN
          RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Required: %', v_current_balance, ABS(p_amount);
        END IF;

        IF p_transaction_type IN ('deposit', 'refund') THEN
          v_new_balance := v_current_balance + ABS(p_amount);
        ELSE
          v_new_balance := v_current_balance - ABS(p_amount);
        END IF;

        UPDATE wallets 
        SET 
          balance = v_new_balance,
          total_deposited = CASE WHEN p_transaction_type = 'deposit' THEN total_deposited + ABS(p_amount) ELSE total_deposited END,
          total_spent = CASE WHEN p_transaction_type = 'purchase' THEN total_spent + ABS(p_amount) ELSE total_spent END,
          updated_at = NOW()
        WHERE id = p_wallet_id;

        INSERT INTO wallet_transactions (
          wallet_id, user_id, type, amount, balance_before, balance_after,
          description, reference_type, reference_id, provider
        ) VALUES (
          p_wallet_id, v_user_id, p_transaction_type, 
          CASE WHEN p_transaction_type IN ('withdraw', 'purchase') THEN -ABS(p_amount) ELSE ABS(p_amount) END,
          v_current_balance, v_new_balance, p_description, p_reference_type, p_reference_id, p_provider
        ) RETURNING id INTO v_transaction_id;

        RETURN v_transaction_id;
      END;
      $$ LANGUAGE plpgsql
    `);

    // 8. Create wallets for existing users
    await client.query(`
      INSERT INTO wallets (user_id)
      SELECT id FROM users 
      WHERE id NOT IN (SELECT user_id FROM wallets WHERE user_id IS NOT NULL)
      ON CONFLICT (user_id) DO NOTHING
    `);

    // 9. Create other essential tables
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

    // 10. Create triggers for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements
    `);
    await client.query(`
      CREATE TRIGGER update_announcements_updated_at
        BEFORE UPDATE ON announcements
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_faqs_updated_at ON faqs
    `);
    await client.query(`
      CREATE TRIGGER update_faqs_updated_at
        BEFORE UPDATE ON faqs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings
    `);
    await client.query(`
      CREATE TRIGGER update_site_settings_updated_at
        BEFORE UPDATE ON site_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

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

// Auto-migration for all systems
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
