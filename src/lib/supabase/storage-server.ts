import { createClient } from './server'
import fs from 'fs'

/**
 * Server-only storage functions
 * These use next/headers and can only be called from server components or API routes
 */

/**
 * Upload a temp video buffer to Supabase storage for rendering
 * Returns a signed URL that Remotion can use to access the video
 */
export async function uploadTempVideo(
  userId: string,
  renderId: string,
  filename: string,
  buffer: Buffer,
  contentType: string = 'video/mp4'
): Promise<{ path: string; signedUrl: string } | null> {
  const supabase = await createClient()

  const storagePath = `${userId}/temp/${renderId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true
    })

  if (uploadError) {
    console.error('Supabase temp upload error:', uploadError)
    return null
  }

  // Create a signed URL (1 hour expiry - enough time for render)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('videos')
    .createSignedUrl(storagePath, 3600)

  if (signedError || !signedData?.signedUrl) {
    console.error('Signed URL error:', signedError)
    return null
  }

  return { path: storagePath, signedUrl: signedData.signedUrl }
}

/**
 * Delete temp videos from Supabase storage after render completes
 */
export async function deleteTempVideos(
  userId: string,
  renderId: string
): Promise<boolean> {
  const supabase = await createClient()

  const folderPath = `${userId}/temp/${renderId}`

  // List all files in the temp folder
  const { data: files, error: listError } = await supabase.storage
    .from('videos')
    .list(folderPath)

  if (listError) {
    console.error('Error listing temp files:', listError)
    return false
  }

  if (!files || files.length === 0) {
    return true // Nothing to delete
  }

  // Delete all files in the folder
  const filePaths = files.map(file => `${folderPath}/${file.name}`)
  const { error: deleteError } = await supabase.storage
    .from('videos')
    .remove(filePaths)

  if (deleteError) {
    console.error('Error deleting temp files:', deleteError)
    return false
  }

  console.log(`🧹 Cleaned up ${filePaths.length} temp files from Supabase`)
  return true
}

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
