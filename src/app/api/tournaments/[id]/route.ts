/**
 * GET & PATCH /api/tournaments/[id]
 * - GET: Fetch tournament details, rules, participants and current user registration
 * - PATCH: Organizer controls (pause, cancel with reason, update status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Tournament, TournamentParticipant } from '@/types/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface ParticipantDbRow {
  id: string;
  user_id: string;
  status: TournamentParticipant['status'];
  seed?: number | null;
  placement?: number | null;
  registered_at: string;
  checked_in_at?: string | null;
  profiles?: {
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
    player_progress?: { gem_rank: string }[];
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let tourneyQuery = supabase
    .from('tournaments')
    .select(`
      *,
      profiles:organizer_id (display_name)
    `);

  if (isUuid) {
    tourneyQuery = tourneyQuery.eq('id', id);
  } else {
    tourneyQuery = tourneyQuery.eq('slug', id);
  }

  const { data: tourney, error: tErr } = await tourneyQuery.single();

  if (tErr || !tourney) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Fetch participants
  const { data: partData } = await supabase
    .from('tournament_participants')
    .select(`
      id, user_id, status, seed, placement, registered_at, checked_in_at,
      profiles:user_id (username, display_name, avatar_url, player_progress(gem_rank))
    `)
    .eq('tournament_id', tourney.id)
    .neq('status', 'withdrawn')
    .order('registered_at', { ascending: true });

  const participants: TournamentParticipant[] = ((partData as unknown as ParticipantDbRow[]) ?? []).map((p) => ({
    id:           p.id,
    tournamentId: tourney.id,
    userId:       p.user_id,
    username:     p.profiles?.username ?? 'player',
    displayName:  p.profiles?.display_name ?? 'Player',
    avatarUrl:    p.profiles?.avatar_url ?? null,
    gemRank:      p.profiles?.player_progress?.[0]?.gem_rank ?? 'Quartz',
    status:       p.status,
    seed:         p.seed ?? null,
    placement:    p.placement ?? null,
    registeredAt: p.registered_at,
    checkedInAt:  p.checked_in_at ?? null,
  }));

  // Check if current user is registered
  let myParticipant: TournamentParticipant | null = null;
  if (jwt) {
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (user) {
      myParticipant = participants.find((p) => p.userId === user.id) ?? null;
    }
  }

  const tournament: Tournament = {
    id:                   tourney.id,
    title:                tourney.title,
    slug:                 tourney.slug,
    description:          tourney.description,
    coverImageUrl:        tourney.cover_image_url,
    organizerId:          tourney.organizer_id,
    organizerDisplayName: tourney.profiles?.display_name ?? 'Tournament Organizer',
    organizerRole:        'approved_organizer',
    eventType:            tourney.event_type,
    instrument:           tourney.instrument,
    capacity:             tourney.capacity,
    minParticipants:      tourney.min_participants,
    roomMode:             tourney.room_mode,
    songSelectionPolicy:  tourney.song_selection_policy,
    status:               tourney.status,
    registrationStartAt:  tourney.registration_start_at,
    registrationEndAt:    tourney.registration_end_at,
    checkInStartAt:       tourney.check_in_start_at,
    checkInEndAt:         tourney.check_in_end_at,
    startAt:              tourney.start_at,
    cancellationReason:   tourney.cancellation_reason ?? null,
    seasonId:             tourney.season_id ?? null,
    rulesText:            tourney.rules_text,
    registeredCount:      participants.length,
    checkedInCount:       participants.filter((p) => p.status === 'checked_in').length,
    createdAt:            tourney.created_at,
    updatedAt:            tourney.updated_at,
  };

  return NextResponse.json({
    tournament,
    participants,
    myParticipant,
  });
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
  const { action, cancellationReason } = body;

  const { data: tourney, error: tErr } = await supabase
    .from('tournaments')
    .select('id, organizer_id, status')
    .eq('id', id)
    .single();

  if (tErr || !tourney) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tourney.organizer_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized: only organizer can update tournament' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'cancel') {
    updates.status = 'cancelled';
    updates.cancellation_reason = cancellationReason ?? 'Cancelled by organizer';
  } else if (action === 'pause') {
    updates.status = 'paused';
  } else if (action === 'resume') {
    updates.status = 'in_progress';
  } else if (action === 'open_registration') {
    updates.status = 'registration_open';
  } else if (action === 'close_registration') {
    updates.status = 'registration_closed';
  } else if (action === 'start_check_in') {
    updates.status = 'check_in';
  }

  const { data: updated, error: uErr } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tournament: updated });
}
