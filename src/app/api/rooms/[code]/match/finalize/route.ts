/**
 * POST /api/rooms/[code]/match/finalize
 * Each player calls this once their run ends (completion or elimination).
 * Idempotent — safe to retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FinalizeMatchRequest, FinalizeMatchResponse } from '@/types/room';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  // code param is available for logging/validation but not strictly needed
  // (match_id in body identifies the match)
  await context.params;

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

  let body: FinalizeMatchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.matchId) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 422 });
  }

  const { data, error } = await supabase.rpc('finalize_match', {
    p_match_id:       body.matchId,
    p_score:          body.score ?? 0,
    p_accuracy:       body.accuracy ?? 0,
    p_highest_combo:  body.highestCombo ?? 0,
    p_completed:      body.completed ?? false,
    p_failure_reason: body.failureReason ?? null,
    p_notes_hit:      body.notesHit ?? 0,
    p_total_notes:    body.totalNotes ?? 0,
    p_elapsed_time:   body.elapsedTime ?? 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as { placement: number; match_status: string };

  const response: FinalizeMatchResponse = {
    placement:   result.placement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchStatus: result.match_status as any,
  };

  return NextResponse.json(response, { status: 200 });
}
