import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Idea, CreateIdeaInput } from '@/types/feeds';

// GET /api/ideas - List all ideas for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const status = searchParams.get('status');

    let query = supabase
      .from('ideas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (channelId) {
      if (channelId === 'uncategorized') {
        query = query.is('channel_id', null);
      } else {
        query = query.eq('channel_id', channelId);
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: ideas, error: fetchError } = await query;

    if (fetchError) {
      console.error('Fetch ideas error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch ideas' },
        { status: 500 }
      );
    }

    const formattedIdeas: Idea[] = (ideas || []).map((i) => ({
      id: i.id,
      userId: i.user_id,
      channelId: i.channel_id,
      title: i.title,
      description: i.description,
      draftContent: i.draft_content,
      platformDrafts: i.platform_drafts,
      tags: i.tags || [],
      imageUrl: i.image_url,
      videoUrl: i.video_url,
      status: i.status,
      targetPlatforms: i.target_platforms || [],
      metadata: i.metadata || {},
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));

    return NextResponse.json({ ideas: formattedIdeas });

  } catch (error) {
    console.error('List ideas error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/ideas - Create a new idea
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateIdeaInput = await request.json();
    const { title, description, draftContent, platformDrafts, channelId, tags, imageUrl, videoUrl, status, targetPlatforms, metadata } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Idea title is required' },
        { status: 400 }
      );
    }

    // Verify channel belongs to user if provided
    if (channelId) {
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

    const { data: idea, error: insertError } = await supabase
      .from('ideas')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        draft_content: draftContent?.trim() || null,
        platform_drafts: platformDrafts || null,
        channel_id: channelId || null,
        tags: tags || [],
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        status: status || 'draft',
        target_platforms: targetPlatforms || [],
        metadata: metadata || {},
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert idea error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create idea' },
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
    console.error('Create idea error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
