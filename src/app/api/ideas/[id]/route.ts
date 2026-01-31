import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Idea, UpdateIdeaInput } from '@/types/feeds';

// GET /api/ideas/[id] - Get a single idea
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: idea, error: fetchError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      );
    }

    const formattedIdea: Idea = {
      id: idea.id,
      userId: idea.user_id,
      channelId: idea.channel_id,
      title: idea.title,
      description: idea.description,
      draftContent: idea.draft_content,
      platformDrafts: idea.platform_drafts,
      tags: idea.tags || [],
      imageUrl: idea.image_url,
      videoUrl: idea.video_url,
      status: idea.status,
      targetPlatforms: idea.target_platforms || [],
      metadata: idea.metadata || {},
      createdAt: idea.created_at,
      updatedAt: idea.updated_at,
    };

    return NextResponse.json({ idea: formattedIdea });

  } catch (error) {
    console.error('Get idea error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/ideas/[id] - Update an idea
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateIdeaInput = await request.json();
    const { title, description, draftContent, platformDrafts, channelId, tags, imageUrl, videoUrl, status, targetPlatforms, metadata } = body;

    const updates: Record<string, unknown> = {};

    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (draftContent !== undefined) updates.draft_content = draftContent?.trim() || null;
    if (platformDrafts !== undefined) updates.platform_drafts = platformDrafts;
    if (channelId !== undefined) {
      // Verify channel belongs to user if provided
      if (channelId !== null) {
        const { data: channel, error: channelError } = await supabase
          .from('channels')
          .select('id')
          .eq('id', channelId)
          .eq('user_id', user.id)
          .single();

        if (channelError || !channel) {
          return NextResponse.json(
            { error: 'Channel not found' },
            { status: 404 }
          );
        }
      }
      updates.channel_id = channelId;
    }
    if (tags !== undefined) updates.tags = tags;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    if (status !== undefined) updates.status = status;
    if (targetPlatforms !== undefined) updates.target_platforms = targetPlatforms;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: idea, error: updateError } = await supabase
      .from('ideas')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !idea) {
      console.error('Update idea error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update idea' },
        { status: 500 }
      );
    }

    const formattedIdea: Idea = {
      id: idea.id,
      userId: idea.user_id,
      channelId: idea.channel_id,
      title: idea.title,
      description: idea.description,
      draftContent: idea.draft_content,
      platformDrafts: idea.platform_drafts,
      tags: idea.tags || [],
      imageUrl: idea.image_url,
      videoUrl: idea.video_url,
      status: idea.status,
      targetPlatforms: idea.target_platforms || [],
      metadata: idea.metadata || {},
      createdAt: idea.created_at,
      updatedAt: idea.updated_at,
    };

    return NextResponse.json({ idea: formattedIdea });

  } catch (error) {
    console.error('Update idea error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/ideas/[id] - Delete an idea
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error: deleteError } = await supabase
      .from('ideas')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete idea error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete idea' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete idea error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
