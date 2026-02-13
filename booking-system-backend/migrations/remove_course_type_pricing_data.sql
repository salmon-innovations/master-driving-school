-- Migration: Remove course_type and pricing_data columns from courses table
-- Date: 2026-02-12
-- Description: Drop course_type and pricing_data columns as they are no longer needed

-- Remove course_type column
ALTER TABLE courses 
DROP COLUMN IF EXISTS course_type;

-- Remove pricing_data column
ALTER TABLE courses 
DROP COLUMN IF EXISTS pricing_data;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'courses'
ORDER BY ordinal_position;
