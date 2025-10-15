-- Migration: Add edit and delete support to messages table
-- Run this SQL in your Supabase SQL Editor if you already have an existing messages table

-- Add columns for message editing
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Optional: Add index for edited messages if you want to query them efficiently
CREATE INDEX IF NOT EXISTS messages_edited_idx ON messages(edited) WHERE edited = true;

-- Verification: Check if columns were added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages' 
  AND column_name IN ('edited', 'edited_at');

