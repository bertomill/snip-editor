import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEO_STATS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  });

  if (!response.ok) {
    return null;
  }

  const tokens = await response.json();
  return tokens.access_token;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get YouTube connection
    const { data: connection } = await supabase
      .from('social_connections')
      .select('access_token, refresh_token, token_expires_at, provider_user_id')
      .eq('user_id', user.id)
      .eq('provider', 'youtube')
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 400 });
    }

    let accessToken = connection.access_token;

    // Check if token is expired
    if (new Date(connection.token_expires_at) < new Date()) {
      const newToken = await refreshAccessToken(connection.refresh_token);
      if (!newToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
      accessToken = newToken;

      // Update the token in database
      await supabase
        .from('social_connections')
        .update({
          access_token: newToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider', 'youtube');
    }

    // Fetch user's videos
    const videosResponse = await fetch(
      `${YOUTUBE_VIDEOS_URL}?part=snippet&forMine=true&type=video&maxResults=50&order=date`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!videosResponse.ok) {
      const errorData = await videosResponse.text();
      console.error('YouTube videos fetch error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    const videosData = await videosResponse.json();

    if (!videosData.items || videosData.items.length === 0) {
      return NextResponse.json({ videos: [], topPerforming: [] });
    }

    // Get video IDs for stats lookup
    const videoIds = videosData.items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

    // Fetch video statistics
    const statsResponse = await fetch(
      `${YOUTUBE_VIDEO_STATS_URL}?part=statistics,snippet&id=${videoIds}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!statsResponse.ok) {
      console.error('YouTube stats fetch error');
      return NextResponse.json({ error: 'Failed to fetch video stats' }, { status: 500 });
    }

    const statsData = await statsResponse.json();

    // Combine video data with statistics
    const videos: YouTubeVideo[] = statsData.items.map((item: {
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
      };
      statistics: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }) => {
      const views = parseInt(item.statistics.viewCount || '0', 10);
      const likes = parseInt(item.statistics.likeCount || '0', 10);
      const comments = parseInt(item.statistics.commentCount || '0', 10);

      // Calculate engagement rate: (likes + comments) / views * 100
      const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.high?.url ||
                      item.snippet.thumbnails.medium?.url ||
                      item.snippet.thumbnails.default?.url || '',
        views,
        likes,
        comments,
        engagementRate: Math.round(engagementRate * 100) / 100,
      };
    });

    // Sort by engagement rate to get top performing
    const topPerforming = [...videos]
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10);

    // Also provide sorted by views
    const mostViewed = [...videos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return NextResponse.json({
      videos,
      topPerforming,
      mostViewed,
      totalVideos: videos.length,
      summary: {
        totalViews: videos.reduce((sum, v) => sum + v.views, 0),
        totalLikes: videos.reduce((sum, v) => sum + v.likes, 0),
        totalComments: videos.reduce((sum, v) => sum + v.comments, 0),
        avgEngagementRate: videos.length > 0
          ? Math.round((videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length) * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error('YouTube videos API error:', error);
    return NextResponse.json({ error: 'Failed to fetch YouTube data' }, { status: 500 });
  }
}
