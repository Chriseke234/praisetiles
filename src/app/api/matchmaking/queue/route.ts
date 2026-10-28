/**
 * POST & DELETE /api/matchmaking/queue
 * Quick Play queue management and atomic matchmaking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// POST /api/matchmaking/queue — Enter queue or check status
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid authentication session' }, { status: 401 });
  }

  let body: { mode?: string; instrument?: string; action?: 'queue' | 'status' };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? 'queue';
  const mode = body.mode === 'ranked' ? 'ranked' : 'casual';
  const instrument = body.instrument === 'guitar' ? 'guitar' : 'piano';

  // 1. If checking status
  if (action === 'status') {
    const { data: qEntry } = await userClient
      .from('matchmaking_queue')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!qEntry) {
      return NextResponse.json({ status: 'not_queued' });
    }

    // Touch heartbeat
    await userClient
      .from('matchmaking_queue')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('user_id', user.id);

    return NextResponse.json({
      status: qEntry.status,
      matchedRoomId: qEntry.matched_room_id,
      matchedInviteCode: qEntry.matched_invite_code,
    });
  }

  // 2. Queue for matchmaking
  const { data, error } = await userClient.rpc('queue_for_matchmaking', {
    p_mode:       mode,
    p_instrument: instrument,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 3. Trigger atomic matchmaker using service role or user client
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE || SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await adminClient.rpc('atomic_matchmaker', {
      p_mode:       mode,
      p_instrument: instrument,
    });
  } catch {
    // Non-blocking matchmaker trigger
  }

  // Re-check if player was immediately matched
  const { data: finalEntry } = await userClient
    .from('matchmaking_queue')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    queueId:           data?.queue_id,
    status:            finalEntry?.status ?? 'queued',
    matchedInviteCode: finalEntry?.matched_invite_code ?? null,
  }, { status: 200 });
}

// ---------------------------------------------------------------------------
// DELETE /api/matchmaking/queue — Leave matchmaking queue
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
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

  const { error } = await supabase.rpc('cancel_matchmaking');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ cancelled: true }, { status: 200 });
}
