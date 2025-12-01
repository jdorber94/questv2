-- Add unique constraint to prevent duplicate category names per user
ALTER TABLE categories
ADD CONSTRAINT unique_user_category_name
UNIQUE (user_id, name);
