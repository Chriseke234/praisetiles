import { NextRequest, NextResponse } from 'next/server';

/**
 * Audio Stream Proxy for PraiseTiles
 * 
 * Proxies cross-origin audio streams (iTunes CDN, Deezer, etc.) through the Next.js server.
 * This completely resolves browser CORS restrictions ("TypeError: Failed to fetch")
 * when decoding audio via the Web Audio API (AudioContext.decodeAudioData).
 * 
 * GET /api/music/proxy?url={encodedAudioUrl}
 */

// Private / Local IP pattern to prevent SSRF
const PRIVATE_IP_PATTERN = /(?:^127\.)|(?:^10\.)|(?:^172\.(?:1[6-9]|2[0-9]|3[0-1])\.)|(?:^192\.168\.)|(?:^169\.254\.)|(?:^localhost$)|(?:^::1$)/i;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url')?.trim();

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing "url" query parameter' },
      { status: 400 }
    );
  }

  // Validate URL protocol
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Invalid URL protocol. Only HTTP and HTTPS are permitted.' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL parameter.' },
      { status: 400 }
    );
  }

  // SSRF guard: Reject localhost and private IP hosts
  const hostname = parsedUrl.hostname.toLowerCase();
  if (PRIVATE_IP_PATTERN.test(hostname)) {
    return NextResponse.json(
      { error: 'Restricted host. Access to internal networks is forbidden.' },
      { status: 403 }
    );
  }

  try {
    // Fetch remote audio stream server-side (bypasses browser CORS restrictions)
    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PraiseTiles/1.0 AudioProxy',
        'Accept': 'audio/*, application/octet-stream, */*',
      },
      next: { revalidate: 86400 }, // Cache audio bytes for 24 hours
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Upstream audio host returned status ${upstreamResponse.status}` },
        { status: upstreamResponse.status >= 400 && upstreamResponse.status < 500 ? 404 : 502 }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'audio/mp4';
    const contentLength = upstreamResponse.headers.get('content-length');

    // Build streaming response with permissive CORS and caching headers
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    // Stream the body directly to the client
    return new NextResponse(upstreamResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('[AudioProxy Error]', error);
    return NextResponse.json(
      { error: 'Failed to proxy audio stream. Please verify the URL or try again.' },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}
