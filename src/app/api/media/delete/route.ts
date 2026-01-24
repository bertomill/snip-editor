import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const { fileId, storagePath } = body;

    if (!fileId && !storagePath) {
      return NextResponse.json(
        { error: 'File ID or storage path is required' },
        { status: 400 }
      );
    }

    const bucketName = 'videos';

    // Construct the path to delete
    // The path should be in format: userId/filename
    let pathToDelete = storagePath;

    // If storagePath not provided, try to find the file
    if (!pathToDelete) {
      // List user's files to find the one with matching ID
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list(user.id);

      if (listError) {
        return NextResponse.json(
          { error: 'Failed to find file' },
          { status: 500 }
        );
      }

      const file = files?.find(f => f.id === fileId || f.name.startsWith(fileId));
      if (file) {
        pathToDelete = `${user.id}/${file.name}`;
      } else {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
    }

    // Security check: ensure the path starts with user's ID
    if (!pathToDelete.startsWith(user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this file' },
        { status: 403 }
      );
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([pathToDelete]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
