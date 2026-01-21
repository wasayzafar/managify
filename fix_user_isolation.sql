-- Fix user isolation issue: Delete purchases that reference items from other users
DELETE FROM purchases 
WHERE item_id NOT IN (
    SELECT i.id 
    FROM items i 
    WHERE i.user_id = purchases.user_id
);

-- Add foreign key constraint to prevent this issue in future
ALTER TABLE purchases 
ADD CONSTRAINT fk_purchases_items 
FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;