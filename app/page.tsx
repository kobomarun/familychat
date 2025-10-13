'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Message } from '@/lib/supabaseClient'
import { format } from 'date-fns'

// Family members list
const FAMILY_MEMBERS = ['Daddy', 'Mummy', 'Tosin', 'Kemi']

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
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [showIOSInstallPrompt, setShowIOSInstallPrompt] = useState(false)

  // Load current user from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('familychat_username')
    if (savedName) {
      setCurrentUser(savedName)
      setIsNameSet(true)
    }
  }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission)
        })
      }
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
            setMessages((prev) => [...prev, newMsg])
            
            // Show notification if message is from someone else and window is not focused
            if (newMsg.sender !== currentUser) {
              if (!document.hasFocus() || document.hidden) {
                showNotification(newMsg.sender, newMsg.content)
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

  // Simulate online status (could be improved with presence)
  useEffect(() => {
    if (!currentUser) return

    // Add current user to online list
    setOnlineUsers([currentUser])

    // You could enhance this with Supabase Presence
    // For now, it's just a placeholder for the feature
  }, [currentUser])

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
    if (!newMessage.trim() || !selectedContact) return

    const message = {
      sender: currentUser,
      receiver: selectedContact,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
    }

    const { error } = await supabase.from('messages').insert([message])

    if (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please check your Supabase configuration.')
      return
    }

    setNewMessage('')
    setShowEmojiPicker(false)
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
              <span>Open the app from your <strong>Home Screen</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Sidebar - Contacts List */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
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
                  className="text-xs text-gray-500 hover:text-blue-400"
                  title="Click to enable notifications"
                >
                  🔕 Enable
                </button>
              )}
              {notificationPermission === 'default' && (
                <button
                  onClick={requestNotificationPermission}
                  className="text-xs text-yellow-400 hover:text-blue-400"
                  title="Click to enable notifications"
                >
                  🔔 Enable
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
            <h3 className="text-xs text-gray-500 uppercase font-semibold mb-2">
              Family Members
            </h3>
            <div className="space-y-1">
              {FAMILY_MEMBERS.filter((member) => member !== currentUser).map(
                (member) => (
                  <button
                    key={member}
                    onClick={() => setSelectedContact(member)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-150 ${
                      selectedContact === member
                        ? 'bg-primary-dark text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {selectedContact}
                </h2>
                <p className="text-xs text-gray-400">
                  {onlineUsers.includes(selectedContact)
                    ? 'Online'
                    : 'Offline'}
                </p>
              </div>
              <button
                onClick={handleClearChat}
                className="text-gray-400 hover:text-red-400 text-sm px-3 py-1 rounded border border-gray-700 hover:border-red-400 transition-colors"
              >
                Clear Chat
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-900 to-chat-bg">
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
                        className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl ${
                          isSent
                            ? 'bg-message-sent text-white rounded-br-none'
                            : 'bg-message-received text-white rounded-bl-none'
                        }`}
                      >
                        <p className="break-words">{message.content}</p>
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
            <div className="bg-gray-900 border-t border-gray-800 p-4">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {/* Emoji picker button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-gray-400 hover:text-primary text-2xl p-2"
                  >
                    😊
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full mb-2 bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-700">
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
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-full transition-colors duration-200"
                >
                  Send
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


