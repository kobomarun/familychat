# Database Setup for Edit & Delete Feature

## ⚠️ IMPORTANT: You must run this migration before the edit feature will work!

The edit and delete features require new columns in your `messages` table. Follow these steps:

## 🔧 Step-by-Step Setup

### **Step 1: Open Supabase Dashboard**

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your **Family Chat** project

### **Step 2: Open SQL Editor**

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)

### **Step 3: Run the Migration**

Copy and paste this SQL code:

```sql
-- Add columns for message editing and deletion tracking
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Optional: Add index for better performance
CREATE INDEX IF NOT EXISTS messages_edited_idx 
ON messages(edited) 
WHERE edited = true;
```

Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

### **Step 4: Verify the Migration**

Run this verification query to confirm the columns were added:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages' 
  AND column_name IN ('edited', 'edited_at');
```

You should see output like:

```
column_name | data_type                   | is_nullable | column_default
------------|----------------------------|-------------|---------------
edited      | boolean                     | YES         | false
edited_at   | timestamp with time zone    | YES         | NULL
```

### **Step 5: Test the Feature**

1. Refresh your Family Chat app
2. Send a test message
3. Right-click (or long-press) on your message
4. Select "Edit"
5. Make changes and press Enter
6. Message should update with "(edited)" indicator

## 🎯 What This Migration Does

### **Adds Two New Columns:**

1. **`edited`** (boolean, default: false)
   - Tracks whether a message has been edited
   - Used to show "(edited)" indicator

2. **`edited_at`** (timestamptz, nullable)
   - Stores the timestamp when the message was last edited
   - Can be used to show edit history in the future

### **Creates Performance Index:**

- Optimizes queries that filter by edited messages
- Only indexes messages where `edited = true`
- Improves performance without significant storage cost

## ❌ Troubleshooting

### **Error: "column 'edited' does not exist"**

**Solution:** Run the migration SQL above. The columns haven't been added yet.

### **Error: "permission denied for table messages"**

**Solution:** Make sure you're logged in as the database owner/admin in Supabase Dashboard.

### **Error: "Failed to edit message"**

**Possible causes:**
1. Migration not run yet → Run the SQL above
2. Network issue → Check your internet connection
3. RLS policy blocking update → Check your Row Level Security policies

To check RLS policies, run:
```sql
SELECT * FROM pg_policies WHERE tablename = 'messages';
```

### **Edit works but "(edited)" doesn't show**

**Solution:** This might be a caching issue. Try:
1. Hard refresh the page (`Ctrl+Shift+R` or `Cmd+Shift+R`)
2. Clear browser cache
3. Check if the `edited` column exists in database

## 📊 Alternative: Reset Database (Fresh Start)

If you want to start fresh with the new schema:

### **Option A: Update Existing Table (Recommended)**
Just run the migration SQL above. This preserves your existing messages.

### **Option B: Recreate Table (Deletes All Messages!)**

**⚠️ WARNING: This will delete ALL existing messages!**

```sql
-- Drop existing table
DROP TABLE IF EXISTS messages CASCADE;

-- Recreate with new schema
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  image_name TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX messages_sender_receiver_idx ON messages(sender, receiver);
CREATE INDEX messages_timestamp_idx ON messages(timestamp DESC);
CREATE INDEX messages_edited_idx ON messages(edited) WHERE edited = true;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## ✅ Verification Checklist

After running the migration, verify:

- [ ] SQL query executed without errors
- [ ] Verification query shows both new columns
- [ ] App compiles without errors
- [ ] Can send new messages
- [ ] Can edit your own messages
- [ ] "(edited)" indicator shows after editing
- [ ] Can delete your own messages
- [ ] Changes sync in real-time

## 🆘 Still Having Issues?

1. **Check browser console** for error messages
2. **Check Supabase logs** in Dashboard → Settings → Logs
3. **Verify database connection** in your `.env` file
4. **Confirm RLS policies** allow UPDATE and DELETE operations

## 📝 Next Steps

Once the migration is complete:
- ✅ Edit feature will work
- ✅ Delete feature will work
- ✅ "(edited)" indicator will show
- ✅ Real-time sync will work

---

**Need Help?** Check the `EDIT-DELETE-FEATURE.md` file for usage instructions.

