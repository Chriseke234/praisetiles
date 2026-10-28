/**
 * GET /api/seasons
 * Retrieves current active competitive season details and seasonal tournament standings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Season, SeasonStanding } from '@/types/tournament';
import { TOURNAMENT_CONFIG } from '@/config/tournament';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface StandingDbRow {
  season_id: string;
  user_id: string;
  tournament_points: number;
  tournaments_won: number;
  tournaments_played: number;
  final_rank?: number | null;
  profiles?: {
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
    player_progress?: { gem_rank: string }[];
  } | null;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get('seasonId') ?? TOURNAMENT_CONFIG.SEASON.CURRENT_SEASON_ID;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sData } = await supabase
    .from('seasons')
    .select('id, name, season_number, start_at, end_at, status')
    .eq('id', seasonId)
    .single();

  const season: Season = sData ? {
    id:               sData.id,
    name:             sData.name,
    seasonNumber:     sData.season_number,
    startAt:          sData.start_at,
    endAt:            sData.end_at,
    status:           sData.status,
    totalTournaments: 0,
  } : {
    id:               TOURNAMENT_CONFIG.SEASON.CURRENT_SEASON_ID,
    name:             TOURNAMENT_CONFIG.SEASON.DEFAULT_SEASON_NAME,
    seasonNumber:     1,
    startAt:          '2026-01-01T00:00:00Z',
    endAt:            '2026-12-31T23:59:59Z',
    status:           'active',
    totalTournaments: 0,
  };

  const { data: standingsData, error: sErr } = await supabase
    .from('season_standings')
    .select(`
      season_id, user_id, tournament_points, tournaments_won, tournaments_played, final_rank,
      profiles:user_id (username, display_name, avatar_url, player_progress(gem_rank))
    `)
    .eq('season_id', season.id)
    .order('tournament_points', { ascending: false })
    .limit(50);

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const standings: SeasonStanding[] = ((standingsData as unknown as StandingDbRow[]) ?? []).map((row, i) => ({
    seasonId:          row.season_id,
    userId:            row.user_id,
    username:          row.profiles?.username ?? 'player',
    displayName:       row.profiles?.display_name ?? 'Player',
    avatarUrl:         row.profiles?.avatar_url ?? null,
    gemRank:           row.profiles?.player_progress?.[0]?.gem_rank ?? 'Quartz',
    tournamentPoints:  row.tournament_points,
    tournamentsWon:    row.tournaments_won,
    tournamentsPlayed: row.tournaments_played,
    finalRank:         row.final_rank ?? (i + 1),
  }));

  return NextResponse.json({ season, standings });
}
