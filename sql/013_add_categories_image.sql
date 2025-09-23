-- Add image column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_image ON categories(image);
