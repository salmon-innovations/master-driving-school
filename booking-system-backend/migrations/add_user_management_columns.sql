-- Migration: Add user management columns to users table
-- Run this migration to add branch_id, status, and other management fields

-- Add status column (active, inactive)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add branch_id column as foreign key to branches table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Add last_login column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Add is_verified column (email verification)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Update existing users to have a default status if null
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Update existing users to have is_verified true if null
UPDATE users SET is_verified = true WHERE is_verified IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index for status
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Create index for branch_id
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- Display confirmation
SELECT 'Migration completed successfully!' as message;
