import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SocialAccount, CreateSocialAccountInput } from '@/types/feeds';

// GET /api/social-accounts - List all social accounts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    let query = supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data: accounts, error: fetchError } = await query;

    if (fetchError) {
      console.error('Fetch social accounts error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch social accounts' }, { status: 500 });
    }

    const formattedAccounts: SocialAccount[] = (accounts || []).map((sa) => ({
      id: sa.id,
      entityId: sa.entity_id,
      userId: sa.user_id,
      platform: sa.platform,
      handle: sa.handle,
      profileUrl: sa.profile_url,
      createdAt: sa.created_at,
      updatedAt: sa.updated_at,
    }));

    return NextResponse.json({ socialAccounts: formattedAccounts });

  } catch (error) {
    console.error('List social accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/social-accounts - Create a new social account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSocialAccountInput = await request.json();
    const { entityId, platform, handle, profileUrl } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'Entity ID is required' }, { status: 400 });
    }

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Verify entity belongs to user
    const { data: entity } = await supabase
      .from('entities')
      .select('id')
      .eq('id', entityId)
      .eq('user_id', user.id)
      .single();

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const { data: account, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        entity_id: entityId,
        user_id: user.id,
        platform,
        handle: handle?.trim() || null,
        profile_url: profileUrl?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This platform is already added for this entity' }, { status: 400 });
      }
      console.error('Insert social account error:', insertError);
      return NextResponse.json({ error: 'Failed to create social account' }, { status: 500 });
    }

    const formattedAccount: SocialAccount = {
      id: account.id,
      entityId: account.entity_id,
      userId: account.user_id,
      platform: account.platform,
      handle: account.handle,
      profileUrl: account.profile_url,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    };

    return NextResponse.json({ socialAccount: formattedAccount });

  } catch (error) {
    console.error('Create social account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
