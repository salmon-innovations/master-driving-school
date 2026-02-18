-- Migration: Normalize legacy booking statuses to current system
-- Old statuses: pending, confirmed, completed → Map to collectable/paid
-- Current statuses: collectable, paid, cancelled

-- Map 'pending' → 'collectable' (awaiting payment)
UPDATE bookings SET status = 'collectable', updated_at = CURRENT_TIMESTAMP WHERE status = 'pending';

-- Map 'confirmed' → 'paid' (confirmed = payment verified)
UPDATE bookings SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE status = 'confirmed';

-- Map 'completed' → 'paid' (completed = fully done)
UPDATE bookings SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE status = 'completed';

-- Update default column value
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'collectable';
