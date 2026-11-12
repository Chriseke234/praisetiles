import { NextRequest, NextResponse } from 'next/server';

export interface SearchTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string;
  durationSec: number;
  source: 'streaming_preview';
}

/**
 * Searches music streaming catalogues for direct unencrypted raw audio previews.
 * GET /api/music/search?q={query}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    // 1. Primary: iTunes Search API (Fast, no key required, provides direct CORS-accessible MP3 previews)
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`;
    const itunesRes = await fetch(itunesUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PraiseTiles/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (Array.isArray(itunesData.results) && itunesData.results.length > 0) {
        const tracks: SearchTrackResult[] = itunesData.results
          .filter((item: any) => item.previewUrl && item.trackName)
          .map((item: any) => ({
            id: `itunes-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || 'Single',
            artworkUrl: item.artworkUrl100
              ? item.artworkUrl100.replace('100x100bb', '300x300bb')
              : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop',
            previewUrl: item.previewUrl,
            durationSec: Math.round((item.trackTimeMillis || 30000) / 1000),
            source: 'streaming_preview' as const,
          }));

        if (tracks.length > 0) {
          return NextResponse.json({ tracks }, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          });
        }
      }
    }

    // 2. Fallback: Deezer Public Search API
    try {
      const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`;
      const deezerRes = await fetch(deezerUrl, { next: { revalidate: 3600 } });
      if (deezerRes.ok) {
        const deezerData = await deezerRes.json();
        if (Array.isArray(deezerData.data)) {
          const tracks: SearchTrackResult[] = deezerData.data
            .filter((item: any) => item.preview && item.title)
            .map((item: any) => ({
              id: `deezer-${item.id}`,
              title: item.title,
              artist: item.artist?.name || 'Unknown Artist',
              album: item.album?.title || 'Single',
              artworkUrl: item.album?.cover_medium || item.album?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop',
              previewUrl: item.preview,
              durationSec: item.duration || 30,
              source: 'streaming_preview' as const,
            }));

          return NextResponse.json({ tracks }, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          });
        }
      }
    } catch {
      // Deezer fallback failed, continue to empty
    }

    return NextResponse.json({ tracks: [] });
  } catch (error) {
    console.error('[MusicSearch API Error]', error);
    return NextResponse.json(
      { error: 'Failed to search music catalog' },
      { status: 500 }
    );
  }
}
