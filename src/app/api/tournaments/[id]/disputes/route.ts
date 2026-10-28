/**
 * GET, POST & PATCH /api/tournaments/[id]/disputes
 * - GET: Fetch tournament disputes
 * - POST: Participant files dispute on a match
 * - PATCH: Organizer resolves dispute (upheld / rejected)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TournamentDispute } from '@/types/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface DisputeDbRow {
  id: string;
  tournament_id: string;
  match_id: string;
  filed_by_user_id: string;
  reason: TournamentDispute['reason'];
  description: string;
  status: TournamentDispute['status'];
  resolution_notes?: string | null;
  resolved_by_user_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
  profiles?: {
    display_name?: string;
  } | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('tournament_disputes')
    .select(`
      id, tournament_id, match_id, filed_by_user_id, reason, description,
      status, resolution_notes, resolved_by_user_id, created_at, resolved_at,
      profiles:filed_by_user_id (display_name)
    `)
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const disputes: TournamentDispute[] = ((data as unknown as DisputeDbRow[]) ?? []).map((d) => ({
    id:                 d.id,
    tournamentId:       d.tournament_id,
    matchId:            d.match_id,
    filedByUserId:      d.filed_by_user_id,
    filedByDisplayName: d.profiles?.display_name ?? 'Player',
    reason:             d.reason,
    description:        d.description,
    status:             d.status,
    resolutionNotes:    d.resolution_notes ?? null,
    resolvedByUserId:   d.resolved_by_user_id ?? null,
    createdAt:          d.created_at,
    resolvedAt:         d.resolved_at ?? null,
  }));

  return NextResponse.json({ disputes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id } = await params;
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
  const { matchId, reason, description } = body;

  if (!matchId || !reason || !description) {
    return NextResponse.json({ error: 'Missing required dispute fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tournament_disputes')
    .insert({
      tournament_id: id,
      match_id: matchId,
      filed_by_user_id: user.id,
      reason,
      description,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark match as disputed
  await supabase
    .from('tournament_matches')
    .update({ status: 'disputed' })
    .eq('id', matchId);

  return NextResponse.json({ success: true, dispute: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { id } = await params;
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
  const { disputeId, status, resolutionNotes } = body;

  if (!disputeId || !status || (status !== 'upheld' && status !== 'rejected')) {
    return NextResponse.json({ error: 'Invalid resolution status' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tournament_disputes')
    .update({
      status,
      resolution_notes: resolutionNotes ?? '',
      resolved_by_user_id: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)
    .eq('tournament_id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, dispute: data });
}
