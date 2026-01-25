import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { platform } = body;

    if (!platform || typeof platform !== 'string' || platform.trim().length === 0) {
      return NextResponse.json({ error: 'Platform name is required' }, { status: 400 });
    }

    const platformName = platform.trim().toLowerCase();

    // Insert the request
    const { error } = await supabase.from('platform_requests').insert({
      user_id: user?.id || null,
      platform: platformName,
      requested_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Platform request error:', error);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Request submitted!' });
  } catch (error) {
    console.error('Platform request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get aggregated platform requests (for admin purposes)
    const { data, error } = await supabase
      .from('platform_requests')
      .select('platform')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Platform requests fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // Count requests per platform
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.platform] = (counts[row.platform] || 0) + 1;
    }

    return NextResponse.json({ requests: counts });
  } catch (error) {
    console.error('Platform requests fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
