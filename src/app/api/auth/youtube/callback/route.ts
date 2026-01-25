import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_CHANNEL_URL = 'https://www.googleapis.com/youtube/v3/channels';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=youtube_auth_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?error=youtube_auth_invalid', request.url));
    }

    const supabase = await createClient();

    // Look up state first (state is cryptographically random and unique)
    const { data: oauthState } = await supabase
      .from('oauth_states')
      .select('code_verifier, user_id')
      .eq('provider', 'youtube')
      .eq('state', state)
      .single();

    if (!oauthState) {
      return NextResponse.redirect(new URL('/?error=youtube_auth_invalid_state', request.url));
    }

    const userId = oauthState.user_id;

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/youtube/callback`,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code_verifier: oauthState.code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('YouTube token error:', errorData);
      return NextResponse.redirect(new URL('/?error=youtube_auth_token_failed', request.url));
    }

    const tokens = await tokenResponse.json();

    // Get channel info from YouTube
    const channelResponse = await fetch(
      `${YOUTUBE_CHANNEL_URL}?part=snippet&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let channelInfo = null;
    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      if (channelData.items && channelData.items.length > 0) {
        channelInfo = channelData.items[0];
      }
    }

    // Store the connection in database
    await supabase.from('social_connections').upsert({
      user_id: userId,
      provider: 'youtube',
      provider_user_id: channelInfo?.id || null,
      provider_username: channelInfo?.snippet?.title || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

    // Clean up oauth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'youtube');

    // Redirect back to app with success
    return NextResponse.redirect(new URL('/?social_connected=youtube', request.url));
  } catch (error) {
    console.error('YouTube OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=youtube_auth_failed', request.url));
  }
}
