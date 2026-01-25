import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Instagram OAuth 2.0 Authorization endpoint (via Facebook)
const INSTAGRAM_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Store state in database for callback verification
    await supabase.from('oauth_states').upsert({
      user_id: user.id,
      provider: 'instagram',
      state,
      code_verifier: null, // Instagram doesn't use PKCE
      created_at: new Date().toISOString(),
    });

    // Build authorization URL
    // Using Instagram Graph API permissions for business/creator accounts
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/instagram/callback`,
      scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement',
      response_type: 'code',
      state,
    });

    const authUrl = `${INSTAGRAM_AUTH_URL}?${params.toString()}`;

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Instagram OAuth init error:', error);
    return NextResponse.json({ error: 'Failed to initialize OAuth' }, { status: 500 });
  }
}
