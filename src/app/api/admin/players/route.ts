/**
 * GET & PATCH /api/admin/players
 * Admin player directory with search, rank filtering, pagination, and account moderation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db } = auth;
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') ?? '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(10, parseInt(searchParams.get('pageSize') ?? '20', 10)));
  const offset = (page - 1) * pageSize;

  let profileQuery = db
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, is_public, preferred_instrument, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (query) {
    profileQuery = profileQuery.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
  }

  const { data: profiles, count, error } = await profileQuery;

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ players: [], total: 0, page, pageSize });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.id);

  // Hydrate progress, stats, and competitive ratings in parallel
  const [progressRes, statsRes, ratingsRes] = ids.length
    ? await Promise.all([
        db.from('player_progress').select('user_id, xp, level, gem_rank').in('user_id', ids),
        db
          .from('player_stats')
          .select('user_id, best_score, songs_completed, highest_combo')
          .in('user_id', ids),
        db
          .from('competitive_ratings')
          .select('user_id, rating, ranked_wins, ranked_matches_played')
          .in('user_id', ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const progressMap = new Map((progressRes.data ?? []).map((r) => [r.user_id, r]));
  const statsMap = new Map((statsRes.data ?? []).map((r) => [r.user_id, r]));
  const ratingMap = new Map((ratingsRes.data ?? []).map((r) => [r.user_id, r]));

  const players = (profiles ?? []).map((p) => {
    const prog = progressMap.get(p.id);
    const st = statsMap.get(p.id);
    const rat = ratingMap.get(p.id);
    return {
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      isPublic: p.is_public,
      preferredInstrument: p.preferred_instrument ?? 'piano',
      createdAt: p.created_at,
      xp: prog?.xp ?? 0,
      level: prog?.level ?? 1,
      gemRank: prog?.gem_rank ?? 'Quartz',
      bestScore: st?.best_score ?? 0,
      songsCompleted: st?.songs_completed ?? 0,
      highestCombo: st?.highest_combo ?? 0,
      rating: rat?.rating ?? 1000,
      rankedWins: rat?.ranked_wins ?? 0,
      rankedMatches: rat?.ranked_matches_played ?? 0,
    };
  });

  return NextResponse.json({
    players,
    total: count ?? players.length,
    page,
    pageSize,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { userId?: string; isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body.userId || typeof body.isPublic !== 'boolean') {
    return NextResponse.json(
      { error: 'userId and boolean isPublic are required' },
      { status: 400 }
    );
  }

  const { error } = await auth.db
    .from('profiles')
    .update({ is_public: body.isPublic, updated_at: new Date().toISOString() })
    .eq('id', body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
