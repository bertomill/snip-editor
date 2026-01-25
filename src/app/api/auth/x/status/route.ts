import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false });
    }

    const { data: connection } = await supabase
      .from('social_connections')
      .select('provider_username, connected_at')
      .eq('user_id', user.id)
      .eq('provider', 'x')
      .single();

    if (connection) {
      return NextResponse.json({
        connected: true,
        username: connection.provider_username,
        connectedAt: connection.connected_at,
      });
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error('X status check error:', error);
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await supabase
      .from('social_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'x');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('X disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
