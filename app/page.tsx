'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Message, uploadImage, compressImage } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { 
  createPeerConnection, 
  getLocalAudioStream, 
  stopMediaStream, 
  formatCallDuration,
  isWebRTCSupported,
  CallSignal,
  CallState 
} from '@/lib/webrtc'

// No more hardcoded family members - users are discovered from the database!

// Emojis for the picker
const EMOJIS = ['😊', '😂', '❤️', '👍', '🎉', '😍', '🔥', '✨', '👋', '🙏']

export default function Home() {
  const [currentUser, setCurrentUser] = useState<string>('')
  const [isNameSet, setIsNameSet] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [selectedContact, setSelectedContact] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [availableUsers, setAvailableUsers] = useState<string[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [showIOSInstallPrompt, setShowIOSInstallPrompt] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Call state
  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    isCalling: false,
    isReceivingCall: false,
    callWith: null,
    isMuted: false,
    callStartTime: null,
  })
  const [callDuration, setCallDuration] = useState(0)
  const [incomingCallFrom, setIncomingCallFrom] = useState<string | null>(null)
  
  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // New chat modal
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatRecipient, setNewChatRecipient] = useState('')

  // Load current user from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('familychat_username')
    if (savedName) {
      setCurrentUser(savedName)
      setIsNameSet(true)
    }
  }, [])

  // Check notification permission status (don't auto-request on iOS)
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }

    // Detect iOS Safari and show install prompt if not in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
    
    if (isIOS && !isInStandaloneMode) {
      // Show iOS install prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowIOSInstallPrompt(true)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  // Function to show notification
  const showNotification = (sender: string, message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New message from ${sender}`, {
        body: message,
        icon: '/chat-icon.png', // You can add an icon later
        tag: `message-${sender}`,
        requireInteraction: false,
      })

      // Play a sound (optional)
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE') // Optional notification sound
      audio.play().catch(() => {}) // Ignore errors if audio can't play
      
      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)
    }
  }

  // Fetch messages and set up realtime subscription
  useEffect(() => {
    if (!currentUser || !selectedContact) return

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender.eq.${currentUser},receiver.eq.${selectedContact}),and(sender.eq.${selectedContact},receiver.eq.${currentUser})`
        )
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
        return
      }

      setMessages(data || [])
    }

    fetchMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message
          // Only add message if it's part of current conversation
          if (
            (newMsg.sender === currentUser && newMsg.receiver === selectedContact) ||
            (newMsg.sender === selectedContact && newMsg.receiver === currentUser)
          ) {
            // Check if message already exists (prevent duplicates from optimistic updates)
            setMessages((prev) => {
              const exists = prev.some(msg => msg.id === newMsg.id)
              if (exists) return prev
              return [...prev, newMsg]
            })
            
            // Refresh available users list (in case new sender appeared)
            fetchAvailableUsers()
            
            // Show notification if message is from someone else and window is not focused
            if (newMsg.sender !== currentUser) {
              if (!document.hasFocus() || document.hidden) {
                showNotification(newMsg.sender, newMsg.content || 'Sent an image')
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, selectedContact])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch available users from database
  const fetchAvailableUsers = async () => {
    if (!currentUser) return

    try {
      // Get all unique usernames from messages table (both senders and receivers)
      const { data, error } = await supabase
        .from('messages')
        .select('sender, receiver')

      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      // Extract unique usernames (excluding current user)
      const uniqueUsers = new Set<string>()
      data?.forEach((msg) => {
        if (msg.sender !== currentUser) uniqueUsers.add(msg.sender)
        if (msg.receiver !== currentUser) uniqueUsers.add(msg.receiver)
      })

      setAvailableUsers(Array.from(uniqueUsers).sort())
    } catch (error) {
      console.error('Error in fetchAvailableUsers:', error)
    }
  }

  // Initial fetch and polling every 1 minute
  useEffect(() => {
    if (!currentUser) return

    // Fetch immediately
    fetchAvailableUsers()

    // Poll every 1 minute for new users
    const interval = setInterval(() => {
      fetchAvailableUsers()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [currentUser])

  // Simulate online status (could be improved with presence)
  useEffect(() => {
    if (!currentUser) return

    // Add current user to online list
    setOnlineUsers([currentUser])

    // You could enhance this with Supabase Presence
    // For now, it's just a placeholder for the feature
  }, [currentUser])

  // Keyboard support for lightbox (ESC to close)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [lightboxImage])

  // Call duration timer
  useEffect(() => {
    if (callState.isInCall && callState.callStartTime) {
      const interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callState.callStartTime!) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [callState.isInCall, callState.callStartTime])

  // Listen for call signals
  useEffect(() => {
    if (!currentUser) return

    const callChannel = supabase.channel(`call-${currentUser}`)
    
    callChannel
      .on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
        const signal = payload as CallSignal
        
        // Ignore signals not meant for current user
        if (signal.to !== currentUser) return

        switch (signal.type) {
          case 'call-request':
            // Incoming call
            setIncomingCallFrom(signal.from)
            setCallState(prev => ({ ...prev, isReceivingCall: true }))
            showNotification(signal.from, '📞 Incoming voice call...')
            break

          case 'call-accept':
            // Call was accepted, create offer
            if (callState.isCalling && localStreamRef.current) {
              const pc = createPeerConnection()
              peerConnectionRef.current = pc

              // Add local stream
              localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!)
              })

              // Handle remote stream
              pc.ontrack = (event) => {
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = event.streams[0]
                  remoteAudioRef.current.play()
                }
              }

              // Handle ICE candidates
              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  sendCallSignal({
                    type: 'ice-candidate',
                    from: currentUser,
                    to: signal.from,
                    data: event.candidate,
                  })
                }
              }

              // Create and send offer
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              await sendCallSignal({
                type: 'offer',
                from: currentUser,
                to: signal.from,
                data: offer,
              })

              setCallState({
                isInCall: true,
                isCalling: false,
                isReceivingCall: false,
                callWith: signal.from,
                isMuted: false,
                callStartTime: Date.now(),
              })
            }
            break

          case 'call-decline':
            // Call was declined
            alert(`${signal.from} declined the call`)
            endCall()
            break

          case 'call-end':
            // Call ended by other party
            endCall()
            break

          case 'offer':
            // Receive WebRTC offer
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(signal.data)
              const answer = await peerConnectionRef.current.createAnswer()
              await peerConnectionRef.current.setLocalDescription(answer)
              await sendCallSignal({
                type: 'answer',
                from: currentUser,
                to: signal.from,
                data: answer,
              })
            }
            break

          case 'answer':
            // Receive WebRTC answer
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(signal.data)
            }
            break

          case 'ice-candidate':
            // Receive ICE candidate
            if (peerConnectionRef.current && signal.data) {
              await peerConnectionRef.current.addIceCandidate(signal.data)
            }
            break
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(callChannel)
    }
  }, [currentUser, callState.isCalling])

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault()
    if (nameInput.trim()) {
      localStorage.setItem('familychat_username', nameInput.trim())
      setCurrentUser(nameInput.trim())
      setIsNameSet(true)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Must have either text or image
    if ((!newMessage.trim() && !selectedImage) || !selectedContact) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      let imageUrl = null
      let imageName = null

      // Upload image if selected
      if (selectedImage) {
        setUploadProgress(30)
        // Compress image first
        const compressedImage = await compressImage(selectedImage)
        setUploadProgress(50)
        
        // Upload to Supabase Storage
        imageUrl = await uploadImage(compressedImage, currentUser)
        imageName = selectedImage.name
        
        if (!imageUrl) {
          alert('Failed to upload image. Please try again.')
          setIsUploading(false)
          return
        }
        setUploadProgress(80)
      }

      const message = {
        sender: currentUser,
        receiver: selectedContact,
        content: newMessage.trim() || null,
        image_url: imageUrl,
        image_name: imageName,
        has_image: !!imageUrl,
        timestamp: new Date().toISOString(),
      }

      const { data, error } = await supabase.from('messages').insert([message]).select()

      if (error) {
        console.error('Error sending message:', error)
        alert('Failed to send message. Please check your Supabase configuration.')
        setIsUploading(false)
        return
      }

      // Optimistically add message to local state immediately
      if (data && data.length > 0) {
        setMessages((prev) => [...prev, data[0] as Message])
      }

      setUploadProgress(100)
      setNewMessage('')
      setSelectedImage(null)
      setImagePreview(null)
      setShowEmojiPicker(false)
    } catch (error) {
      console.error('Error in handleSendMessage:', error)
      alert('An error occurred while sending the message.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setSelectedImage(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedImage(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const cancelImageUpload = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear this chat?')) return

    const messagesToDelete = messages.map((m) => m.id)

    const { error } = await supabase
      .from('messages')
      .delete()
      .in('id', messagesToDelete)

    if (error) {
      console.error('Error clearing chat:', error)
      return
    }

    setMessages([])
  }

  const handleLogout = () => {
    if (confirm('Log out and clear your display name?')) {
      localStorage.removeItem('familychat_username')
      setCurrentUser('')
      setIsNameSet(false)
      setSelectedContact('')
      setMessages([])
    }
  }

  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        // Show a test notification
        showNotification('System', 'Notifications enabled! You\'ll now be notified of new messages.')
      }
    }
  }

  // WebRTC Call Functions
  const sendCallSignal = async (signal: Omit<CallSignal, 'timestamp'>) => {
    const channel = supabase.channel(`call-${signal.to}`)
    await channel.send({
      type: 'broadcast',
      event: 'call-signal',
      payload: { ...signal, timestamp: new Date().toISOString() }
    })
  }

  const initiateCall = async (contactName: string) => {
    if (!isWebRTCSupported()) {
      alert('Your browser does not support voice calls')
      return
    }

    try {
      // Get local audio stream
      const stream = await getLocalAudioStream()
      localStreamRef.current = stream

      setCallState(prev => ({ ...prev, isCalling: true, callWith: contactName }))

      // Send call request
      await sendCallSignal({
        type: 'call-request',
        from: currentUser,
        to: contactName,
      })
    } catch (error) {
      console.error('Error initiating call:', error)
      alert('Could not access microphone. Please check permissions.')
      setCallState(prev => ({ ...prev, isCalling: false, callWith: null }))
    }
  }

  const acceptCall = async () => {
    if (!incomingCallFrom) return

    try {
      // Get local audio stream
      const stream = await getLocalAudioStream()
      localStreamRef.current = stream

      // Create peer connection
      const pc = createPeerConnection()
      peerConnectionRef.current = pc

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // Handle incoming audio stream
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0]
          remoteAudioRef.current.play()
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal({
            type: 'ice-candidate',
            from: currentUser,
            to: incomingCallFrom,
            data: event.candidate,
          })
        }
      }

      // Send accept signal and wait for offer
      await sendCallSignal({
        type: 'call-accept',
        from: currentUser,
        to: incomingCallFrom,
      })

      setCallState({
        isInCall: true,
        isCalling: false,
        isReceivingCall: false,
        callWith: incomingCallFrom,
        isMuted: false,
        callStartTime: Date.now(),
      })
      setIncomingCallFrom(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      alert('Could not accept call. Please check microphone permissions.')
      endCall()
    }
  }

  const declineCall = async () => {
    if (!incomingCallFrom) return

    await sendCallSignal({
      type: 'call-decline',
      from: currentUser,
      to: incomingCallFrom,
    })

    setIncomingCallFrom(null)
    setCallState(prev => ({ ...prev, isReceivingCall: false }))
  }

  const endCall = async () => {
    // Send end call signal
    if (callState.callWith) {
      await sendCallSignal({
        type: 'call-end',
        from: currentUser,
        to: callState.callWith,
      })
    }

    // Stop local stream
    stopMediaStream(localStreamRef.current)
    localStreamRef.current = null

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Stop remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }

    // Reset call state
    setCallState({
      isInCall: false,
      isCalling: false,
      isReceivingCall: false,
      callWith: null,
      isMuted: false,
      callStartTime: null,
    })
    setCallDuration(0)
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }))
      }
    }
  }

  const handleStartNewChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatRecipient.trim()) return
    
    // Set as selected contact
    setSelectedContact(newChatRecipient.trim())
    
    // Add to available users if not already there
    if (!availableUsers.includes(newChatRecipient.trim())) {
      setAvailableUsers(prev => [...prev, newChatRecipient.trim()].sort())
    }
    
    // Close modal and reset
    setShowNewChatModal(false)
    setNewChatRecipient('')
  }

  // Name input screen
  if (!isNameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark to-chat-bg p-4">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">Family Chat</h1>
            <p className="text-gray-400">Enter your display name to get started</p>
          </div>
          <form onSubmit={handleSetName} className="space-y-4">
            <div>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name (e.g., Daddy, Mummy)"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors duration-200"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Main chat interface
  return (
    <div className="min-h-screen bg-chat-bg flex flex-col">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            {/* Close button */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl font-bold bg-gray-800 hover:bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center transition-colors z-10 shadow-lg"
              title="Close (ESC)"
            >
              ✕
            </button>
            {/* Image */}
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Action buttons */}
            <div className="mt-4 flex gap-3">
              <a
                href={lightboxImage}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                📥 Download
              </a>
              <button
                onClick={() => setLightboxImage(null)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-lg"
              >
                Close
              </button>
            </div>
            {/* Hint text */}
            <p className="text-gray-400 text-xs mt-3">Click outside or press ESC to close</p>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Start New Chat</h2>
              <p className="text-gray-400 text-sm">Enter the name of the person you want to message</p>
            </div>
            <form onSubmit={handleStartNewChat}>
              <input
                type="text"
                value={newChatRecipient}
                onChange={(e) => setNewChatRecipient(e.target.value)}
                placeholder="Enter recipient name..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChatModal(false)
                    setNewChatRecipient('')
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChatRecipient.trim()}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCallFrom && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="mb-6">
              <div className="w-24 h-24 bg-primary rounded-full mx-auto flex items-center justify-center mb-4 animate-pulse">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{incomingCallFrom}</h2>
              <p className="text-gray-400">Incoming voice call...</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={declineCall}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Controls */}
      {(callState.isInCall || callState.isCalling) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 bg-gray-900 rounded-2xl shadow-2xl p-6 min-w-[300px] border border-gray-700">
          <div className="text-center mb-4">
            <p className="text-gray-400 text-sm mb-1">
              {callState.isCalling ? 'Calling...' : 'In Call'}
            </p>
            <h3 className="text-white text-xl font-bold">{callState.callWith}</h3>
            {callState.isInCall && (
              <p className="text-primary text-lg font-mono mt-2">
                {formatCallDuration(callDuration)}
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-colors ${
                callState.isMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={callState.isMuted ? 'Unmute' : 'Mute'}
            >
              {callState.isMuted ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-full font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
              End Call
            </button>
          </div>
        </div>
      )}

      {/* iOS Install Prompt Banner */}
      {showIOSInstallPrompt && (
        <div className="bg-blue-600 text-white p-4 text-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="font-bold text-base mb-1">📱 Install Family Chat</p>
              <p className="text-xs opacity-90">
                Get notifications when family messages you!
              </p>
            </div>
            <button
              onClick={() => setShowIOSInstallPrompt(false)}
              className="ml-2 text-white hover:text-gray-200 font-bold text-lg"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 bg-blue-700 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Tap the <strong>Share</strong> button 📤 at the bottom of Safari</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Tap <strong>"Add"</strong> to install the app</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Open from <strong>Home Screen</strong>, then click <strong>🔔 Enable Alerts</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Permission Banner (iOS PWA) */}
      {notificationPermission === 'default' && (
        <div className="bg-yellow-500 text-black p-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div>
              <p className="font-bold">Enable Notifications</p>
              <p className="text-xs opacity-80">Get notified when messages arrive</p>
            </div>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="bg-black hover:bg-gray-800 text-yellow-400 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Enable
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Contacts List (Hidden on mobile when chat is selected) */}
        <div className={`w-full md:w-80 bg-gray-900 md:border-r border-gray-800 flex flex-col ${
          selectedContact ? 'hidden md:flex' : 'flex'
        }`}>
        {/* User header */}
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{currentUser}</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-green-400">● Online</p>
              {notificationPermission === 'granted' && (
                <span className="text-xs text-blue-400" title="Notifications enabled">
                  🔔
                </span>
              )}
              {notificationPermission === 'denied' && (
                <button
                  onClick={requestNotificationPermission}
                  className="text-xs text-red-400 hover:text-blue-400 flex items-center gap-1"
                  title="Notifications are blocked - click to try enabling"
                >
                  <span>🔕</span>
                  <span className="font-semibold">Blocked</span>
                </button>
              )}
              {notificationPermission === 'default' && (
                <button
                  onClick={requestNotificationPermission}
                  className="text-xs bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded font-semibold animate-pulse"
                  title="Click to enable notifications for new messages"
                >
                  🔔 Enable Alerts
                </button>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-400 text-sm"
          >
            Logout
          </button>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs text-gray-500 uppercase font-semibold">
                Available Users
              </h3>
              <button
                onClick={fetchAvailableUsers}
                className="text-xs text-primary hover:text-primary-dark"
                title="Refresh user list"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {/* New Chat Button */}
            <button
              onClick={() => setShowNewChatModal(true)}
              className="w-full mb-3 bg-primary hover:bg-primary-dark text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>

            {availableUsers.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p className="text-sm mb-2">No recent conversations</p>
                <p className="text-xs">Click "New Chat" above to start messaging someone</p>
              </div>
            ) : (
              <div className="space-y-1">
                {availableUsers.map((member) => (
                  <div key={member} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedContact(member)}
                      className={`flex-1 text-left px-4 py-4 md:py-3 rounded-lg transition-colors duration-150 active:scale-98 ${
                        selectedContact === member
                          ? 'bg-primary-dark text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{member}</p>
                          <p className="text-xs text-gray-400">
                            {onlineUsers.includes(member)
                              ? '● Online'
                              : '○ Offline'}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Call button */}
                    <button
                      onClick={() => initiateCall(member)}
                      disabled={callState.isInCall || callState.isCalling || callState.isReceivingCall}
                      className="p-4 md:p-3 bg-gray-800 hover:bg-primary active:bg-primary text-gray-300 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      title={`Call ${member}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col ${
        selectedContact ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Back button (mobile only) */}
                <button
                  onClick={() => setSelectedContact('')}
                  className="md:hidden flex-shrink-0 text-gray-400 hover:text-white p-2 -ml-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {/* Contact info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white truncate">
                    {selectedContact}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {onlineUsers.includes(selectedContact) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-2">
                {/* Call button - visible on desktop, icon-only on mobile */}
                <button
                  onClick={() => initiateCall(selectedContact)}
                  disabled={callState.isInCall || callState.isCalling || callState.isReceivingCall}
                  className="p-2 text-gray-400 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Call ${selectedContact}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>

                {/* Menu button (mobile) */}
                <button
                  onClick={handleClearChat}
                  className="md:hidden p-2 text-gray-400 hover:text-red-400"
                  title="Clear chat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* Clear button (desktop) */}
                <button
                  onClick={handleClearChat}
                  className="hidden md:block text-gray-400 hover:text-red-400 text-sm px-3 py-1 rounded border border-gray-700 hover:border-red-400 transition-colors"
                >
                  Clear Chat
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gradient-to-b from-gray-900 to-chat-bg">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 text-center">
                    No messages yet.
                    <br />
                    Send a message to start the conversation!
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isSent = message.sender === currentUser
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-xs lg:max-w-md xl:max-w-lg px-3 py-2 rounded-lg ${
                          isSent
                            ? 'bg-message-sent text-white rounded-br-sm'
                            : 'bg-message-received text-white rounded-bl-sm'
                        }`}
                      >
                        {/* Display image if present */}
                        {message.has_image && message.image_url && (
                          <div className="mb-2">
                            <img
                              src={message.image_url}
                              alt={message.image_name || 'Shared image'}
                              className="rounded-lg max-w-[200px] max-h-[200px] object-cover cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200"
                              onClick={() => setLightboxImage(message.image_url!)}
                              loading="lazy"
                            />
                          </div>
                        )}
                        {/* Display text if present */}
                        {message.content && (
                          <p className="break-words">{message.content}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(message.timestamp), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="bg-gray-900 border-t border-gray-800 p-3 md:p-4 safe-bottom">
              {/* Image preview */}
              {imagePreview && (
                <div className="mb-3 relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 rounded-lg border-2 border-primary"
                  />
                  <button
                    type="button"
                    onClick={cancelImageUpload}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Upload progress */}
              {isUploading && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Uploading...</span>
                    <span className="text-xs text-gray-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />

                {/* Attachment buttons */}
                <div className="flex gap-1 pb-2">
                  {/* Camera button */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="text-gray-400 hover:text-primary p-2.5 md:p-2"
                    title="Take photo"
                  >
                    <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  {/* Gallery/Image picker button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 hover:text-primary p-2.5 md:p-2"
                    title="Select image"
                  >
                    <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                {/* Input container */}
                <div className="flex-1 flex items-end gap-2 bg-gray-800 rounded-3xl px-4 py-2">
                  {/* Emoji picker button */}
                  <div className="relative pb-1">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-gray-400 hover:text-primary text-xl"
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-2 left-0 bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-700 z-10">
                        <div className="grid grid-cols-5 gap-1">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => addEmoji(emoji)}
                              className="text-2xl hover:bg-gray-700 p-1 rounded"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message"
                    disabled={isUploading}
                    className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-gray-500 disabled:opacity-50 py-2 text-base"
                  />
                </div>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedImage) || isUploading}
                  className="bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold p-3 md:p-2.5 rounded-full transition-colors duration-200 flex-shrink-0"
                  title={isUploading ? 'Sending...' : 'Send'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 to-chat-bg">
            <div className="text-center text-gray-500">
              <svg
                className="w-32 h-32 mx-auto mb-4 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-xl">Select a family member to start chatting</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}


