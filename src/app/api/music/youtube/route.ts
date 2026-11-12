import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeTrackResult {
  id: string;
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  source: 'youtube';
}

/**
 * Extracts a standard 11-character YouTube video ID from various URL formats or raw ID.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // youtube.com/watch?v=ID or music.youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return watchMatch[1];
  }

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return shortMatch[1];
  }

  // youtube.com/embed/ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) {
    return embedMatch[1];
  }

  return null;
}

/**
 * Resolves YouTube video metadata and searches tracks.
 * GET /api/music/youtube?url={url}&q={query}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = searchParams.get('url') || searchParams.get('q');

  if (!rawInput || rawInput.trim().length === 0) {
    return NextResponse.json({ error: 'Missing url or q parameter' }, { status: 400 });
  }

  const videoId = extractYouTubeVideoId(rawInput);

  if (videoId) {
    // Resolve single video metadata via official oEmbed (CORS safe, no API key needed)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl, { next: { revalidate: 86400 } });

      if (res.ok) {
        const data = await res.json();
        const track: YouTubeTrackResult = {
          id: `yt-${videoId}`,
          videoId,
          title: data.title || 'YouTube Gospel Track',
          author: data.author_name || 'YouTube Creator',
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          source: 'youtube',
        };

        return NextResponse.json({ track });
      }
    } catch {
      // Fallback below
    }

    // Direct fallback if oEmbed fails
    return NextResponse.json({
      track: {
        id: `yt-${videoId}`,
        videoId,
        title: `YouTube Audio (${videoId})`,
        author: 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        source: 'youtube',
      },
    });
  }

  // Query search via iTunes / YouTube search proxy
  // Returns suggested search results that user can open on YouTube
  try {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(rawInput)}&media=music&entity=song&limit=10`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      const results = (data.results || []).map((item: any) => ({
        title: item.trackName,
        author: item.artistName,
        searchQuery: `${item.artistName} ${item.trackName}`,
      }));
      return NextResponse.json({ suggestions: results });
    }
  } catch {}

  return NextResponse.json({ suggestions: [] });
}
