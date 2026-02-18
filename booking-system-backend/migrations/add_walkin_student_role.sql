-- Add 'walkin_student' to the users role check constraint
-- First drop the existing constraint, then add the updated one

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'hrm', 'staff', 'student', 'walkin_student'));

-- Add enrollment_type column to bookings if not exists
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enrollment_type VARCHAR(20) DEFAULT 'online';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS course_type VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enrolled_by VARCHAR(255);

COMMENT ON COLUMN users.role IS 'User role: admin, hrm (HR Manager), staff, student, or walkin_student';
COMMENT ON COLUMN bookings.enrollment_type IS 'Enrollment type: online or walk-in';
COMMENT ON COLUMN bookings.course_type IS 'Course type selected: e.g., online, face-to-face, manual, automatic';
COMMENT ON COLUMN bookings.enrolled_by IS 'Email of admin who enrolled the student (for walk-in)';
