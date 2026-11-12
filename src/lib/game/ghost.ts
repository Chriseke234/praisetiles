/**
 * Ghost Performance Recording & Head-to-Head Replay Engine
 * Phase 6/8 Upgrade — PraiseTiles
 */

import { InstrumentType, RunResult } from '@/types/game';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { safeLocalStorage } from '@/lib/storage/safeStorage';

export interface GhostSnapshot {
  time: number; // Audio time in seconds
  score: number; // Score achieved at this second
  combo: number;
}

export interface GhostRun {
  id: string;
  userId: string;
  displayName: string;
  songTitle: string;
  songFingerprint: string;
  instrument: InstrumentType;
  finalScore: number;
  accuracy: number;
  maxCombo: number;
  snapshots: GhostSnapshot[];
  createdAt: string;
}

const LOCAL_STORAGE_GHOST_PREFIX = 'praisetiles_ghost_';

/**
 * Persists a winning run as a ghost record for head-to-head challenge.
 */
export async function saveGhostRun(
  runResult: RunResult,
  songTitle: string,
  songFingerprint: string,
  snapshots: GhostSnapshot[],
  userId?: string,
  displayName?: string
): Promise<GhostRun> {
  const ghost: GhostRun = {
    id: `ghost-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: userId ?? 'guest',
    displayName: displayName ?? 'Praise Runner',
    songTitle,
    songFingerprint,
    instrument: runResult.instrument,
    finalScore: runResult.score,
    accuracy: runResult.accuracy,
    maxCombo: runResult.highestCombo,
    snapshots,
    createdAt: new Date().toISOString(),
  };

  // Local storage cache fallback (Safari safe)
  try {
    if (typeof window !== 'undefined') {
      const key = `${LOCAL_STORAGE_GHOST_PREFIX}${songFingerprint}_${runResult.instrument}`;
      safeLocalStorage.setItem(key, JSON.stringify(ghost));
    }
  } catch (err) {
    console.warn('[Ghost] Local storage save failed:', err);
  }

  // Supabase persistence if user is authenticated
  if (userId && userId !== 'guest') {
    try {
      const sb = getSupabaseBrowserClient();
      if (sb) {
        await sb.from('ghost_performances').insert({
          id: ghost.id,
          user_id: userId,
          song_fingerprint: songFingerprint,
          song_title: songTitle,
          instrument: runResult.instrument,
          final_score: runResult.score,
          accuracy: runResult.accuracy,
          max_combo: runResult.highestCombo,
          snapshots: ghost.snapshots,
        });
      }
    } catch (err) {
      console.warn('[Ghost] Supabase ghost insert failed:', err);
    }
  }

  return ghost;
}

/**
 * Retrieves the best ghost run for a song and instrument.
 */
export async function loadGhostRun(
  songFingerprint: string,
  instrument: InstrumentType,
  userId?: string
): Promise<GhostRun | null> {
  // Try Supabase first if online
  try {
    const sb = getSupabaseBrowserClient();
    if (sb) {
      const query = sb
        .from('ghost_performances')
        .select('*')
        .eq('song_fingerprint', songFingerprint)
        .eq('instrument', instrument)
        .order('final_score', { ascending: false })
        .limit(1);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const row = data[0];
        return {
          id: row.id,
          userId: row.user_id,
          displayName: row.display_name ?? 'Top Praiser',
          songTitle: row.song_title,
          songFingerprint: row.song_fingerprint,
          instrument: row.instrument,
          finalScore: row.final_score,
          accuracy: row.accuracy,
          maxCombo: row.max_combo,
          snapshots: row.snapshots ?? [],
          createdAt: row.created_at,
        };
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // Fallback to local storage (Safari safe)
  try {
    if (typeof window !== 'undefined') {
      const key = `${LOCAL_STORAGE_GHOST_PREFIX}${songFingerprint}_${instrument}`;
      const saved = safeLocalStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved) as GhostRun;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Calculates ghost score at current audio timestamp by interpolating snapshots.
 */
export function getGhostScoreAtTime(snapshots: GhostSnapshot[], currentTime: number): number {
  if (!snapshots || snapshots.length === 0) return 0;
  if (currentTime <= snapshots[0].time) return snapshots[0].score;
  if (currentTime >= snapshots[snapshots.length - 1].time) {
    return snapshots[snapshots.length - 1].score;
  }

  // Linear scan or binary search
  for (let i = 0; i < snapshots.length - 1; i++) {
    const cur = snapshots[i];
    const next = snapshots[i + 1];
    if (currentTime >= cur.time && currentTime <= next.time) {
      const fraction = (currentTime - cur.time) / (next.time - cur.time);
      return Math.round(cur.score + fraction * (next.score - cur.score));
    }
  }

  return snapshots[snapshots.length - 1].score;
}
