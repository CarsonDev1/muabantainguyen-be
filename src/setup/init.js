'use strict';

import { pool } from './db.js';

// Helper to run a SQL block safely
async function run(query) {
  await pool.query(query);
}

// Create function update_wallet_balance used by wallet services
const createUpdateWalletBalanceFn = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_wallet_balance' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.update_wallet_balance(
      p_wallet_id uuid,
      p_amount numeric,
      p_type text,
      p_description text,
      p_reference_type text,
      p_reference_id text,
      p_provider text
    ) RETURNS uuid AS $fn$
    DECLARE
      v_balance_before numeric;
      v_balance_after numeric;
      v_amount_signed numeric;
      v_tx_id uuid;
      v_user_id uuid;
    BEGIN
      SELECT w.balance, w.user_id INTO v_balance_before, v_user_id FROM wallets w WHERE w.id = p_wallet_id FOR UPDATE;

      IF p_type = 'purchase' THEN
        v_amount_signed := -ABS(p_amount);
      ELSE
        v_amount_signed := ABS(p_amount);
      END IF;

      IF p_type IN ('purchase','withdraw') AND v_balance_before < ABS(p_amount) THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
      END IF;

      UPDATE wallets
      SET balance = balance + v_amount_signed,
          total_deposited = CASE WHEN p_type = 'deposit' THEN total_deposited + ABS(p_amount) ELSE total_deposited END,
          total_spent = CASE WHEN p_type = 'purchase' THEN total_spent + ABS(p_amount) ELSE total_spent END,
          updated_at = NOW()
      WHERE id = p_wallet_id
      RETURNING balance INTO v_balance_after;

      INSERT INTO wallet_transactions (
        wallet_id, user_id, type, amount, balance_before, balance_after,
        description, reference_type, reference_id, status, provider
      ) VALUES (
        p_wallet_id, v_user_id, p_type, ABS(p_amount), v_balance_before, v_balance_after,
        p_description, p_reference_type, p_reference_id, 'success', p_provider
      ) RETURNING id INTO v_tx_id;

      RETURN v_tx_id;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END$$;
`;

// Minimal table set used across the codebase
const createTables = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  email text UNIQUE,
  phone text UNIQUE,
  password_hash text,
  avatar_url text,
  role text DEFAULT 'user',
  is_blocked boolean DEFAULT false,
  admin_role_id uuid,
  totp_secret text,
  is_2fa_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE,
  display_name text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE,
  display_name text,
  description text,
  module text
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image text,
  description text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id uuid REFERENCES carts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text,
  price numeric NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  provider text,
  provider_tx_id text,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  meta jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  description text,
  discount_percent integer,
  discount_amount numeric,
  max_uses integer,
  used_count integer DEFAULT 0,
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faqs (
  id serial PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  image text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text,
  type text DEFAULT 'text',
  display_name text,
  description text,
  category text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token text PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  secret_data text NOT NULL,
  is_sold boolean DEFAULT false,
  sold_at timestamptz,
  order_item_id uuid,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  data text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  total_deposited numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  payment_code text UNIQUE,
  provider text,
  status text DEFAULT 'pending',
  provider_tx_id text,
  meta jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_type text,
  reference_id text,
  status text DEFAULT 'success',
  provider text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  action text,
  path text,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);
`;

export async function initDatabase() {
  // Order matters: tables first, then function
  await run(createTables);
  await run(createUpdateWalletBalanceFn);
}


