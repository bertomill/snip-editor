import { NextRequest, NextResponse } from "next/server";

// Pixabay music API response types
interface PixabayMusicHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  downloads: number;
  views: number;
  likes: number;
  duration: number; // in seconds
  audio: string; // URL to the audio file
  audio_s3: string; // S3 URL
  username: string;
  userURL: string;
  user_id: number;
}

interface PixabayMusicResponse {
  total: number;
  totalHits: number;
  hits: PixabayMusicHit[];
}

// Our simplified track response
export interface MusicSearchResult {
  id: number;
  title: string;
  artist: string;
  duration: number; // in seconds
  audioUrl: string;
  previewUrl: string;
  tags: string[];
}

// Fallback demo tracks (royalty-free samples)
const DEMO_TRACKS: MusicSearchResult[] = [
  {
    id: 1,
    title: "Upbeat Energy",
    artist: "Demo Artist",
    duration: 120,
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    tags: ["upbeat", "energetic", "happy"],
  },
  {
    id: 2,
    title: "Chill Vibes",
    artist: "Demo Artist",
    duration: 90,
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3",
    tags: ["chill", "relaxing", "ambient"],
  },
  {
    id: 3,
    title: "Cinematic Epic",
    artist: "Demo Artist",
    duration: 150,
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/04/27/audio_67bcb4b00f.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/04/27/audio_67bcb4b00f.mp3",
    tags: ["cinematic", "epic", "dramatic"],
  },
];

/**
 * GET /api/music/search
 * Search for music tracks from Pixabay
 * Query params:
 *   - q: search query (optional)
 *   - category: music category (optional)
 *   - page: page number (default 1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);

    // Check for Pixabay API key
    const apiKey = process.env.PIXABAY_API_KEY;

    if (!apiKey) {
      // Return demo tracks if no API key
      console.log("No PIXABAY_API_KEY, returning demo tracks");

      // Filter demo tracks by query if provided
      let filteredTracks = DEMO_TRACKS;
      if (query) {
        const lowerQuery = query.toLowerCase();
        filteredTracks = DEMO_TRACKS.filter(
          (track) =>
            track.title.toLowerCase().includes(lowerQuery) ||
            track.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      }

      return NextResponse.json({
        tracks: filteredTracks,
        total: filteredTracks.length,
        page: 1,
        isDemo: true,
      });
    }

    // Build Pixabay API URL
    const pixabayUrl = new URL("https://pixabay.com/api/");
    pixabayUrl.searchParams.set("key", apiKey);
    pixabayUrl.searchParams.set("audio_type", "music");
    pixabayUrl.searchParams.set("per_page", "20");
    pixabayUrl.searchParams.set("page", page.toString());

    if (query) {
      pixabayUrl.searchParams.set("q", query);
    }

    if (category) {
      pixabayUrl.searchParams.set("category", category);
    }

    console.log(`Fetching music from Pixabay: ${pixabayUrl.toString().replace(apiKey, "[API_KEY]")}`);

    const response = await fetch(pixabayUrl.toString());

    if (!response.ok) {
      console.error("Pixabay API error:", response.status, response.statusText);
      throw new Error(`Pixabay API error: ${response.status}`);
    }

    const data: PixabayMusicResponse = await response.json();

    // Transform to our simplified format
    const tracks: MusicSearchResult[] = data.hits.map((hit) => ({
      id: hit.id,
      title: hit.tags.split(",")[0]?.trim() || `Track ${hit.id}`,
      artist: hit.username,
      duration: hit.duration,
      audioUrl: hit.audio || hit.audio_s3,
      previewUrl: hit.audio || hit.audio_s3,
      tags: hit.tags.split(",").map((t) => t.trim()),
    }));

    return NextResponse.json({
      tracks,
      total: data.totalHits,
      page,
      isDemo: false,
    });
  } catch (error) {
    console.error("Music search error:", error);

    // Return demo tracks on error
    return NextResponse.json({
      tracks: DEMO_TRACKS,
      total: DEMO_TRACKS.length,
      page: 1,
      isDemo: true,
      error: "Failed to fetch from Pixabay, showing demo tracks",
    });
  }
}
