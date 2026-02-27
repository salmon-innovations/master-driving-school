-- Add end_date column to schedule_slots
ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update existing records to have end_date = date
UPDATE schedule_slots SET end_date = date WHERE end_date IS NULL;

-- Make end_date NOT NULL after populating
ALTER TABLE schedule_slots ALTER COLUMN end_date SET NOT NULL;

-- Create index on end_date
CREATE INDEX IF NOT EXISTS idx_schedule_slots_end_date ON schedule_slots(end_date);
