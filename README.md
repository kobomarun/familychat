# 👨‍👩‍👧‍👦 Family Chat

A minimal, real-time family chat web app built with **Next.js**, **React**, and **Supabase**.

![Family Chat](https://img.shields.io/badge/Next.js-14-black)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue)

## ✨ Features

- 🚀 **Real-time messaging** using Supabase Realtime subscriptions
- 💬 **One-on-one chats** between family members
- 🎨 **Clean, modern UI** inspired by WhatsApp/iMessage
- 😊 **Emoji picker** for expressing emotions
- 📱 **Fully responsive** design
- 🔒 **No authentication required** - just enter your display name
- 🧹 **Clear chat** functionality
- ⚡ **Instant message delivery** and updates
- 🕒 **Message timestamps**
- 📍 **Auto-scroll** to latest messages
- 🔔 **Browser notifications** when new messages arrive
- 🔊 **Notification sound** for incoming messages
- 📸 **Camera support** - Take photos directly or select from gallery
- 🖼️ **Image sharing** - Send photos with messages
- 🗜️ **Auto compression** - Images are optimized for fast loading
- 📞 **Voice calling** - Free peer-to-peer audio calls using WebRTC
- 🎙️ **Call controls** - Mute/unmute and end call buttons
- ⏱️ **Call duration** - Real-time call timer

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Supabase account ([sign up here](https://supabase.com))
- Git

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd familychat
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run the following SQL to create the `messages` table:

```sql
-- Create messages table
CREATE TABLE messages (
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
CREATE POLICY "Allow all operations on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create an index for faster queries
CREATE INDEX messages_sender_receiver_idx ON messages(sender, receiver);
CREATE INDEX messages_timestamp_idx ON messages(timestamp DESC);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create Storage Bucket for Images
-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "Create Bucket"
-- 3. Name: "chat-images"
-- 4. Set to "Public bucket" (so images can be viewed)
-- 5. File size limit: 5MB recommended
```

### 4. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

2. Get your Supabase credentials:
   - Go to **Project Settings** > **API** in your Supabase dashboard
   - Copy the **Project URL** and **anon public** key

3. Update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Deployment to Vercel

### Deploy with One Click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/familychat)

### Manual Deployment

1. Install Vercel CLI:

```bash
npm i -g vercel
```

2. Deploy:

```bash
vercel
```

3. Add environment variables in Vercel dashboard:
   - Go to **Project Settings** > **Environment Variables**
   - Add `NEXT_PUBLIC_SUPABASE_URL`
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Redeploy to apply environment variables

## 🎯 How to Use

1. **Enter Your Name**: On first visit, enter your display name (any name you want)
2. **Enable Notifications**: Click the 🔔 icon to allow browser notifications (optional but recommended)
3. **Start a New Chat**: 
   - Click the **"New Chat"** button (green button at top of sidebar)
   - Enter the recipient's name (e.g., "Daddy", "Mummy", "Tosin")
   - Click "Start Chat"
   - Start messaging!
4. **Recent Conversations**: Users you've chatted with will appear in the "Available Users" list
5. **Auto-Discovery**: New users automatically appear when they message you
5. **Make Voice Calls**:
   - 📞 Click the phone icon next to any contact name
   - Other person will receive an incoming call notification
   - Accept to start talking
6. **Share Images**: 
   - 📸 Tap the camera icon to take a photo
   - 🖼️ Tap the image icon to select from gallery
   - Photos are automatically compressed and optimized
7. **Add Emojis**: Click the emoji button to add expressions
8. **Clear Chat**: Use the "Clear Chat" button to delete conversation history

### 🔔 About Notifications

- The app will request permission to send browser notifications on first load
- You'll receive notifications when:
  - Someone sends you a message
  - The browser window is not focused or minimized
- Notifications include:
  - Sender's name
  - Message preview
  - Optional notification sound
  - Auto-close after 5 seconds
- Click on a notification to bring the app into focus
- Toggle notifications anytime using the bell icon in the header

#### 📱 Mobile Notification Support

**Android Devices** ✅
- Works perfectly in Chrome, Firefox, Samsung Internet, Edge
- No special setup required

**iPhone/iPad (iOS)** ⚠️
- **Requires "Add to Home Screen"** for notifications to work
- Steps for iOS:
  1. Open the app in Safari
  2. Tap the Share button (square with arrow)
  3. Scroll and tap "Add to Home Screen"
  4. Open the app from your home screen (not Safari)
  5. Now notifications will work!

**Why?** Apple only allows notifications for web apps installed to the home screen, not regular Safari tabs. This is a PWA (Progressive Web App) feature.

**Note:** The app will automatically detect iOS and show a banner with installation instructions!

### 📸 Image Sharing

**Features:**
- **Camera Capture**: Take photos directly from your device camera
- **Gallery Upload**: Select existing photos from your device
- **Auto-compression**: Images are automatically resized and compressed to save bandwidth
- **Smart Thumbnails**: Images show as 200x200px previews in chat
- **Lightbox Viewer**: Click any image to view full-size with:
  - Dark overlay background
  - Download button
  - Close with ESC, click outside, or close button
  - Smooth fade-in animation
- **5MB Limit**: Maximum file size to prevent abuse

**Supported Formats:**
- JPEG/JPG
- PNG
- GIF
- WebP

**Mobile Support:**
- ✅ Camera works on iOS Safari (after PWA installation)
- ✅ Camera works on Android Chrome/Firefox
- ✅ Front and back camera switching supported
- ✅ Images compressed before upload for faster sending

### 📞 Voice Calling

**Features:**
- **Free Calls**: Peer-to-peer WebRTC audio calls (no costs!)
- **One-on-One**: Direct calls between two family members
- **Call Controls**: Mute/unmute microphone, end call
- **Call Timer**: See how long you've been talking
- **Incoming Call UI**: Beautiful accept/decline modal
- **Browser Notifications**: Get notified when someone calls

**How It Works:**
1. Click the 📞 phone icon next to contact name
2. Other person sees incoming call notification
3. They click Accept
4. You're connected! Start talking
5. Use controls to mute or end call

**Requirements:**
- ✅ Microphone access (browser will ask for permission)
- ✅ Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- ✅ Both users must be online

**Call Quality:**
- Direct peer-to-peer connection for best quality
- Uses Google's free STUN servers for NAT traversal
- HD audio with echo cancellation and noise suppression

**Limitations:**
- Only 1-on-1 calls (no group calls)
- Both users must be online at the same time
- Calls don't work if behind very strict firewalls (rare)

## 🏗️ Project Structure

```
familychat/
├── app/
│   ├── globals.css          # Global styles with Tailwind
│   ├── layout.tsx            # Root layout component
│   └── page.tsx              # Main chat interface
├── lib/
│   └── supabaseClient.ts     # Supabase client + image upload helpers
├── public/                   # Static assets + PWA icons
├── .env.local.example        # Environment variables template
├── .gitignore
├── next.config.js            # Next.js configuration
├── package.json
├── postcss.config.js
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json
└── README.md
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **UI Library**: [React 18](https://react.dev/)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime + Storage)
- **Voice Calls**: [WebRTC](https://webrtc.org/) (Peer-to-peer audio)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Date Formatting**: [date-fns](https://date-fns.org/)
- **Deployment**: [Vercel](https://vercel.com/)

## 🔐 Security Notes

⚠️ **Important**: This app has **no authentication** by design. It's meant for private family use.

**Recommendations**:
- Use Supabase Row Level Security (RLS) policies to restrict access if needed
- Consider adding simple password protection at the app level
- Don't expose your deployment URL publicly if you want privacy
- For production use, implement proper authentication (Supabase Auth, NextAuth.js, etc.)

## 📝 Customization

### User Discovery

Users are **automatically discovered** from the database:
- When someone sends a message, they appear in everyone's user list
- No need to hardcode names
- New users detected every minute automatically
- Manual refresh button available

### Change Color Scheme

Edit the colors in `tailwind.config.ts`:

```typescript
colors: {
  primary: '#25D366',        // Main accent color
  'primary-dark': '#128C7E', // Darker shade
  'chat-bg': '#0a0a0a',      // Background
  'message-sent': '#005C4B',  // Sent message bubble
  'message-received': '#202C33', // Received message bubble
}
```

### Add More Emojis

Edit the `EMOJIS` array in `app/page.tsx`:

```typescript
const EMOJIS = ['😊', '😂', '❤️', '👍', '🎉', '😍', '🔥', '✨', '👋', '🙏', '🤗', '💪']
```

### Create Custom Icons

Replace the placeholder icons in `/public/`:
- `icon-192.png` - 192x192px PNG icon
- `icon-512.png` - 512x512px PNG icon

You can create icons at [realfavicongenerator.net](https://realfavicongenerator.net/)

## 🐛 Troubleshooting

### Messages not appearing in real-time?

1. Check if Realtime is enabled in Supabase:
   - Go to **Database** > **Replication** in Supabase dashboard
   - Ensure `messages` table is added to publications

2. Verify your RLS policies allow reading messages

### "Failed to send message" error?

1. Check your environment variables are correct
2. Verify RLS policies allow inserting messages
3. Check browser console for detailed error messages

### Images not uploading?

1. **Create the storage bucket**:
   - Go to **Storage** in Supabase dashboard
   - Create bucket named `chat-images`
   - Set it to **Public** bucket

2. **Check file size**: Images must be under 5MB

3. **Verify file type**: Only JPG, PNG, GIF, and WebP allowed

4. **Storage policies**: Ensure bucket allows public uploads and reads

### Calls not connecting?

1. **Check microphone permissions**:
   - Browser should ask for mic access
   - Check browser settings if blocked
   - Try refreshing and allowing again

2. **Both users must be online**:
   - Calls are peer-to-peer (not server-based)
   - Both people need to be in the app

3. **Firewall issues**:
   - Rare, but strict corporate firewalls may block WebRTC
   - Try on different network (home WiFi, mobile data)

4. **Browser compatibility**:
   - Use modern browsers: Chrome, Firefox, Safari (iOS 11+), Edge
   - WebRTC may not work in old browsers

### Build errors on Vercel?

1. Make sure environment variables are set in Vercel dashboard
2. Check that all dependencies are in `package.json`
3. Verify Node.js version compatibility (use Node 18+)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 💖 Support

If you like this project, please give it a ⭐ on GitHub!

---

**Built with ❤️ for families who want to stay connected**


