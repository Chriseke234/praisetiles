import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Modern standard: disable legacy XSS filter to prevent false positives in Safari/WebKit
    key: 'X-XSS-Protection',
    value: '0',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://*.supabase.co https://i.ytimg.com https://img.youtube.com https://*.mzstatic.com https://*.deezer.com",
      "font-src 'self' data:",
      "media-src 'self' blob: https://*.supabase.co https://*.apple.com https://*.mzstatic.com https://*.deezer.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.unsplash.com https://itunes.apple.com https://api.deezer.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Apply security headers to page routes, avoiding static asset chunk delivery issues in Safari
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
