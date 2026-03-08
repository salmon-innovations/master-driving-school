-- Add transaction_id column to bookings for StarPay order tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_bookings_transaction_id ON bookings(transaction_id);
