/**
 * GET /api/admin/overview
 * Returns aggregated real-time game telemetry, room activity, match stats,
 * moderation counts, gem rank distribution, and Supabase health metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, usingServiceRole } = auth;
  const startedAt = Date.now();

  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // Execute independent telemetry queries in parallel; tolerate missing optional tables gracefully
  const [
    profilesRes,
    activeRoomsRes,
    totalMatchesRes,
    todayMatchesRes,
    recentMatchesRes,
    progressRes,
    openReportsRes,
    openDisputesRes,
    activeTournamentsRes,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db
      .from('rooms')
      .select('id, code, status, instrument, mode, created_at', { count: 'exact' })
      .in('status', ['lobby', 'voting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('match_history').select('id', { count: 'exact', head: true }),
    db
      .from('match_history')
      .select('id, accuracy, completed, score', { count: 'exact' })
      .gte('created_at', todayIso)
      .limit(500),
    db
      .from('match_history')
      .select('id, user_id, instrument, score, accuracy, highest_combo, completed, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
    db.from('player_progress').select('xp, gem_rank').limit(1000),
    db.from('user_reports').select('id', { count: 'exact', head: true }),
    db
      .from('tournament_disputes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    db
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['registration_open', 'check_in', 'bracket_ready', 'in_progress']),
  ]);

  const dbLatencyMs = Date.now() - startedAt;

  // Compute today's completion rate & average accuracy
  const todayRows = todayMatchesRes.data ?? [];
  const todayCount = todayMatchesRes.count ?? todayRows.length;
  const completedToday = todayRows.filter((r) => r.completed).length;
  const completionRate =
    todayRows.length > 0 ? Math.round((completedToday / todayRows.length) * 100) : 0;
  const avgAccuracy =
    todayRows.length > 0
      ? Math.round(
          (todayRows.reduce((sum, r) => sum + Number(r.accuracy ?? 0), 0) / todayRows.length) * 10
        ) / 10
      : 0;

  // Compute total XP distributed and Gem Rank breakdown
  const progressRows = progressRes.data ?? [];
  const totalXp = progressRows.reduce((sum, r) => sum + Number(r.xp ?? 0), 0);
  const rankDistribution: Record<string, number> = {
    Quartz: 0,
    Jade: 0,
    Sapphire: 0,
    Ruby: 0,
    Diamond: 0,
  };
  for (const row of progressRows) {
    const rank = row.gem_rank ?? 'Quartz';
    rankDistribution[rank] = (rankDistribution[rank] ?? 0) + 1;
  }

  // Enrich recent matches with player display names
  const recentRows = recentMatchesRes.data ?? [];
  const userIds = Array.from(new Set(recentRows.map((m) => m.user_id).filter(Boolean)));
  const profileMap: Record<string, { display_name: string; username: string }> = {};
  if (userIds.length > 0) {
    const { data: profs } = await db
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);
    for (const p of profs ?? []) {
      profileMap[p.id] = { display_name: p.display_name, username: p.username };
    }
  }

  const recentMatches = recentRows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    playerName: profileMap[m.user_id]?.display_name ?? 'Player',
    username: profileMap[m.user_id]?.username ?? 'unknown',
    instrument: m.instrument,
    score: m.score,
    accuracy: Number(m.accuracy ?? 0),
    highestCombo: m.highest_combo,
    completed: m.completed,
    createdAt: m.created_at,
  }));

  return NextResponse.json({
    metrics: {
      totalPlayers: profilesRes.count ?? 0,
      activeRooms: activeRoomsRes.count ?? (activeRoomsRes.data?.length ?? 0),
      totalMatches: totalMatchesRes.count ?? 0,
      matchesToday: todayCount,
      completionRate,
      avgAccuracy,
      totalXpDistributed: totalXp,
      openReports: openReportsRes.count ?? 0,
      openDisputes: openDisputesRes.count ?? 0,
      activeTournaments: activeTournamentsRes.count ?? 0,
    },
    rankDistribution,
    activeRoomsList: activeRoomsRes.data ?? [],
    recentMatches,
    health: {
      status: dbLatencyMs < 1500 ? 'healthy' : 'degraded',
      dbLatencyMs,
      usingServiceRole,
      checkedAt: new Date().toISOString(),
    },
  });
}
