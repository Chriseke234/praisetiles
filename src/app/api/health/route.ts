/**
 * GET /api/health
 * Production health monitoring endpoint for container health probes and uptime checks.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'unreachable' | 'not_configured' = 'not_configured';

  if (SUPABASE_URL && SUPABASE_ANON) {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false },
      });
      // Lightweight query: read active season count or profiles limit 1
      const { error } = await client.from('seasons').select('id').limit(1);
      if (error) {
        dbStatus = 'unreachable';
      } else {
        dbStatus = 'connected';
      }
    } catch {
      dbStatus = 'unreachable';
    }
  }

  const mem = process.memoryUsage ? process.memoryUsage() : null;
  const memoryMb = mem
    ? {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      }
    : null;

  const isHealthy = dbStatus === 'connected';
  const isDegraded = dbStatus === 'not_configured';
  const overallStatus = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy';

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      version: '7.0.0',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      uptimeSec: Math.floor(process.uptime ? process.uptime() : 0),
      services: {
        database: dbStatus,
      },
      memory: memoryMb,
    },
    { status: statusCode }
  );
}
