import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { MediaFile, MediaType } from '@/types/media';

// Determine media type from file
function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'video'; // Default to video
}

// Get bucket name based on media type
function getBucketName(type: MediaType): string {
  // Use 'media' bucket for all types, or create separate buckets
  // For now, use 'videos' bucket since it exists
  return 'videos';
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Determine media type
    const mediaType = getMediaType(file.type);
    const bucketName = getBucketName(mediaType);

    // Generate unique file path
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop() || '';
    const storagePath = `${user.id}/${fileId}.${fileExtension}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Get signed URL (works even if bucket is not public)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days expiry

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
    }

    // Create media file record
    const mediaFile: MediaFile = {
      id: fileId,
      name: file.name,
      type: mediaType,
      url: signedUrlData?.signedUrl || '',
      size: file.size,
      userId: user.id,
      createdAt: new Date().toISOString(),
      storagePath: storagePath,
    };

    // Store metadata in database (optional - we can list from storage directly)
    // For now, we'll rely on storage listing

    return NextResponse.json({
      success: true,
      file: mediaFile
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
