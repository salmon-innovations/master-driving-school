-- Schedule Slots Table
CREATE TABLE IF NOT EXISTS schedule_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('tdc', 'pdc')),
    session VARCHAR(20) NOT NULL CHECK (session IN ('Morning', 'Afternoon', 'Whole Day')),
    time_range VARCHAR(50) NOT NULL,
    total_capacity INTEGER NOT NULL,
    available_slots INTEGER NOT NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule Enrollments Table
CREATE TABLE IF NOT EXISTS schedule_enrollments (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER REFERENCES schedule_slots(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(20) DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'completed', 'cancelled', 'no-show')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON schedule_slots(date);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_branch ON schedule_slots(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_enrollments_slot ON schedule_enrollments(slot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_enrollments_student ON schedule_enrollments(student_id);

-- Add comments
COMMENT ON TABLE schedule_slots IS 'Stores available time slots for TDC/PDC sessions';
COMMENT ON TABLE schedule_enrollments IS 'Tracks student enrollments in schedule slots';
COMMENT ON COLUMN schedule_slots.type IS 'Type: tdc (Theoretical) or pdc (Practical)';
COMMENT ON COLUMN schedule_slots.session IS 'Session: Morning, Afternoon, or Whole Day';
COMMENT ON COLUMN schedule_enrollments.enrollment_status IS 'Status: enrolled, completed, cancelled, or no-show';
