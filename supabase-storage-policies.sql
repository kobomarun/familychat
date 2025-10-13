-- Storage Policies for chat-images bucket
-- Run this in Supabase SQL Editor if you're having upload issues

-- Allow anyone to upload to chat-images bucket
CREATE POLICY "Allow public uploads to chat-images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

-- Allow anyone to read from chat-images bucket
CREATE POLICY "Allow public reads from chat-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

-- Allow anyone to update objects in chat-images (optional)
CREATE POLICY "Allow public updates to chat-images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'chat-images')
WITH CHECK (bucket_id = 'chat-images');

-- Allow anyone to delete from chat-images (optional, for testing)
CREATE POLICY "Allow public deletes from chat-images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-images');

