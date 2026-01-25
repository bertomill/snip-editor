import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_USER_URL = 'https://api.twitter.com/2/users/me';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('X OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=x_auth_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?error=x_auth_invalid', request.url));
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Verify state and get code verifier
    const { data: oauthState } = await supabase
      .from('oauth_states')
      .select('code_verifier')
      .eq('user_id', user.id)
      .eq('provider', 'x')
      .eq('state', state)
      .single();

    if (!oauthState) {
      return NextResponse.redirect(new URL('/?error=x_auth_invalid_state', request.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/x/callback`,
        code_verifier: oauthState.code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('X token error:', errorData);
      return NextResponse.redirect(new URL('/?error=x_auth_token_failed', request.url));
    }

    const tokens = await tokenResponse.json();

    // Get user info from X
    const userResponse = await fetch(X_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let xUser = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      xUser = userData.data;
    }

    // Store the connection in database
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      provider: 'x',
      provider_user_id: xUser?.id || null,
      provider_username: xUser?.username || null,
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
      .eq('user_id', user.id)
      .eq('provider', 'x');

    // Redirect back to app with success
    return NextResponse.redirect(new URL('/?social_connected=x', request.url));
  } catch (error) {
    console.error('X OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }
}
