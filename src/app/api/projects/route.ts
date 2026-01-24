import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Project } from '@/types/project';

// Helper to generate signed URL for thumbnail
async function getThumbnailSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thumbnailPath: string | null
): Promise<string | undefined> {
  if (!thumbnailPath) return undefined;

  // If it's already a full URL (legacy), return as-is
  if (thumbnailPath.startsWith('http')) return thumbnailPath;

  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUrl(thumbnailPath, 3600); // 1 hour expiry

  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

// GET /api/projects - List all projects for the current user
export async function GET() {
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

    // Fetch projects from Supabase
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch projects error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    // Transform to match our interface and generate signed URLs for thumbnails
    const formattedProjects: Project[] = await Promise.all(
      (projects || []).map(async (p) => ({
        id: p.id,
        name: p.name,
        userId: p.user_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        thumbnailUrl: await getThumbnailSignedUrl(supabase, p.thumbnail_url),
        clipCount: p.clip_count || 0,
        latestRenderStatus: p.latest_render_status,
      }))
    );

    return NextResponse.json({ projects: formattedProjects });

  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
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

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create project in Supabase
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        user_id: user.id,
        clip_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert project error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    const formattedProject: Project = {
      id: project.id,
      name: project.name,
      userId: project.user_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      thumbnailUrl: project.thumbnail_url,
      clipCount: project.clip_count || 0,
      latestRenderStatus: project.latest_render_status,
    };

    return NextResponse.json({ project: formattedProject });

  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
