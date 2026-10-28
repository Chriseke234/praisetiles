/**
 * POST /api/rooms/[code]/join
 * Joins an existing room using an invite code.
 * Requires an authenticated Supabase session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { JoinRoomResponse } from '@/types/room';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('join_room', {
    p_invite_code: code.toUpperCase(),
  });

  if (error) {
    const status = error.message.includes('not found') ? 404
      : error.message.includes('full') ? 409
      : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const result = data as { room_id: string; invite_code: string; status: string };

  const response: JoinRoomResponse = {
    roomId:     result.room_id,
    inviteCode: result.invite_code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status:     result.status as any,
  };

  return NextResponse.json(response, { status: 200 });
}
