-- sql/011_wallet_system.sql

-- Bảng ví người dùng
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_spent NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng giao dịch ví
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'deposit', 'withdraw', 'purchase', 'refund'
  amount NUMERIC(15,2) NOT NULL,
  balance_before NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50), -- 'order', 'payment', 'admin', 'system'
  reference_id UUID, -- ID của order, payment, etc.
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'cancelled'
  provider VARCHAR(50), -- 'sepay', 'momo', 'admin', 'system'
  provider_tx_id TEXT, -- ID giao dịch từ provider
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng yêu cầu nạp tiền
CREATE TABLE IF NOT EXISTS deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'sepay', 'momo', 'bank_transfer'
  payment_code TEXT NOT NULL, -- Mã thanh toán để user chuyển khoản
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired', 'cancelled'
  provider VARCHAR(50) NOT NULL,
  provider_tx_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL, -- Hết hạn sau 30 phút
  completed_at TIMESTAMPTZ,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_payment_code ON deposit_requests(payment_code);

-- Trigger để tự động tạo ví khi tạo user
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_user_wallet ON users;
CREATE TRIGGER trigger_create_user_wallet
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_wallet();

-- Function để cập nhật số dư ví an toàn
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
  -- Lock wallet row để tránh race condition
  SELECT balance, user_id INTO v_current_balance, v_user_id
  FROM wallets 
  WHERE id = p_wallet_id
  FOR UPDATE;

  -- Kiểm tra số dư nếu là giao dịch trừ tiền
  IF p_transaction_type IN ('withdraw', 'purchase') AND v_current_balance < ABS(p_amount) THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Required: %', v_current_balance, ABS(p_amount);
  END IF;

  -- Tính số dư mới
  IF p_transaction_type IN ('deposit', 'refund') THEN
    v_new_balance := v_current_balance + ABS(p_amount);
  ELSE
    v_new_balance := v_current_balance - ABS(p_amount);
  END IF;

  -- Cập nhật wallet
  UPDATE wallets 
  SET 
    balance = v_new_balance,
    total_deposited = CASE WHEN p_transaction_type = 'deposit' THEN total_deposited + ABS(p_amount) ELSE total_deposited END,
    total_spent = CASE WHEN p_transaction_type = 'purchase' THEN total_spent + ABS(p_amount) ELSE total_spent END,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Tạo transaction record
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
$$ LANGUAGE plpgsql;

-- Tạo ví cho users đã tồn tại
INSERT INTO wallets (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM wallets WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;