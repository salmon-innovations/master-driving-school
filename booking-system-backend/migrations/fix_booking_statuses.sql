-- Migration: Normalize legacy booking statuses to current system
-- Old statuses: pending, confirmed, completed → Map to partial_payment/paid
-- Current statuses: partial_payment, paid, cancelled

-- Map 'pending' → 'partial_payment' (awaiting payment)
UPDATE bookings SET status = 'partial_payment', updated_at = CURRENT_TIMESTAMP WHERE status = 'pending';

-- Map 'confirmed' → 'paid' (confirmed = payment verified)
UPDATE bookings SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE status = 'confirmed';

-- Map 'completed' → 'paid' (completed = fully done)
UPDATE bookings SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE status = 'completed';

-- Update default column value
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'partial_payment';
