import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Entity, CreateEntityInput } from '@/types/feeds';

// GET /api/entities - List all entities with their social accounts
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch entities
    const { data: entities, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Fetch entities error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
    }

    // Fetch social accounts for all entities
    const entityIds = (entities || []).map(e => e.id);
    const { data: socialAccounts, error: socialError } = await supabase
      .from('social_accounts')
      .select('*')
      .in('entity_id', entityIds.length > 0 ? entityIds : ['none'])
      .order('created_at', { ascending: true });

    if (socialError) {
      console.error('Fetch social accounts error:', socialError);
    }

    // Group social accounts by entity
    const accountsByEntity = (socialAccounts || []).reduce((acc, sa) => {
      if (!acc[sa.entity_id]) acc[sa.entity_id] = [];
      acc[sa.entity_id].push({
        id: sa.id,
        entityId: sa.entity_id,
        userId: sa.user_id,
        platform: sa.platform,
        handle: sa.handle,
        profileUrl: sa.profile_url,
        createdAt: sa.created_at,
        updatedAt: sa.updated_at,
      });
      return acc;
    }, {} as Record<string, Entity['socialAccounts']>);

    const formattedEntities: Entity[] = (entities || []).map((e) => ({
      id: e.id,
      userId: e.user_id,
      name: e.name,
      type: e.type,
      avatarUrl: e.avatar_url,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      socialAccounts: accountsByEntity[e.id] || [],
    }));

    return NextResponse.json({ entities: formattedEntities });

  } catch (error) {
    console.error('List entities error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/entities - Create a new entity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateEntityInput = await request.json();
    const { name, type, avatarUrl } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: entity, error: insertError } = await supabase
      .from('entities')
      .insert({
        name: name.trim(),
        type: type || 'person',
        avatar_url: avatarUrl || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert entity error:', insertError);
      return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
    }

    const formattedEntity: Entity = {
      id: entity.id,
      userId: entity.user_id,
      name: entity.name,
      type: entity.type,
      avatarUrl: entity.avatar_url,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      socialAccounts: [],
    };

    return NextResponse.json({ entity: formattedEntity });

  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
