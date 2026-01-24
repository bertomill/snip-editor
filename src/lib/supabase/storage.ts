import { createClient } from './client'
import { createClient as createServerClient } from './server'
import fs from 'fs'

/**
 * Upload a rendered video from the server filesystem to Supabase storage
 * Returns a signed URL for download
 */
export async function uploadRenderedVideo(
  userId: string,
  renderId: string,
  localFilePath: string
): Promise<{ path: string; signedUrl: string } | null> {
  const supabase = await createServerClient()

  // Read the file from local filesystem
  const fileBuffer = fs.readFileSync(localFilePath)
  const storagePath = `${userId}/renders/${renderId}.mp4`

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true
    })

  if (uploadError) {
    console.error('Supabase upload error:', uploadError)
    return null
  }

  // Create a signed URL (1 hour expiry)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('videos')
    .createSignedUrl(storagePath, 3600)

  if (signedError || !signedData?.signedUrl) {
    console.error('Signed URL error:', signedError)
    return null
  }

  return { path: storagePath, signedUrl: signedData.signedUrl }
}

export async function uploadVideo(
  userId: string,
  projectId: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  const supabase = createClient()

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = `${userId}/${projectId}/${fileName}`

  const { error } = await supabase.storage
    .from('videos')
    .upload(filePath, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: { publicUrl } } = supabase.storage
    .from('videos')
    .getPublicUrl(filePath)

  return { path: filePath, url: publicUrl }
}

export async function deleteVideo(path: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from('videos')
    .remove([path])

  if (error) {
    console.error('Delete error:', error)
    return false
  }

  return true
}

export async function getVideoUrl(path: string): Promise<string | null> {
  const supabase = createClient()

  const { data } = await supabase.storage
    .from('videos')
    .createSignedUrl(path, 3600) // 1 hour expiry

  return data?.signedUrl ?? null
}
