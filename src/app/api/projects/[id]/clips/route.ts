import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadSourceClip, getSignedUrlForClip, deleteProjectClips } from '@/lib/supabase/storage-server';

interface ClipInput {
  data: string;          // base64 video
  filename: string;
  duration: number;
  orderIndex: number;
  transcript?: string;
  segments?: { text: string; start: number; end: number }[];
  words?: { id: string; word: string; start: number; end: number }[];
}

// POST /api/projects/[id]/clips - Save clips to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { clips } = body as { clips: ClipInput[] };

    if (!clips || !Array.isArray(clips)) {
      return NextResponse.json(
        { error: 'Clips array is required' },
        { status: 400 }
      );
    }

    // Delete existing clips for this project (clean slate approach)
    await deleteProjectClips(user.id, projectId);

    // Delete existing clip records from database
    await supabase
      .from('clips')
      .delete()
      .eq('project_id', projectId);

    // Upload and save each clip
    const savedClips = [];

    for (const clip of clips) {
      // Decode base64 and upload to storage
      const buffer = Buffer.from(clip.data, 'base64');

      // Determine content type from filename
      const ext = clip.filename.toLowerCase().split('.').pop();
      let contentType = 'video/mp4';
      if (ext === 'mov') contentType = 'video/quicktime';
      else if (ext === 'webm') contentType = 'video/webm';

      const uploadResult = await uploadSourceClip(
        user.id,
        projectId,
        clip.filename,
        buffer,
        contentType
      );

      if (!uploadResult) {
        console.error(`Failed to upload clip: ${clip.filename}`);
        continue;
      }

      // Insert clip record into database
      const { data: clipRecord, error: insertError } = await supabase
        .from('clips')
        .insert({
          project_id: projectId,
          user_id: user.id,
          storage_path: uploadResult.path,
          file_name: clip.filename,
          duration: clip.duration,
          order_index: clip.orderIndex,
          transcript: clip.transcript || null,
          segments: clip.segments || null,
          words: clip.words || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert clip record:', insertError);
        continue;
      }

      savedClips.push({
        id: clipRecord.id,
        filename: clipRecord.file_name,
        duration: clipRecord.duration,
        orderIndex: clipRecord.order_index,
      });
    }

    // Update project clip count
    await supabase
      .from('projects')
      .update({
        clip_count: savedClips.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    return NextResponse.json({
      success: true,
      clips: savedClips,
    });

  } catch (error) {
    console.error('Save clips error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/clips - Get clips for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch clips from database
    const { data: clips, error: fetchError } = await supabase
      .from('clips')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (fetchError) {
      console.error('Fetch clips error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch clips' },
        { status: 500 }
      );
    }

    // Generate signed URLs for each clip
    const clipsWithUrls = await Promise.all(
      (clips || []).map(async (clip) => {
        const signedUrl = await getSignedUrlForClip(clip.storage_path, 3600);
        return {
          id: clip.id,
          filename: clip.file_name,
          signedUrl,
          duration: clip.duration,
          orderIndex: clip.order_index,
          transcript: clip.transcript,
          segments: clip.segments,
          words: clip.words,
        };
      })
    );

    return NextResponse.json({ clips: clipsWithUrls });

  } catch (error) {
    console.error('Get clips error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
