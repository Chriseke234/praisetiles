/**
 * GET /api/admin/content
 * Returns curated approved gospel song pool, DSP analyzer configuration health,
 * and aggregated match performance per song fingerprint / instrument.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/auth';
import { TOURNAMENT_CONFIG } from '@/config/tournament';
import { AUDIO_CONFIG } from '@/config/audio';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db } = auth;

  // Fetch recent match_history rows to audit song playability & completion rates
  const { data: matchRows } = await db
    .from('match_history')
    .select('map_id, instrument, accuracy, completed, notes_hit, total_notes, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const songMap = new Map<
    string,
    {
      mapId: string;
      plays: number;
      completions: number;
      totalAccuracy: number;
      avgNotes: number;
      lastPlayedAt: string;
    }
  >();

  for (const row of matchRows ?? []) {
    const key = row.map_id || 'custom-upload';
    const existing = songMap.get(key) ?? {
      mapId: key,
      plays: 0,
      completions: 0,
      totalAccuracy: 0,
      avgNotes: 0,
      lastPlayedAt: row.created_at,
    };
    existing.plays += 1;
    if (row.completed) existing.completions += 1;
    existing.totalAccuracy += Number(row.accuracy ?? 0);
    existing.avgNotes =
      (existing.avgNotes * (existing.plays - 1) + Number(row.total_notes ?? 0)) / existing.plays;
    songMap.set(key, existing);
  }

  const auditedMaps = Array.from(songMap.values())
    .map((entry) => {
      const completionRate = entry.plays > 0 ? Math.round((entry.completions / entry.plays) * 100) : 0;
      const avgAccuracy = entry.plays > 0 ? Math.round((entry.totalAccuracy / entry.plays) * 10) / 10 : 0;
      const healthStatus =
        entry.avgNotes < AUDIO_CONFIG.VALIDATION.MIN_TOTAL_NOTES
          ? 'warning'
          : completionRate < 25 && entry.plays >= 3
          ? 'review'
          : 'healthy';

      return {
        mapId: entry.mapId,
        plays: entry.plays,
        completionRate,
        avgAccuracy,
        avgNotes: Math.round(entry.avgNotes),
        healthStatus,
        lastPlayedAt: entry.lastPlayedAt,
      };
    })
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 25);

  return NextResponse.json({
    approvedPool: TOURNAMENT_CONFIG.APPROVED_SONG_POOL,
    analyzerConfig: {
      version: AUDIO_CONFIG.ALGORITHM_VERSION,
      minDurationSec: AUDIO_CONFIG.VALIDATION.MIN_DURATION_SEC,
      maxDurationSec: AUDIO_CONFIG.VALIDATION.MAX_DURATION_SEC,
      maxLaneConcentration: AUDIO_CONFIG.VALIDATION.MAX_LANE_CONCENTRATION_PERCENT,
      maxDifficultySpike: AUDIO_CONFIG.VALIDATION.MAX_DIFFICULTY_SPIKE_RATIO,
    },
    auditedMaps,
  });
}
