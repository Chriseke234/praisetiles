import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeTrackResult {
  id: string;
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  durationSec?: number;
  source: 'youtube';
}

export interface YouTubeSuggestion {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  youtubeUrl: string;
}

/**
 * Extracts a standard 11-character YouTube video ID from various URL formats or raw ID.
 * Supports:
 * - https://www.youtube.com/watch?v=ID
 * - https://music.youtube.com/watch?v=ID
 * - https://m.youtube.com/watch?v=ID
 * - https://youtu.be/ID
 * - https://youtube.com/shorts/ID
 * - https://youtube.com/live/ID
 * - https://youtube.com/embed/ID
 * - Raw 11-character alphanumeric ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Raw 11-character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Shorts or Live streams: /shorts/ID or /live/ID
  const shortsOrLiveMatch = trimmed.match(/(?:shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  if (shortsOrLiveMatch) {
    return shortsOrLiveMatch[1];
  }

  // 3. Short URLs: youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return shortMatch[1];
  }

  // 4. Embed URLs: youtube.com/embed/ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) {
    return embedMatch[1];
  }

  // 5. Watch parameter: ?v=ID or &v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return watchMatch[1];
  }

  return null;
}

/**
 * Helper to fetch oEmbed metadata for a specific YouTube video ID.
 */
async function fetchOEmbedMetadata(videoId: string): Promise<{ title: string; author: string } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'PraiseTiles/1.0',
        'Accept': 'application/json',
      },
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || `YouTube Video (${videoId})`,
        author: data.author_name || 'YouTube Creator',
      };
    }
  } catch {
    // Non-blocking fallback
  }
  return null;
}

/**
 * Resolves YouTube video metadata or searches for YouTube videos.
 * GET /api/music/youtube?url={url}&q={query}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = searchParams.get('url') || searchParams.get('q');

  if (!rawInput || rawInput.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Missing url or q parameter' },
      { status: 400 }
    );
  }

  const trimmedInput = rawInput.trim();
  const directVideoId = extractYouTubeVideoId(trimmedInput);

  // CASE 1: DIRECT VIDEO ID OR URL DETECTED
  if (directVideoId) {
    const meta = await fetchOEmbedMetadata(directVideoId);
    const title = meta?.title || `YouTube Audio (${directVideoId})`;
    const author = meta?.author || 'YouTube';
    const thumbnailUrl = `https://img.youtube.com/vi/${directVideoId}/hqdefault.jpg`;
    const youtubeUrl = `https://www.youtube.com/watch?v=${directVideoId}`;

    const track: YouTubeTrackResult = {
      id: `yt-${directVideoId}`,
      videoId: directVideoId,
      title,
      author,
      thumbnailUrl,
      youtubeUrl,
      durationSec: 180,
      source: 'youtube',
    };

    return NextResponse.json({
      success: true,
      videoId: directVideoId,
      title,
      author,
      thumbnailUrl,
      durationSec: 180,
      track,
    });
  }

  // CASE 2: SEARCH QUERY (Song name, artist, keywords)
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmedInput)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 },
    });

    if (searchRes.ok) {
      const html = await searchRes.text();
      // Extract unique video IDs from search result page
      const idMatches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
      const candidateIds = [...new Set(idMatches.map((m) => m[1]))].slice(0, 5);

      if (candidateIds.length > 0) {
        // Fetch metadata for candidates in parallel
        const resolvedList = await Promise.all(
          candidateIds.map(async (vId) => {
            const meta = await fetchOEmbedMetadata(vId);
            return {
              videoId: vId,
              title: meta?.title || `YouTube Track (${vId})`,
              author: meta?.author || 'YouTube',
              thumbnailUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              youtubeUrl: `https://www.youtube.com/watch?v=${vId}`,
            };
          })
        );

        const primary = resolvedList[0];
        const track: YouTubeTrackResult = {
          id: `yt-${primary.videoId}`,
          videoId: primary.videoId,
          title: primary.title,
          author: primary.author,
          thumbnailUrl: primary.thumbnailUrl,
          youtubeUrl: primary.youtubeUrl,
          durationSec: 180,
          source: 'youtube',
        };

        return NextResponse.json({
          success: true,
          videoId: primary.videoId,
          title: primary.title,
          author: primary.author,
          thumbnailUrl: primary.thumbnailUrl,
          durationSec: 180,
          track,
          suggestions: resolvedList,
        });
      }
    }
  } catch (error) {
    console.warn('[YouTube Search Warning]', error);
  }

  // CASE 3: FALLBACK IF SEARCH SCRAPING FAILED OR BLOCKED
  return NextResponse.json(
    {
      success: false,
      error: 'Could not resolve a YouTube video from this input. Please paste a direct YouTube video link (e.g. https://www.youtube.com/watch?v=...).',
    },
    { status: 404 }
  );
}
