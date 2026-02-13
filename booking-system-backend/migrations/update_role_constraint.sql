-- Update role column to accept Admin, HRM, Staff, and Student roles
-- First, drop existing constraint if any
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add CHECK constraint to ensure only valid roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'hrm', 'staff', 'student'));

-- Update any existing NULL or invalid roles to 'student' as default
UPDATE users 
SET role = 'student' 
WHERE role IS NULL 
   OR role NOT IN ('admin', 'hrm', 'staff', 'student');

-- Create comment on role column for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, hrm (HR Manager), staff, or student';
