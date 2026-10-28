/**
 * GET & POST /api/tournaments
 * - GET: List public / published tournaments with filtering & pagination
 * - POST: Create new tournament (requires authorized organizer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Tournament } from '@/types/tournament';
import { InstrumentType } from '@/types/game';
import { RoomMode } from '@/types/social';
import { TournamentCapacity, TournamentRole } from '@/config/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface TournamentDbRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  organizer_id: string;
  event_type: 'official' | 'community';
  instrument: InstrumentType;
  capacity: TournamentCapacity;
  min_participants: number;
  room_mode: RoomMode;
  song_selection_policy: 'approved_pool' | 'organizer_selected' | 'voting';
  status: Tournament['status'];
  registration_start_at: string;
  registration_end_at: string;
  check_in_start_at: string;
  check_in_end_at: string;
  start_at: string;
  cancellation_reason?: string | null;
  season_id?: string | null;
  rules_text: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    display_name?: string;
  } | null;
  tournament_participants?: { id: string; status: string }[];
}

// -----------------------------------------------------------------------------
// GET: Discover tournaments
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter      = searchParams.get('status') ?? 'all';
  const instrumentFilter  = searchParams.get('instrument') ?? 'all';
  const eventTypeFilter   = searchParams.get('type') ?? 'all';
  const query             = searchParams.get('query')?.trim() ?? '';
  const page              = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize          = Math.min(20, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)));
  const offset            = (page - 1) * pageSize;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let dbQuery = supabase
    .from('tournaments')
    .select(`
      id, title, slug, description, cover_image_url, organizer_id,
      event_type, instrument, capacity, min_participants, room_mode,
      song_selection_policy, status, registration_start_at, registration_end_at,
      check_in_start_at, check_in_end_at, start_at, cancellation_reason,
      season_id, rules_text, created_at, updated_at,
      profiles:organizer_id (display_name),
      tournament_participants (id, status)
    `, { count: 'exact' })
    .order('start_at', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (statusFilter !== 'all') {
    dbQuery = dbQuery.eq('status', statusFilter);
  } else {
    dbQuery = dbQuery.neq('status', 'draft');
  }

  if (instrumentFilter !== 'all') {
    dbQuery = dbQuery.eq('instrument', instrumentFilter);
  }

  if (eventTypeFilter !== 'all') {
    dbQuery = dbQuery.eq('event_type', eventTypeFilter);
  }

  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`);
  }

  const { data, count, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tournaments: Tournament[] = ((data as unknown as TournamentDbRow[]) ?? []).map((t) => {
    const participants = t.tournament_participants ?? [];
    const registeredCount = participants.filter((p) => p.status !== 'withdrawn').length;
    const checkedInCount = participants.filter((p) => p.status === 'checked_in').length;

    return {
      id:                   t.id,
      title:                t.title,
      slug:                 t.slug,
      description:          t.description,
      coverImageUrl:        t.cover_image_url,
      organizerId:          t.organizer_id,
      organizerDisplayName: t.profiles?.display_name ?? 'Tournament Organizer',
      organizerRole:        'approved_organizer' as TournamentRole,
      eventType:            t.event_type,
      instrument:           t.instrument,
      capacity:             t.capacity,
      minParticipants:      t.min_participants,
      roomMode:             t.room_mode,
      songSelectionPolicy:  t.song_selection_policy,
      status:               t.status,
      registrationStartAt:  t.registration_start_at,
      registrationEndAt:    t.registration_end_at,
      checkInStartAt:       t.check_in_start_at,
      checkInEndAt:         t.check_in_end_at,
      startAt:              t.start_at,
      cancellationReason:   t.cancellation_reason ?? null,
      seasonId:             t.season_id ?? null,
      rulesText:            t.rules_text,
      registeredCount,
      checkedInCount,
      createdAt:            t.created_at,
      updatedAt:            t.updated_at,
    };
  });

  return NextResponse.json({ tournaments, total: count ?? tournaments.length, page, pageSize });
}

// -----------------------------------------------------------------------------
// POST: Create tournament (Organizer only)
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
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

  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const body = await req.json();
  const {
    title,
    description = '',
    coverImageUrl,
    eventType = 'official',
    instrument = 'piano',
    capacity = 8,
    minParticipants = 4,
    roomMode = 'ranked',
    songSelectionPolicy = 'approved_pool',
    registrationStartAt,
    registrationEndAt,
    checkInStartAt,
    checkInEndAt,
    startAt,
    rulesText = '',
    publishNow = true,
  } = body;

  if (!title || !coverImageUrl || !registrationStartAt || !registrationEndAt || !checkInStartAt || !checkInEndAt || !startAt) {
    return NextResponse.json({ error: 'Missing required tournament fields' }, { status: 400 });
  }

  // Chronological verification
  const regStart  = new Date(registrationStartAt).getTime();
  const regEnd    = new Date(registrationEndAt).getTime();
  const checkinStart = new Date(checkInStartAt).getTime();
  const checkinEnd   = new Date(checkInEndAt).getTime();
  const tourneyStart = new Date(startAt).getTime();

  if (regStart >= regEnd) {
    return NextResponse.json({ error: 'Registration start must precede registration end' }, { status: 400 });
  }
  if (regEnd > checkinStart) {
    return NextResponse.json({ error: 'Registration must close on or before check-in opens' }, { status: 400 });
  }
  if (checkinStart >= checkinEnd) {
    return NextResponse.json({ error: 'Check-in start must precede check-in end' }, { status: 400 });
  }
  if (checkinEnd > tourneyStart) {
    return NextResponse.json({ error: 'Check-in must close before tournament starts' }, { status: 400 });
  }

  // Generate unique slug
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

  const status = publishNow ? 'published' : 'draft';

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      title,
      slug,
      description,
      cover_image_url: coverImageUrl,
      organizer_id: user.id,
      event_type: eventType,
      instrument,
      capacity: Number(capacity),
      min_participants: Number(minParticipants),
      room_mode: roomMode,
      song_selection_policy: songSelectionPolicy,
      status,
      registration_start_at: registrationStartAt,
      registration_end_at: registrationEndAt,
      check_in_start_at: checkInStartAt,
      check_in_end_at: checkInEndAt,
      start_at: startAt,
      rules_text: rulesText,
    })
    .select('id, slug, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tournament: data });
}
