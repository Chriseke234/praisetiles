/**
 * POST /api/tournaments/[id]/matches/[matchId]
 * Finalizes tournament match scores and idempotently advances winner to the next round slot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id, matchId } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const body = await req.json();
  const {
    winnerParticipantId,
    score1,
    score2,
    accuracy1,
    accuracy2,
    combo1,
    combo2,
  } = body;

  if (!winnerParticipantId) {
    return NextResponse.json({ error: 'Winner participant ID is required' }, { status: 400 });
  }

  // Update match scores
  await supabase
    .from('tournament_matches')
    .update({
      score1: score1 ?? 0,
      score2: score2 ?? 0,
      accuracy1: accuracy1 ?? 0,
      accuracy2: accuracy2 ?? 0,
      combo1: combo1 ?? 0,
      combo2: combo2 ?? 0,
    })
    .eq('id', matchId)
    .eq('tournament_id', id);

  // Advance winner in bracket
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('advance_tournament_match_winner', {
    p_match_id: matchId,
    p_winner_participant_id: winnerParticipantId,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  if (!rpcRes.success) {
    return NextResponse.json({ error: rpcRes.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, result: rpcRes });
}
