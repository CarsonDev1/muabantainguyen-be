-- First, handle existing duplicate phone numbers by setting them to NULL
-- Keep the phone number for the oldest user (first created)
WITH ranked_users AS (
  SELECT id, phone, 
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) as rn
  FROM users 
  WHERE phone IS NOT NULL
)
UPDATE users 
SET phone = NULL 
WHERE id IN (
  SELECT id FROM ranked_users WHERE rn > 1
);

-- Add unique constraint to phone field
ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);

-- Add index for phone field for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
