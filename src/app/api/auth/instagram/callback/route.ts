import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FACEBOOK_GRAPH_URL = 'https://graph.facebook.com/v18.0';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Instagram OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=instagram_auth_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?error=instagram_auth_invalid', request.url));
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Verify state
    const { data: oauthState } = await supabase
      .from('oauth_states')
      .select('state')
      .eq('user_id', user.id)
      .eq('provider', 'instagram')
      .eq('state', state)
      .single();

    if (!oauthState) {
      return NextResponse.redirect(new URL('/?error=instagram_auth_invalid_state', request.url));
    }

    // Exchange code for access token
    const tokenResponse = await fetch(FACEBOOK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID || '',
        client_secret: process.env.INSTAGRAM_APP_SECRET || '',
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/instagram/callback`,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Instagram token error:', errorData);
      return NextResponse.redirect(new URL('/?error=instagram_auth_token_failed', request.url));
    }

    const tokens = await tokenResponse.json();

    // Get long-lived access token
    const longLivedTokenResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.INSTAGRAM_APP_ID || '',
        client_secret: process.env.INSTAGRAM_APP_SECRET || '',
        fb_exchange_token: tokens.access_token,
      })
    );

    let accessToken = tokens.access_token;
    let expiresIn = tokens.expires_in || 3600;

    if (longLivedTokenResponse.ok) {
      const longLivedTokens = await longLivedTokenResponse.json();
      accessToken = longLivedTokens.access_token;
      expiresIn = longLivedTokens.expires_in || 5184000; // ~60 days
    }

    // Get user's Facebook Pages (required for Instagram Business accounts)
    const pagesResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/me/accounts?access_token=${accessToken}`
    );

    let instagramAccountId = null;
    let instagramUsername = null;

    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();

      // For each page, try to get the connected Instagram account
      for (const page of pagesData.data || []) {
        const igResponse = await fetch(
          `${FACEBOOK_GRAPH_URL}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        );

        if (igResponse.ok) {
          const igData = await igResponse.json();
          if (igData.instagram_business_account) {
            instagramAccountId = igData.instagram_business_account.id;

            // Get Instagram username
            const usernameResponse = await fetch(
              `${FACEBOOK_GRAPH_URL}/${instagramAccountId}?fields=username&access_token=${accessToken}`
            );

            if (usernameResponse.ok) {
              const usernameData = await usernameResponse.json();
              instagramUsername = usernameData.username;
            }
            break;
          }
        }
      }
    }

    // Store the connection in database
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      provider: 'instagram',
      provider_user_id: instagramAccountId,
      provider_username: instagramUsername,
      access_token: accessToken,
      refresh_token: null, // Instagram uses long-lived tokens instead
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

    // Clean up oauth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'instagram');

    // Redirect back to app with success
    return NextResponse.redirect(new URL('/?social_connected=instagram', request.url));
  } catch (error) {
    console.error('Instagram OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=instagram_auth_failed', request.url));
  }
}
