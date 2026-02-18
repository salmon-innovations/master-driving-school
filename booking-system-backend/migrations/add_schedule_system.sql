-- Migration: Add Schedule System Tables
-- Based on Schedule.jsx modal structure for "Set New Slot"
-- Run this after existing migrations are applied

-- Create schedules table for managing daily schedules
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, branch_id) -- One schedule per date per branch
);

-- Create schedule_slots table for individual time slots
CREATE TABLE IF NOT EXISTS schedule_slots (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('tdc', 'pdc')),
    session VARCHAR(50) NOT NULL CHECK (session IN ('Morning', 'Afternoon', 'Whole Day')),
    time_range VARCHAR(50) NOT NULL, -- e.g., "08:00 AM - 12:00 PM"
    total_capacity INTEGER NOT NULL DEFAULT 15,
    available_slots INTEGER NOT NULL DEFAULT 15,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'full', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_available_slots CHECK (available_slots <= total_capacity AND available_slots >= 0)
);

-- Create student_enrollments table for booking students into slots
CREATE TABLE IF NOT EXISTS student_enrollments (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES schedule_slots(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(50) DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    notes TEXT,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_id, student_id) -- Prevent duplicate enrollments
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_branch_id ON schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_schedule_id ON schedule_slots(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_type ON schedule_slots(type);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_session ON schedule_slots(session);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_status ON schedule_slots(status);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_slot_id ON student_enrollments(slot_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student_id ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_status ON student_enrollments(enrollment_status);

-- Add comments for documentation
COMMENT ON TABLE schedules IS 'Main schedule table for daily schedules per branch';
COMMENT ON TABLE schedule_slots IS 'Individual time slots within a schedule (TDC/PDC sessions)';
COMMENT ON TABLE student_enrollments IS 'Student bookings/enrollments for specific slots';
COMMENT ON COLUMN schedules.status IS 'Schedule status: active, cancelled, completed';
COMMENT ON COLUMN schedule_slots.type IS 'Slot type: tdc (Theoretical) or pdc (Practical)';
COMMENT ON COLUMN schedule_slots.session IS 'Session type: Morning, Afternoon, or Whole Day';
COMMENT ON COLUMN schedule_slots.time_range IS 'Time range display: e.g., "08:00 AM - 12:00 PM"';
COMMENT ON COLUMN schedule_slots.total_capacity IS 'Maximum number of students for this slot';
COMMENT ON COLUMN schedule_slots.available_slots IS 'Remaining available slots';
COMMENT ON COLUMN student_enrollments.enrollment_status IS 'Enrollment status: pending, confirmed, cancelled, completed';

-- Create trigger to automatically update available_slots when students enroll
CREATE OR REPLACE FUNCTION update_available_slots()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE schedule_slots 
        SET available_slots = available_slots - 1,
            status = CASE 
                WHEN available_slots - 1 = 0 THEN 'full'
                ELSE 'active'
            END
        WHERE id = NEW.slot_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes (cancelled -> confirmed, etc.)
        IF OLD.enrollment_status = 'confirmed' AND NEW.enrollment_status IN ('cancelled', 'completed') THEN
            UPDATE schedule_slots 
            SET available_slots = available_slots + 1,
                status = 'active'
            WHERE id = NEW.slot_id;
        ELSIF OLD.enrollment_status IN ('pending', 'cancelled') AND NEW.enrollment_status = 'confirmed' THEN
            UPDATE schedule_slots 
            SET available_slots = available_slots - 1,
                status = CASE 
                    WHEN available_slots - 1 = 0 THEN 'full'
                    ELSE 'active'
                END
            WHERE id = NEW.slot_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE schedule_slots 
        SET available_slots = available_slots + 1,
            status = 'active'
        WHERE id = OLD.slot_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_available_slots
    AFTER INSERT OR UPDATE OR DELETE ON student_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_available_slots();

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trigger_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_schedule_slots_updated_at
    BEFORE UPDATE ON schedule_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_student_enrollments_updated_at
    BEFORE UPDATE ON student_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- This creates a sample schedule for today with TDC and PDC slots
INSERT INTO schedules (date, branch_id, created_by) 
SELECT CURRENT_DATE, id, id 
FROM users 
WHERE role = 'admin' 
LIMIT 1
ON CONFLICT (date, branch_id) DO NOTHING;

-- Get the inserted schedule ID and create sample slots
DO $$
DECLARE
    schedule_id INTEGER;
    admin_user_id INTEGER;
BEGIN
    -- Get today's schedule ID
    SELECT id INTO schedule_id FROM schedules WHERE date = CURRENT_DATE LIMIT 1;
    
    -- Get admin user ID
    SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    IF schedule_id IS NOT NULL THEN
        -- Insert sample slots
        INSERT INTO schedule_slots (schedule_id, type, session, time_range, total_capacity, available_slots) VALUES
        (schedule_id, 'tdc', 'Whole Day', '08:00 AM - 05:00 PM', 20, 20),
        (schedule_id, 'pdc', 'Morning', '08:00 AM - 12:00 PM', 5, 5),
        (schedule_id, 'pdc', 'Afternoon', '01:00 PM - 05:00 PM', 5, 5)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
