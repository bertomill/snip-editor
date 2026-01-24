import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MediaFile, MediaType } from '@/types/media';

// Determine media type from file extension
function getMediaTypeFromName(fileName: string): MediaType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'hevc', 'm4v'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

  if (videoExtensions.includes(ext)) return 'video';
  if (imageExtensions.includes(ext)) return 'image';
  if (audioExtensions.includes(ext)) return 'audio';

  return 'video'; // Default
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // List files from Supabase Storage
    const bucketName = 'videos';
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list(user.id, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      console.error('List error:', listError);
      return NextResponse.json(
        { error: 'Failed to list files' },
        { status: 500 }
      );
    }

    // Filter out placeholder files
    const validFiles = (files || []).filter(file => file.name !== '.emptyFolderPlaceholder');

    // Generate signed URLs for all files
    const mediaFiles: MediaFile[] = await Promise.all(
      validFiles.map(async (file) => {
        const storagePath = `${user.id}/${file.name}`;

        // Get signed URL (works even if bucket is not public)
        const { data: signedUrlData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days expiry

        return {
          id: file.id || file.name,
          name: file.name,
          type: getMediaTypeFromName(file.name),
          url: signedUrlData?.signedUrl || '',
          size: file.metadata?.size || 0,
          userId: user.id,
          createdAt: file.created_at || new Date().toISOString(),
          storagePath: storagePath,
        };
      })
    );

    return NextResponse.json({ files: mediaFiles });

  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
