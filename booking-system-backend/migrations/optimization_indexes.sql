-- Optimization Migration
-- Add indexes for common filter/order/stats columns

-- Timestamps
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_converted_at ON leads(converted_at);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_created_at ON lead_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_schedule_enrollments_created_at ON schedule_enrollments(created_at);

-- Foreign Keys and Filter Columns
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_course_id ON bookings(course_id);
CREATE INDEX IF NOT EXISTS idx_schedule_enrollments_student_id ON schedule_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_schedule_enrollments_status ON schedule_enrollments(enrollment_status);
