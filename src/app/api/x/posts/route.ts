import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// X API v2 endpoint
const X_API_BASE = 'https://api.twitter.com/2';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's X connection
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('access_token, refresh_token, token_expires_at, provider_user_id')
      .eq('user_id', user.id)
      .eq('provider', 'x')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'X account not connected' }, { status: 404 });
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      // Token expired, try to refresh
      const refreshResult = await refreshAccessToken(connection.refresh_token);
      if (refreshResult.error) {
        return NextResponse.json({ error: 'Token expired, please reconnect' }, { status: 401 });
      }
      accessToken = refreshResult.access_token;

      // Update stored tokens
      await supabase
        .from('social_connections')
        .update({
          access_token: refreshResult.access_token,
          refresh_token: refreshResult.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + refreshResult.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider', 'x');
    }

    // Fetch user's recent tweets
    const response = await fetch(
      `${X_API_BASE}/users/${connection.provider_user_id}/tweets?max_results=10&tweet.fields=created_at,public_metrics,text`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('X API error:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: response.status });
    }

    const data = await response.json();

    // Transform to a simpler format
    const posts = data.data?.map((tweet: {
      id: string;
      text: string;
      created_at: string;
      public_metrics?: {
        like_count: number;
        retweet_count: number;
        reply_count: number;
      };
    }) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
    })) || [];

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('X posts fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { error: 'Failed to refresh token' };
    }

    return await response.json();
  } catch {
    return { error: 'Failed to refresh token' };
  }
}
