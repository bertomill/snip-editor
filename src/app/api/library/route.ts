import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/library - Get published posts for AI context
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forContext = searchParams.get('forContext') === 'true';

    // Fetch published posts
    let query = supabase
      .from('ideas')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      console.error('Fetch library error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch library' },
        { status: 500 }
      );
    }

    // If forContext is true, return a simplified format for AI
    if (forContext) {
      const contextPosts = (posts || []).map(p => ({
        title: p.title,
        content: p.published_content || p.draft_content || p.description,
        platform: p.published_platforms?.[0] || null,
        date: p.published_at || p.updated_at,
        tags: p.tags || [],
      })).filter(p => p.content); // Only include posts with content

      return NextResponse.json({ posts: contextPosts });
    }

    // Full format for library view
    const formattedPosts = (posts || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      channelId: p.channel_id,
      title: p.title,
      description: p.description,
      draftContent: p.draft_content,
      platformDrafts: p.platform_drafts,
      publishedContent: p.published_content,
      publishedAt: p.published_at,
      publishedPlatforms: p.published_platforms,
      tags: p.tags || [],
      imageUrl: p.image_url,
      videoUrl: p.video_url,
      status: p.status,
      targetPlatforms: p.target_platforms || [],
      metadata: p.metadata || {},
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({ posts: formattedPosts });

  } catch (error) {
    console.error('Library API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
