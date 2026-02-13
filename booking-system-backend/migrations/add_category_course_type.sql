-- Migration: Add category and course_type columns to courses table
-- Date: 2026-02-12
-- Description: Add category (TDC, PDC, Basic) and course_type fields

-- Add category column
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Basic';

-- Add course_type column (for TDC: Online/F2F, for PDC: Automatic/Manual)
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS course_type VARCHAR(50);

-- Add check constraint for category
ALTER TABLE courses 
DROP CONSTRAINT IF EXISTS courses_category_check;

ALTER TABLE courses 
ADD CONSTRAINT courses_category_check 
CHECK (category IN ('TDC', 'PDC', 'Basic'));

-- Verify the changes
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'courses'
  AND column_name IN ('category', 'course_type')
ORDER BY ordinal_position;
