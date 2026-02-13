-- Quick migration script to add HRM role support
-- Run this on your existing database

-- Step 1: Drop existing constraint if any
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update any NULL roles to 'student'
UPDATE users 
SET role = 'student' 
WHERE role IS NULL;

-- Step 3: Update any case inconsistencies (make lowercase)
UPDATE users 
SET role = LOWER(role);

-- Step 4: Add CHECK constraint with all four roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'hrm', 'staff', 'student'));

-- Step 5: Add documentation comment
COMMENT ON COLUMN users.role IS 'User role: admin, hrm (HR Manager), staff, or student';

-- Verification queries
SELECT 'Migration completed successfully!' as status;
SELECT DISTINCT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role;
