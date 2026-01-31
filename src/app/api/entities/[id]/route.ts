import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Entity, UpdateEntityInput } from '@/types/feeds';

// GET /api/entities/[id] - Get a single entity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: entity, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Fetch social accounts
    const { data: socialAccounts } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('entity_id', id)
      .order('created_at', { ascending: true });

    const formattedEntity: Entity = {
      id: entity.id,
      userId: entity.user_id,
      name: entity.name,
      type: entity.type,
      avatarUrl: entity.avatar_url,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      socialAccounts: (socialAccounts || []).map(sa => ({
        id: sa.id,
        entityId: sa.entity_id,
        userId: sa.user_id,
        platform: sa.platform,
        handle: sa.handle,
        profileUrl: sa.profile_url,
        createdAt: sa.created_at,
        updatedAt: sa.updated_at,
      })),
    };

    return NextResponse.json({ entity: formattedEntity });

  } catch (error) {
    console.error('Get entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/entities/[id] - Update an entity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateEntityInput = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.type !== undefined) updates.type = body.type;
    if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: entity, error: updateError } = await supabase
      .from('entities')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !entity) {
      return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
    }

    return NextResponse.json({
      entity: {
        id: entity.id,
        userId: entity.user_id,
        name: entity.name,
        type: entity.type,
        avatarUrl: entity.avatar_url,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      }
    });

  } catch (error) {
    console.error('Update entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/entities/[id] - Delete an entity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('entities')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
