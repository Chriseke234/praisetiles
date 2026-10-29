/**
 * Sliding Window In-Memory Rate Limiter
 *
 * Protects public and authenticated API routes against brute force, denial of service,
 * and high-frequency resource exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitOptions {
  limit?: number;     // Maximum allowed requests within the window (default: 60)
  windowMs?: number;  // Window duration in milliseconds (default: 60,000 = 1 minute)
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// In-memory sliding window store: key -> array of request timestamps in ms
const hitsStore = new Map<string, number[]>();

// Preset rate limit configurations
export const RATE_LIMIT_PRESETS = {
  ROOM_CREATE: { limit: 10, windowMs: 60_000 },       // 10 rooms/min
  AUDIO_UPLOAD: { limit: 5, windowMs: 60_000 },       // 5 uploads/min
  MATCHMAKING: { limit: 20, windowMs: 60_000 },       // 20 queue ops/min
  REPORT: { limit: 5, windowMs: 300_000 },            // 5 reports/5min
  SOCIAL: { limit: 30, windowMs: 60_000 },            // 30 friend/follow requests/min
  GENERAL: { limit: 60, windowMs: 60_000 },           // 60 requests/min
} as const;

/**
 * Extracts the best client IP or identifier from request headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  return '127.0.0.1';
}

/**
 * Checks and records a hit against the sliding window rate limit for a key.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? RATE_LIMIT_PRESETS.GENERAL.limit;
  const windowMs = options.windowMs ?? RATE_LIMIT_PRESETS.GENERAL.windowMs;
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = hitsStore.get(key) ?? [];
  // Prune hits older than windowStart
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    hitsStore.set(key, validTimestamps);

    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  validTimestamps.push(now);
  hitsStore.set(key, validTimestamps);

  const resetMs = validTimestamps.length > 0
    ? Math.max(0, validTimestamps[0] + windowMs - now)
    : windowMs;

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - validTimestamps.length),
    resetMs,
  };
}

/**
 * Generates an HTTP 429 Too Many Requests response with standard rate limit headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil(result.resetMs / 1000);
  const resetEpochSec = Math.ceil((Date.now() + result.resetMs) / 1000);

  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down.',
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(resetEpochSec),
      },
    }
  );
}

/**
 * Resets the in-memory rate limiter store (used in test suites).
 */
export function resetRateLimiter(): void {
  hitsStore.clear();
}
