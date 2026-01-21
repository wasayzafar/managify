-- Add payment_type and credit_deadline columns to purchases table
ALTER TABLE purchases 
ADD COLUMN payment_type TEXT DEFAULT 'debit' CHECK (payment_type IN ('debit', 'credit')),
ADD COLUMN credit_deadline DATE;