import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Channel, CreateChannelInput } from '@/types/feeds';

// GET /api/channels - List all channels for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: channels, error: fetchError } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch channels error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    const formattedChannels: Channel[] = (channels || []).map((c) => ({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      description: c.description,
      color: c.color,
      icon: c.icon,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return NextResponse.json({ channels: formattedChannels });

  } catch (error) {
    console.error('List channels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/channels - Create a new channel
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

    const body: CreateChannelInput = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      );
    }

    const { data: channel, error: insertError } = await supabase
      .from('channels')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#4A8FE7',
        icon: icon || 'folder',
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert channel error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create channel' },
        { status: 500 }
      );
    }

    const formattedChannel: Channel = {
      id: channel.id,
      userId: channel.user_id,
      name: channel.name,
      description: channel.description,
      color: channel.color,
      icon: channel.icon,
      createdAt: channel.created_at,
      updatedAt: channel.updated_at,
    };

    return NextResponse.json({ channel: formattedChannel });

  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
