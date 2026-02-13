-- Add status column to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Update any existing NULL values
UPDATE courses 
SET status = 'active' 
WHERE status IS NULL;

-- Remove category column if it exists (cleanup from previous version)
ALTER TABLE courses DROP COLUMN IF EXISTS category;

-- Add comments for documentation
COMMENT ON COLUMN courses.status IS 'Course status: active or inactive';
