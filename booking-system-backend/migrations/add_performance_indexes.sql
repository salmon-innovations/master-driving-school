-- =============================================================================
-- Performance indexes for Render Basic PostgreSQL
-- Run once against production DB: psql $DATABASE_URL -f migrations/add_performance_indexes.sql
-- All indexes use IF NOT EXISTS — safe to re-run.
-- =============================================================================

-- bookings ────────────────────────────────────────────────────────────────────
-- Most dashboard queries filter/join on status and branch_id
CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_branch_status
    ON bookings(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id
    ON bookings(user_id);

-- Revenue and date-range queries use created_at
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
    ON bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_branch_created
    ON bookings(branch_id, created_at DESC);

-- Walk-in filter
CREATE INDEX IF NOT EXISTS idx_bookings_enrollment_type
    ON bookings(enrollment_type)
    WHERE enrollment_type = 'walk-in';

-- Pending bookings (hit constantly from dashboard + student profile)
CREATE INDEX IF NOT EXISTS idx_bookings_pending
    ON bookings(branch_id, created_at DESC)
    WHERE status = 'pending';

-- schedule_enrollments ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_se_student_id
    ON schedule_enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_se_slot_id
    ON schedule_enrollments(slot_id);

CREATE INDEX IF NOT EXISTS idx_se_status
    ON schedule_enrollments(enrollment_status);

CREATE INDEX IF NOT EXISTS idx_se_created_at
    ON schedule_enrollments(created_at DESC);

-- schedule_slots ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ss_branch_date
    ON schedule_slots(branch_id, date);

CREATE INDEX IF NOT EXISTS idx_ss_course_type
    ON schedule_slots(course_type);

-- users ───────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_branch_id
    ON users(branch_id);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

-- transactions / payments (if table exists) ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_txn_booking_id ON transactions(booking_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_txn_status    ON transactions(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_txn_created   ON transactions(transaction_date DESC)';
  END IF;
END$$;

-- notifications table (if exists) ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC)';
  END IF;
END$$;
