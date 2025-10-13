// WebRTC Configuration and Helpers for Audio Calls

// Free public STUN servers for NAT traversal
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export interface CallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-decline' | 'call-end'
  from: string
  to: string
  data?: any
  timestamp: string
}

export interface CallState {
  isInCall: boolean
  isCalling: boolean
  isReceivingCall: boolean
  callWith: string | null
  isMuted: boolean
  callStartTime: number | null
}

// Create a new RTCPeerConnection
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  })
}

// Get user's audio stream
export async function getLocalAudioStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
    return stream
  } catch (error) {
    console.error('Error accessing microphone:', error)
    throw new Error('Could not access microphone. Please check permissions.')
  }
}

// Stop all tracks in a media stream
export function stopMediaStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
}

// Format call duration in MM:SS
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Check if browser supports WebRTC
export function isWebRTCSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  )
}

