/**
 * GET /api/leaderboards
 * Retrieves competitive leaderboards across:
 * - global: overall ranked ratings
 * - weekly: weekly ranked points / wins
 * - piano: piano-specific ranked ratings
 * - guitar: guitar-specific ranked ratings
 * - friends: ranked ratings among accepted mutual friends
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LeaderboardEntry } from '@/types/social';
import { SOCIAL_CONFIG } from '@/config/social';

interface LeaderboardDbRow {
  rating: number;
  provisional: boolean;
  ranked_matches_played?: number;
  ranked_wins?: number;
  instrument: 'piano' | 'guitar' | 'overall';
  profile?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
    player_progress?: { gem_rank: string }[];
  } | null;
}

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') ?? 'global';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(SOCIAL_CONFIG.LEADERBOARDS.PAGE_SIZE, 50);
  const offset = (page - 1) * pageSize;

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Friends leaderboard requires authenticated user
  if (tab === 'friends') {
    if (!jwt) {
      return NextResponse.json({ error: 'Authentication required for friends leaderboard' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get friend user IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const friendIds = new Set<string>([user.id]);
    for (const f of friendships ?? []) {
      friendIds.add(f.user_id === user.id ? f.friend_id : f.user_id);
    }

    const idList = Array.from(friendIds);

    const { data, count, error } = await supabase
      .from('competitive_ratings')
      .select(`
        rating, provisional, ranked_matches_played, ranked_wins, instrument,
        profile:user_id (id, username, display_name, avatar_url, player_progress(gem_rank))
      `, { count: 'exact' })
      .in('user_id', idList)
      .eq('season_id', SOCIAL_CONFIG.COMPETITIVE.CURRENT_SEASON_ID)
      .order('rating', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries: LeaderboardEntry[] = ((data as unknown as LeaderboardDbRow[]) ?? []).map((row, i: number) => {
      const matches = row.ranked_matches_played ?? 0;
      const wins = row.ranked_wins ?? 0;
      return {
        position:            offset + i + 1,
        userId:              row.profile?.id ?? '',
        username:            row.profile?.username ?? 'player',
        displayName:         row.profile?.display_name ?? 'Player',
        avatarUrl:           row.profile?.avatar_url ?? null,
        gemRank:             row.profile?.player_progress?.[0]?.gem_rank ?? 'Quartz',
        rating:              row.rating,
        provisional:         row.provisional,
        rankedWins:          wins,
        rankedMatchesPlayed: matches,
        winRate:             matches > 0 ? Math.round((wins / matches) * 100) : 0,
        instrument:          row.instrument,
      };
    });

    return NextResponse.json({ entries, total: count ?? entries.length, page, pageSize });
  }

  // 2. Instrument-specific or Global / Weekly boards
  let dbQuery = supabase
    .from('competitive_ratings')
    .select(`
      rating, provisional, ranked_matches_played, ranked_wins, instrument,
      profile:user_id (id, username, display_name, avatar_url, player_progress(gem_rank))
    `, { count: 'exact' })
    .eq('season_id', SOCIAL_CONFIG.COMPETITIVE.CURRENT_SEASON_ID)
    .order('rating', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (tab === 'piano') {
    dbQuery = dbQuery.eq('instrument', 'piano');
  } else if (tab === 'guitar') {
    dbQuery = dbQuery.eq('instrument', 'guitar');
  }

  const { data, count, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries: LeaderboardEntry[] = ((data as unknown as LeaderboardDbRow[]) ?? []).map((row, i: number) => {
    const matches = row.ranked_matches_played ?? 0;
    const wins = row.ranked_wins ?? 0;
    return {
      position:            offset + i + 1,
      userId:              row.profile?.id ?? '',
      username:            row.profile?.username ?? 'player',
      displayName:         row.profile?.display_name ?? 'Player',
      avatarUrl:           row.profile?.avatar_url ?? null,
      gemRank:             row.profile?.player_progress?.[0]?.gem_rank ?? 'Quartz',
      rating:              row.rating,
      provisional:         row.provisional,
      rankedWins:          wins,
      rankedMatchesPlayed: matches,
      winRate:             matches > 0 ? Math.round((wins / matches) * 100) : 0,
      instrument:          row.instrument,
    };
  });

  return NextResponse.json({ entries, total: count ?? entries.length, page, pageSize });
}
