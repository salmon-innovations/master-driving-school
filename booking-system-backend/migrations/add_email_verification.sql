-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP;

-- Add index for verification lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code);
