ALTER TABLE schedule_enrollments
  ADD COLUMN IF NOT EXISTS reschedule_fee_paid BOOLEAN NOT NULL DEFAULT FALSE;
