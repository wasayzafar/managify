-- Add cost_price column to items table
ALTER TABLE items ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0;