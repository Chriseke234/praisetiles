/**
 * POST /api/rooms/create
 * Creates a private room and returns room_id + invite_code.
 * Requires an authenticated Supabase session (JWT in Authorization header).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreateRoomResponse } from '@/types/room';
import { InstrumentType } from '@/types/game';
import { checkRateLimit, createRateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimiter';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`room_create:${clientIp}`, RATE_LIMIT_PRESETS.ROOM_CREATE);
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  // Forward the caller's JWT so the SECURITY DEFINER function runs as that user
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let instrument: InstrumentType = 'piano';
  try {
    const body = await req.json();
    if (body.instrument === 'guitar') instrument = 'guitar';
  } catch {
    // Default to piano if body is missing/malformed
  }

  const { data, error } = await supabase.rpc('create_room', {
    p_instrument: instrument,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as { room_id: string; invite_code: string };

  const response: CreateRoomResponse = {
    roomId:     result.room_id,
    inviteCode: result.invite_code,
  };

  return NextResponse.json(response, { status: 201 });
}
