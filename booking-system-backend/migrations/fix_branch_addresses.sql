-- Fix branch addresses for better Google Maps integration
-- Run this migration to update the existing branch records

-- Update San Mateo Branch address
UPDATE branches 
SET address = '101 General Luna Street, Ampid 1, San Mateo, Rizal, Philippines'
WHERE name = 'Master Driving School San Mateo Branch';

-- Update Malabon Branch address
UPDATE branches 
SET address = '2nd Floor RLN Centre, Governor Pascual Avenue, Malabon, Metro Manila, Philippines'
WHERE name = 'Master Driving School Malabon Branch';

-- Update Las Piñas Branch address
UPDATE branches 
SET address = 'Unit 5, Triple B Bldg, Alabang-Zapote Rd, Talon Uno, Las Piñas, 1740 Metro Manila'
WHERE name = 'Master Prime Holdings Corp. Las Piñas Branch';
