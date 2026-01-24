import { createClient } from './client'

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
