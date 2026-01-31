import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UpdateSocialAccountInput } from '@/types/feeds';

// PATCH /api/social-accounts/[id] - Update a social account
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

    const body: UpdateSocialAccountInput = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.handle !== undefined) updates.handle = body.handle?.trim() || null;
    if (body.profileUrl !== undefined) updates.profile_url = body.profileUrl?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: account, error: updateError } = await supabase
      .from('social_accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !account) {
      return NextResponse.json({ error: 'Failed to update social account' }, { status: 500 });
    }

    return NextResponse.json({
      socialAccount: {
        id: account.id,
        entityId: account.entity_id,
        userId: account.user_id,
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profile_url,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      }
    });

  } catch (error) {
    console.error('Update social account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/social-accounts/[id] - Delete a social account
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
      .from('social_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete social account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete social account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
