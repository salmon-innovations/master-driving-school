-- Add role and branch columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'student',
ADD COLUMN IF NOT EXISTS branch VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Add index for role lookup
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have default role
UPDATE users SET role = 'student' WHERE role IS NULL;
