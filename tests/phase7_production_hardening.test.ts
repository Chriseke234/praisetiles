/**
 * Phase 7: Production Hardening, Security, Performance & Observability Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  resetRateLimiter,
  RATE_LIMIT_PRESETS,
} from '@/lib/security/rateLimiter';
import { validateEnvironment } from '@/lib/security/envValidator';
import { sanitizeData } from '@/lib/observability/logger';

describe('Phase 7: Security Hardening & Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within the defined threshold', () => {
    const key = 'test-ip-1';
    const limit = 3;
    const windowMs = 5000;

    const res1 = checkRateLimit(key, { limit, windowMs });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit(key, { limit, windowMs });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit(key, { limit, windowMs });
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks requests once the threshold is exceeded', () => {
    const key = 'test-ip-blocked';
    const limit = 2;
    const windowMs = 10000;

    checkRateLimit(key, { limit, windowMs });
    checkRateLimit(key, { limit, windowMs });

    const blocked = checkRateLimit(key, { limit, windowMs });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('generates an HTTP 429 response with RFC standard rate limit headers', async () => {
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      resetMs: 45000,
    };

    const response = createRateLimitResponse(result);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();

    const data = await response.json();
    expect(data.error).toContain('Too many requests');
    expect(data.retryAfter).toBe(45);
  });

  it('extracts client IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    });
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  it('falls back to 127.0.0.1 when no proxy headers exist', () => {
    const req = new Request('http://localhost:3000/api/test');
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('has valid presets for room creation, audio upload, matchmaking, and reporting', () => {
    expect(RATE_LIMIT_PRESETS.ROOM_CREATE.limit).toBe(10);
    expect(RATE_LIMIT_PRESETS.AUDIO_UPLOAD.limit).toBe(5);
    expect(RATE_LIMIT_PRESETS.MATCHMAKING.limit).toBe(20);
    expect(RATE_LIMIT_PRESETS.REPORT.limit).toBe(5);
  });
});

describe('Phase 7: Environment Configuration Validator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('flags missing NEXT_PUBLIC_SUPABASE_URL and ANON key', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res = validateEnvironment();
    expect(res.isValid).toBe(false);
    expect(res.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(res.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('passes validation when required public keys are present and correctly formatted', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-format-key-mock';

    const res = validateEnvironment();
    expect(res.isValid).toBe(true);
    expect(res.missing).toHaveLength(0);
  });
});

describe('Phase 7: Structured Logging & Redaction', () => {
  it('deep-redacts sensitive keys such as passwords, tokens, and secrets', () => {
    const sensitivePayload = {
      userId: 'usr-1234',
      token: 'jwt.secret.bearer.value',
      authorization: 'Bearer secret-token-xyz',
      nested: {
        password: 'SuperSecretPassword!',
        apiKey: 'sk_live_123456789',
        cleanData: 'praise-tiles-room',
      },
      tags: ['game', 'ranked'],
    };

    const sanitized = sanitizeData(sensitivePayload) as Record<string, unknown>;

    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.userId).toBe('usr-1234');

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.password).toBe('[REDACTED]');
    expect(nested.apiKey).toBe('[REDACTED]');
    expect(nested.cleanData).toBe('praise-tiles-room');
  });

  it('redacts standalone Bearer strings in non-standard keys', () => {
    const payload = {
      customAuth: 'Bearer eyJhbGciOiJIUzI1NiJ9',
      regularText: 'Hallelujah Anthem',
    };

    const sanitized = sanitizeData(payload) as Record<string, unknown>;
    expect(sanitized.customAuth).toBe('Bearer [REDACTED]');
    expect(sanitized.regularText).toBe('Hallelujah Anthem');
  });
});
