import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Message {
  id: string
  sender: string
  receiver: string
  content: string | null
  image_url?: string | null
  image_name?: string | null
  has_image?: boolean
  timestamp: string
  created_at?: string
}

// Image upload configuration
export const STORAGE_BUCKET = 'chat-images'
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

// Helper function to upload image to Supabase Storage
export async function uploadImage(file: File, sender: string): Promise<string | null> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5MB limit')
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Only JPG, PNG, GIF, and WebP are allowed')
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const fileName = `${sender}_${timestamp}_${random}.${fileExt}`
    const filePath = `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading image:', error)
    return null
  }
}

// Helper function to compress image before upload
export async function compressImage(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = height * (maxWidth / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = width * (maxHeight / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Canvas to Blob conversion failed'))
            }
          },
          file.type,
          quality
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
  })
}


