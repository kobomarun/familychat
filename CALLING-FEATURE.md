# 📞 Voice Calling Feature Guide

## ✨ What's Been Added

Your Family Chat app now has **FREE peer-to-peer voice calling** using WebRTC!

### New Features:
- 📞 **Call Button** - Phone icon next to each contact
- 🔔 **Incoming Call Modal** - Beautiful accept/decline screen
- 🎙️ **Call Controls** - Mute/unmute and end call buttons
- ⏱️ **Call Timer** - Real-time duration display
- 🔊 **Call Notifications** - Browser notifications for incoming calls

---

## 🎯 How to Use

### Making a Call:
1. Click the **📞 phone icon** next to any family member's name
2. Wait for them to answer
3. Start talking!

### Receiving a Call:
1. You'll see a full-screen incoming call modal
2. Shows caller's name and two buttons
3. Click **Accept** (green) or **Decline** (red)

### During a Call:
- **Mute/Unmute**: Toggle your microphone
- **End Call**: Red button to hang up
- **Timer**: See how long you've been talking
- **Chat continues**: You can send messages while on call

---

## 🧪 How to Test

### Option 1: Two Devices
1. Open app on your phone
2. Open app on your computer
3. Log in with different names
4. Call each other!

### Option 2: Two Browser Windows
1. Open app in Chrome window → Log in as "Daddy"
2. Open app in another Chrome window (or Firefox) → Log in as "Mummy"
3. Click call button in one window
4. Accept in the other window

**Important**: Both users must be online at the same time!

---

## 🎨 UI Components

### 1. Call Button (Sidebar)
- **Location**: Next to each contact name
- **Icon**: 📞 Phone icon
- **State**: Disabled when already in a call

### 2. Incoming Call Modal
- **Full-screen overlay** with dark background
- **Pulsing phone icon** in green
- **Caller name** prominently displayed
- **Two buttons**:
  - 🟢 Accept (green)
  - 🔴 Decline (red)

### 3. Active Call Controls
- **Floating panel** at top of screen
- Shows:
  - Call status ("Calling..." or "In Call")
  - Contact name
  - Call duration timer (MM:SS)
- **Two buttons**:
  - 🎙️ Mute/Unmute (toggles red when muted)
  - 📴 End Call (red)

---

## 🔧 Technical Details

### WebRTC Architecture:
```
User A                    Supabase Realtime                    User B
  │                              │                               │
  │──call-request────────────────>─────────────────────────────>│
  │                              │                       (Incoming call!)
  │                              │                               │
  │<─────────────────────────────<──────call-accept─────────────│
  │                              │                               │
  │──WebRTC offer────────────────>─────────────────────────────>│
  │<─────────────────────────────<──────WebRTC answer───────────│
  │                              │                               │
  │<────────Direct peer-to-peer audio connection────────────────>│
  │                              │                               │
```

### Signal Types:
1. `call-request` - Initiates call
2. `call-accept` - Accepts call
3. `call-decline` - Declines call
4. `call-end` - Ends call
5. `offer` - WebRTC offer (SDP)
6. `answer` - WebRTC answer (SDP)
7. `ice-candidate` - NAT traversal data

### Call Flow:
1. **Caller** clicks phone button → Gets mic access → Sends call-request
2. **Receiver** sees incoming call modal → Clicks accept → Gets mic access
3. **Receiver** sends call-accept → Creates peer connection
4. **Caller** receives accept → Creates peer connection → Sends WebRTC offer
5. **Receiver** receives offer → Sends WebRTC answer
6. **ICE candidates** exchanged → Direct connection established
7. **Audio starts flowing** between peers!

---

## 🎙️ Audio Settings

### Auto-enabled Features:
- ✅ **Echo Cancellation**: Prevents feedback
- ✅ **Noise Suppression**: Reduces background noise
- ✅ **Auto Gain Control**: Normalizes volume

### STUN Servers Used:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

These are **free public servers** provided by Google for NAT traversal.

---

## 📱 Mobile Support

### iOS (Safari):
- ✅ Works after "Add to Home Screen" (PWA)
- ✅ Microphone permission required
- ✅ Both voice and video codec support

### Android:
- ✅ Works in Chrome, Firefox, Edge
- ✅ Microphone permission required
- ✅ Call notifications even in background

### Desktop:
- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Better audio quality than mobile
- ✅ Lower latency

---

## 🐛 Troubleshooting

### "Could not access microphone"
**Solution**:
- Click the 🔒 lock icon in browser address bar
- Change microphone permission to "Allow"
- Refresh the page

### Call not connecting
**Checklist**:
1. ✅ Both users online?
2. ✅ Both users on the app (not just logged in)?
3. ✅ Microphone permissions granted?
4. ✅ Modern browser being used?
5. ✅ Not behind strict corporate firewall?

### No sound during call
**Checklist**:
1. ✅ Volume turned up on both devices?
2. ✅ Mute button not pressed? (should be gray, not red)
3. ✅ Check browser audio settings
4. ✅ Try refreshing and calling again

### Call drops after a few seconds
**Cause**: Firewall blocking ICE candidates

**Solution**:
- Try different network (mobile data vs WiFi)
- Most home WiFi and mobile networks work fine
- Corporate firewalls sometimes block WebRTC

---

## 🔐 Privacy & Security

### What's Sent Through Supabase:
- ❌ **NOT** the audio itself
- ✅ Call signaling (who's calling who)
- ✅ WebRTC connection data (offers, answers, ICE)

### What Goes Peer-to-Peer:
- ✅ **The actual audio stream**
- ✅ Directly between the two users
- ✅ Encrypted end-to-end by WebRTC

### Privacy Benefits:
- 🔒 Audio doesn't go through any server
- 🔒 Direct device-to-device connection
- 🔒 Automatically encrypted by WebRTC
- 🔒 No recording (unless you add it)

---

## 🎯 Next Steps (Future Phases)

### Phase 2: Video Calls (Optional)
- 📹 Add camera toggle button
- 📹 Video preview before call
- 📹 Switch front/back camera
- 📹 Picture-in-picture mode

### Phase 3: Call History (Optional)
- 📋 List of past calls
- 📋 Call duration logs
- 📋 Missed call indicators
- 📋 Call back button

### Phase 4: Advanced Features (Optional)
- 🎥 Screen sharing
- 👥 Group calls (requires TURN server)
- 📞 Call waiting
- 🔄 Call transfer

---

## 📊 File Structure

### New Files:
```
lib/webrtc.ts               # WebRTC helper functions
```

### Modified Files:
```
app/page.tsx                # Added call UI and logic
README.md                   # Added calling documentation
```

### Code Added:
- ~400 lines of WebRTC logic
- ~200 lines of UI components
- ~100 lines of helper functions

---

## ✅ Testing Checklist

Before deploying, test:

- [ ] Call button appears next to contacts
- [ ] Clicking call button requests microphone
- [ ] Receiver sees incoming call modal
- [ ] Accept button starts call
- [ ] Decline button cancels call
- [ ] Both users hear each other
- [ ] Mute button works
- [ ] Unmute button works
- [ ] Call timer increments every second
- [ ] End call button stops call
- [ ] Can send messages during call
- [ ] Call notifications work
- [ ] Multiple calls in sequence work

---

**Enjoy your new voice calling feature!** 🎉📞

If you encounter any issues, check the troubleshooting section above or review the browser console for error messages.

