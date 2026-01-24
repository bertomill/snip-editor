import { createClient } from './server'
import fs from 'fs'

/**
 * Server-only storage functions
 * These use next/headers and can only be called from server components or API routes
 */

/**
 * Upload a rendered video from the server filesystem to Supabase storage
 * Returns a signed URL for download
 */
export async function uploadRenderedVideo(
  userId: string,
  renderId: string,
  localFilePath: string
): Promise<{ path: string; signedUrl: string } | null> {
  const supabase = await createClient()

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
