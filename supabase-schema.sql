-- Family Chat - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  image_name TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows everyone to read and insert messages
-- (Since we have no auth, we allow all operations)
-- WARNING: This is suitable for private family use only!
CREATE POLICY "Allow all operations on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON messages(sender, receiver);
CREATE INDEX IF NOT EXISTS messages_timestamp_idx ON messages(timestamp DESC);

-- Enable Realtime for the messages table
-- This allows the app to receive instant updates when new messages are inserted
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Optional: Create a function to clean up old messages (if you want to auto-delete old messages)
-- Uncomment the following if you want messages older than 30 days to be automatically deleted

/*
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run the cleanup function daily
-- Note: You'll need to enable pg_cron extension first
-- Run: CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-old-messages',
  '0 2 * * *', -- Run at 2 AM every day
  'SELECT delete_old_messages();'
);
*/

-- Create Storage Bucket for Images
-- You'll need to create this bucket manually in Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Click "Create Bucket"
-- 3. Name: "chat-images"
-- 4. Set to "Public bucket" (so images can be viewed)
-- 5. File size limit: 5MB recommended

-- Storage Policy: Allow authenticated uploads (optional, for now allow all since no auth)
-- You can set RLS policies on storage.objects table if needed

-- Example Storage Policy (run this if you want to restrict uploads):
-- CREATE POLICY "Allow public uploads to chat-images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'chat-images');

-- CREATE POLICY "Allow public reads from chat-images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'chat-images');

-- Verification queries (optional)
-- Run these to verify everything is set up correctly:

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'messages'
);

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'messages';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'messages';


