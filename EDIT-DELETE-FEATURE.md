# Edit & Delete Messages Feature

This guide explains how to use the WhatsApp-style message editing and deletion features in Family Chat.

## 🎯 Features

### ✅ **Message Editing**
- Edit your own text messages
- Visual edit mode with preview
- Shows "(edited)" indicator after editing
- Real-time sync across all users

### ✅ **Message Deletion**
- Delete your own messages permanently
- Confirmation dialog before deletion
- Removes from database and all users' views

### ✅ **Copy Messages**
- Copy any message text to clipboard
- Works on both your own and received messages

## 📱 How to Use

### **Desktop (Right-Click)**

1. **Right-click** on any message to open the context menu
2. Choose from available options:
   - **Edit** - Edit your own text messages
   - **Delete** - Delete your own messages
   - **Copy** - Copy message text to clipboard

### **Mobile (Long-Press)**

1. **Long-press** (hold for 500ms) on any message
2. Context menu appears at the center of the screen
3. Choose from available options (same as desktop)

## 🔧 Database Setup

### **For New Installations**

If you're setting up a new database, simply run the updated `supabase-schema.sql` file which includes the `edited` and `edited_at` columns.

### **For Existing Databases**

If you already have a Family Chat database, you need to add the new columns:

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Run the migration script:

```sql
-- Add columns for message editing
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
```

Or simply run the provided `supabase-edit-delete-migration.sql` file.

## 🎨 User Interface

### **Editing Mode**

When you edit a message:
- A green indicator bar appears above the input showing the original message
- Input placeholder changes to "Edit message..."
- Cancel button (❌) appears to exit edit mode
- Press **Enter** or click **Send** to save the edit
- Message shows "(edited)" after the timestamp

### **Context Menu**

The context menu shows:
- **Edit** icon (✏️) - Only for your own text messages
- **Delete** icon (🗑️) - Only for your own messages  
- **Copy** icon (📋) - For all messages

### **Permission System**

- **Edit**: Only your own text messages (not images)
- **Delete**: Only your own messages (both text and images)
- **Copy**: Any message with text content

## ⚙️ Technical Details

### **Database Schema**

```sql
messages (
  id UUID PRIMARY KEY,
  sender TEXT,
  receiver TEXT,
  content TEXT,
  image_url TEXT,
  image_name TEXT,
  has_image BOOLEAN,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  edited BOOLEAN DEFAULT FALSE,      -- NEW
  edited_at TIMESTAMPTZ               -- NEW
)
```

### **Message States**

- **Normal Message**: `edited = false`, `edited_at = null`
- **Edited Message**: `edited = true`, `edited_at = timestamp of edit`
- **Deleted Message**: Completely removed from database

### **Real-time Updates**

- Edits are immediately visible to all users via Supabase real-time
- Deletions sync across all connected clients
- Chat list updates to show latest message after edits/deletions

## 🚀 Future Enhancements

Potential features to add:
- **Edit History**: View previous versions of edited messages
- **Delete for Everyone**: Option to delete from all users (like WhatsApp)
- **Delete for Me**: Delete only from your view
- **Time Limit**: Restrict editing/deletion to recent messages only
- **Bulk Delete**: Select and delete multiple messages

## 💡 Tips

1. **Editing**: You can only edit text messages, not images
2. **Deleting**: Images will also be deleted (consider adding cleanup for storage)
3. **Copy**: Click "Copy" to quickly copy message text to clipboard
4. **Cancel Edit**: Press the ❌ button or select another message to cancel editing
5. **Mobile**: Hold for at least 500ms to trigger the long-press menu

## ⚠️ Important Notes

- **Deleted messages are permanent** - they cannot be recovered
- **Edit history is not tracked** - only the latest version is stored
- **No time restrictions** - you can edit/delete messages at any time
- **Image editing not supported** - you can only edit text content

## 🔒 Privacy & Security

- Only the sender can edit or delete their own messages
- Edits are marked with "(edited)" for transparency
- Deletions are permanent and remove data from the database
- All operations respect the existing Row Level Security policies

---

Enjoy your enhanced messaging experience! 🎉

