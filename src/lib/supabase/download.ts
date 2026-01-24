import { createClient } from './server';

/**
 * Download a file from Supabase Storage on the server
 * Returns the file as a Buffer
 */
export async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from('videos')
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download from storage: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from storage');
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download a file from a signed URL
 * This is useful when we already have a signed URL
 */
export async function downloadFromSignedUrl(signedUrl: string): Promise<Buffer> {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`Failed to download from signed URL: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a file from Supabase Storage
 * Used to clean up after transcription
 */
export async function deleteFromStorage(storagePath: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from('videos')
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete from storage: ${error.message}`);
    return false;
  }

  return true;
}
