/**
 * GET & POST /api/tournaments/[id]/bracket
 * - GET: Fetch tournament bracket rounds, matches and champion
 * - POST: Trigger server-side bracket generation for 4, 8, or 16 players
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TournamentBracket, TournamentMatch, TournamentParticipant } from '@/types/tournament';
import { TournamentCapacity } from '@/config/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface MatchDbRow {
  id: string;
  tournament_id: string;
  round_index: number;
  match_index_in_round: number;
  round_name: string;
  participant1_id?: string | null;
  participant2_id?: string | null;
  winner_participant_id?: string | null;
  next_match_id?: string | null;
  room_id?: string | null;
  room_invite_code?: string | null;
  status: TournamentMatch['status'];
  score1?: number | null;
  score2?: number | null;
  accuracy1?: number | null;
  accuracy2?: number | null;
  combo1?: number | null;
  combo2?: number | null;
  scheduled_start_at?: string | null;
  completed_at?: string | null;
  p1?: {
    id: string;
    user_id: string;
    seed?: number | null;
    status: string;
    profiles?: {
      username?: string;
      display_name?: string;
      avatar_url?: string | null;
      player_progress?: { gem_rank: string }[];
    } | null;
  } | null;
  p2?: {
    id: string;
    user_id: string;
    seed?: number | null;
    status: string;
    profiles?: {
      username?: string;
      display_name?: string;
      avatar_url?: string | null;
      player_progress?: { gem_rank: string }[];
    } | null;
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
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tourney, error: tErr } = await supabase
    .from('tournaments')
    .select('id, capacity, status')
    .eq('id', id)
    .single();

  if (tErr || !tourney) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const { data: matchesData, error: mErr } = await supabase
    .from('tournament_matches')
    .select(`
      id, tournament_id, round_index, match_index_in_round, round_name,
      participant1_id, participant2_id, winner_participant_id, next_match_id,
      room_id, room_invite_code, status, score1, score2, accuracy1, accuracy2,
      combo1, combo2, scheduled_start_at, completed_at,
      p1:participant1_id (
        id, user_id, seed, status,
        profiles:user_id (username, display_name, avatar_url, player_progress(gem_rank))
      ),
      p2:participant2_id (
        id, user_id, seed, status,
        profiles:user_id (username, display_name, avatar_url, player_progress(gem_rank))
      )
    `)
    .eq('tournament_id', id)
    .order('round_index', { ascending: true })
    .order('match_index_in_round', { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const matches: TournamentMatch[] = ((matchesData as unknown as MatchDbRow[]) ?? []).map((m) => {
    const mapPart = (partRow: MatchDbRow['p1']): TournamentParticipant | null => {
      if (!partRow) return null;
      return {
        id:           partRow.id,
        tournamentId: id,
        userId:       partRow.user_id,
        username:     partRow.profiles?.username ?? 'player',
        displayName:  partRow.profiles?.display_name ?? 'Player',
        avatarUrl:    partRow.profiles?.avatar_url ?? null,
        gemRank:      partRow.profiles?.player_progress?.[0]?.gem_rank ?? 'Quartz',
        status:       partRow.status as TournamentParticipant['status'],
        seed:         partRow.seed ?? null,
        registeredAt: '',
      };
    };

    return {
      id:                  m.id,
      tournamentId:        m.tournament_id,
      roundIndex:          m.round_index,
      matchIndexInRound:   m.match_index_in_round,
      roundName:           m.round_name,
      participant1:        mapPart(m.p1),
      participant2:        mapPart(m.p2),
      winnerParticipantId: m.winner_participant_id ?? null,
      nextMatchId:         m.next_match_id ?? null,
      roomId:              m.room_id ?? null,
      roomInviteCode:      m.room_invite_code ?? null,
      status:              m.status,
      score1:              m.score1 ?? null,
      score2:              m.score2 ?? null,
      accuracy1:           m.accuracy1 ? Number(m.accuracy1) : null,
      accuracy2:           m.accuracy2 ? Number(m.accuracy2) : null,
      combo1:              m.combo1 ?? null,
      combo2:              m.combo2 ?? null,
      scheduledStartAt:    m.scheduled_start_at ?? null,
      completedAt:         m.completed_at ?? null,
    };
  });

  // Group by round
  const roundMap = new Map<number, { roundIndex: number; roundName: string; matches: TournamentMatch[] }>();
  for (const m of matches) {
    if (!roundMap.has(m.roundIndex)) {
      roundMap.set(m.roundIndex, {
        roundIndex: m.roundIndex,
        roundName: m.roundName,
        matches: [],
      });
    }
    roundMap.get(m.roundIndex)!.matches.push(m);
  }

  const rounds = Array.from(roundMap.values()).sort((a, b) => a.roundIndex - b.roundIndex);

  // Find champion if final match completed
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  let champion: TournamentParticipant | null = null;
  if (finalMatch && finalMatch.winnerParticipantId) {
    champion = finalMatch.winnerParticipantId === finalMatch.participant1?.id
      ? finalMatch.participant1
      : finalMatch.participant2 ?? null;
  }

  const bracket: TournamentBracket = {
    tournamentId: id,
    capacity: tourney.capacity as TournamentCapacity,
    rounds,
    champion,
  };

  return NextResponse.json({ bracket });
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

  // Trigger RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('generate_single_elimination_bracket', {
    p_tournament_id: id,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  if (!rpcRes.success) {
    return NextResponse.json({ error: rpcRes.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, bracket: rpcRes });
}
