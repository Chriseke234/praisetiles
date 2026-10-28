/**
 * GET & POST /api/rooms/public
 * Public room discovery and public room creation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PublicRoomSummary } from '@/types/social';
import { InstrumentType } from '@/types/game';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface RoomParticipantRow {
  is_active_player?: boolean;
}

interface PublicRoomDbRow {
  id: string;
  name?: string | null;
  invite_code: string;
  host_id: string;
  room_mode: 'casual' | 'ranked';
  instrument: InstrumentType;
  status: PublicRoomSummary['status'];
  max_participants: number;
  max_active_players?: number;
  song_title?: string | null;
  created_at: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string | null;
    player_progress?: { gem_rank: string }[];
  } | null;
  room_participants?: RoomParticipantRow[];
}

// ---------------------------------------------------------------------------
// GET /api/rooms/public — Filterable public room discovery
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const mode        = searchParams.get('mode') ?? 'all';
  const instrument  = searchParams.get('instrument') ?? 'all';
  const waitingOnly = searchParams.get('waitingOnly') === 'true';
  const query       = searchParams.get('query')?.trim() ?? '';
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize    = Math.min(20, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)));
  const offset      = (page - 1) * pageSize;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let dbQuery = supabase
    .from('rooms')
    .select(`
      id, name, invite_code, host_id, instrument, room_mode, status,
      max_participants, max_active_players, song_title, created_at,
      profiles:host_id (display_name, avatar_url, player_progress(gem_rank)),
      room_participants (user_id, is_active_player)
    `, { count: 'exact' })
    .eq('is_public', true)
    .neq('status', 'closed')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (mode !== 'all') {
    dbQuery = dbQuery.eq('room_mode', mode);
  }
  if (instrument !== 'all') {
    dbQuery = dbQuery.eq('instrument', instrument);
  }
  if (waitingOnly) {
    dbQuery = dbQuery.eq('status', 'waiting');
  }
  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`);
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format summaries
  const summaries: PublicRoomSummary[] = ((data as unknown as PublicRoomDbRow[]) ?? []).map((r) => {
    const participants = r.room_participants ?? [];
    const activeCount = participants.filter((p) => p.is_active_player).length;
    const totalCount = participants.length;
    const canJoin = totalCount < r.max_participants && r.status !== 'playing' && r.status !== 'countdown';

    return {
      id:                r.id,
      name:              r.name ?? 'Gospel Praise Arena',
      inviteCode:        r.invite_code,
      hostId:            r.host_id,
      hostDisplayName:   r.profiles?.display_name ?? 'Host',
      hostAvatarUrl:     r.profiles?.avatar_url ?? null,
      hostGemRank:       r.profiles?.player_progress?.[0]?.gem_rank ?? 'Quartz',
      roomMode:          r.room_mode,
      instrument:        r.instrument as InstrumentType,
      status:            r.status,
      participantCount:  totalCount,
      maxParticipants:   r.max_participants,
      activePlayerCount: activeCount,
      maxActivePlayers:  r.max_active_players ?? 4,
      canJoin,
      songTitle:         r.song_title ?? null,
      createdAt:         r.created_at,
    };
  });

  return NextResponse.json({
    rooms: summaries,
    total: count ?? summaries.length,
    page,
    pageSize,
  });
}

// ---------------------------------------------------------------------------
// POST /api/rooms/public — Create public room
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: {
    name?: string;
    instrument?: string;
    roomMode?: string;
    maxParticipants?: number;
  };

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data, error } = await supabase.rpc('create_public_room', {
    p_name:             body.name ?? 'Gospel Praise Arena',
    p_instrument:       body.instrument === 'guitar' ? 'guitar' : 'piano',
    p_room_mode:        body.roomMode === 'ranked' ? 'ranked' : 'casual',
    p_max_participants: body.maxParticipants ?? 8,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as { room_id: string; invite_code: string; name: string };

  return NextResponse.json({
    roomId:     result.room_id,
    inviteCode: result.invite_code,
    name:       result.name,
  }, { status: 201 });
}
