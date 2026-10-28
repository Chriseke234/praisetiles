/**
 * Playability & Integrity Validation Engine for PraiseTiles Rhythm Maps
 * Rule version: 2.0.0 (Phase 6 Quality Assurance)
 * 
 * Verifies that rhythm maps are technically sound, playable, non-fatiguing,
 * and meet competitive standards before entering multiplayer or ranked matches.
 */

import { AUDIO_CONFIG } from '@/config/audio';
import { RhythmMap } from '@/types/game';
import { RhythmMapMetrics, RhythmMapV2 } from '@/types/audio';

export interface MapValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: RhythmMapMetrics;
}

/**
 * Validates a rhythm map (v1.0 or v2.0) against technical and musical playability standards.
 */
export function validateRhythmMapPlayability(
  map: RhythmMap | RhythmMapV2
): MapValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic structural validation
  if (!map || typeof map !== 'object') {
    return {
      valid: false,
      errors: ['Map payload is null or not an object.'],
      warnings: [],
      metrics: {
        avgNotesPerSecond: 0,
        peakNotesPerSecond: 0,
        minNoteIntervalSec: 0,
        laneDistribution: [0, 0, 0, 0],
      },
    };
  }

  if (typeof map.duration !== 'number' || map.duration <= 0) {
    errors.push(`Invalid map duration: ${map.duration}`);
  }

  if (!Array.isArray(map.notes)) {
    errors.push('Map notes field must be an array.');
    return {
      valid: false,
      errors,
      warnings,
      metrics: {
        avgNotesPerSecond: 0,
        peakNotesPerSecond: 0,
        minNoteIntervalSec: 0,
        laneDistribution: [0, 0, 0, 0],
      },
    };
  }

  const notes = map.notes;

  // 2. Minimum total notes check
  if (notes.length < AUDIO_CONFIG.VALIDATION.MIN_TOTAL_NOTES) {
    errors.push(
      `Map has too few notes (${notes.length}). Minimum required is ${AUDIO_CONFIG.VALIDATION.MIN_TOTAL_NOTES}.`
    );
  }

  // 3. Note bounds and ordering inspection
  const laneCounts = [0, 0, 0, 0];
  let minInterval = Infinity;
  let lastTime = -1;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];

    if (!n || typeof n !== 'object') {
      errors.push(`Note at index ${i} is not a valid object.`);
      continue;
    }

    if (typeof n.id !== 'string' || !n.id) {
      errors.push(`Note at index ${i} is missing a valid id.`);
    }

    if (typeof n.time !== 'number' || isNaN(n.time) || n.time < 0) {
      errors.push(`Note at index ${i} has an invalid timestamp: ${n.time}`);
      continue;
    }

    if (n.time > map.duration + 0.1) {
      errors.push(
        `Note at index ${i} exceeds map duration (${n.time}s > ${map.duration}s).`
      );
    }

    if (typeof n.lane !== 'number' || n.lane < 0 || n.lane > 3 || !Number.isInteger(n.lane)) {
      errors.push(`Note at index ${i} has an invalid lane number (${n.lane}). Must be 0, 1, 2, or 3.`);
    } else {
      laneCounts[n.lane]++;
    }

    // Monotonic ordering
    if (n.time < lastTime) {
      errors.push(`Notes are not monotonically sorted: note ${i} (${n.time}s) occurs before note ${i - 1} (${lastTime}s).`);
    }

    // Minimum note interval check
    if (i > 0) {
      const interval = n.time - lastTime;
      if (interval < minInterval) minInterval = interval;
      // Absolute human limit for single-finger input stream: 0.10s (100ms)
      if (interval < 0.10) {
        errors.push(
          `Unplayable note interval detected between notes ${i - 1} and ${i} (${Math.round(interval * 1000)}ms). Minimum allowed is 100ms.`
        );
      }
    }

    lastTime = n.time;
  }

  // 4. Lane balance check
  const totalNotes = Math.max(1, notes.length);
  const laneDistribution: [number, number, number, number] = [
    Math.round((laneCounts[0] / totalNotes) * 1000) / 10,
    Math.round((laneCounts[1] / totalNotes) * 1000) / 10,
    Math.round((laneCounts[2] / totalNotes) * 1000) / 10,
    Math.round((laneCounts[3] / totalNotes) * 1000) / 10,
  ];

  const maxLanePercent = Math.max(...laneDistribution);
  if (maxLanePercent > AUDIO_CONFIG.VALIDATION.MAX_LANE_CONCENTRATION_PERCENT) {
    errors.push(
      `Lane imbalance: one lane contains ${maxLanePercent}% of all notes (maximum allowed is ${AUDIO_CONFIG.VALIDATION.MAX_LANE_CONCENTRATION_PERCENT}%).`
    );
  }

  // 5. Density and difficulty spike inspection (5-second sliding windows)
  const windowSec = 5.0;
  const numWindows = Math.ceil(map.duration / windowSec);
  const windowCounts = new Array(numWindows).fill(0);

  for (const n of notes) {
    const winIdx = Math.min(numWindows - 1, Math.floor(n.time / windowSec));
    windowCounts[winIdx]++;
  }

  for (let w = 1; w < numWindows; w++) {
    const prevCount = windowCounts[w - 1];
    const currCount = windowCounts[w];

    // Check maximum density (no 5s window should exceed 40 notes = 8 notes/sec)
    if (currCount > 40) {
      errors.push(
        `Excessive note burst in time window ${w * 5}s-${(w + 1) * 5}s (${currCount} notes in 5s = ${(currCount / 5).toFixed(1)} notes/sec).`
      );
    }

    // Check difficulty spike ratio (only if previous window had sufficient notes)
    if (prevCount >= 4) {
      const spikeRatio = currCount / prevCount;
      if (spikeRatio > AUDIO_CONFIG.VALIDATION.MAX_DIFFICULTY_SPIKE_RATIO) {
        warnings.push(
          `Sudden difficulty spike between windows ${(w - 1) * 5}s and ${w * 5}s (${spikeRatio.toFixed(1)}x density increase).`
        );
      }
    }
  }

  const avgNps = Math.round((notes.length / Math.max(1, map.duration)) * 10) / 10;
  const peakNps = Math.round((1 / Math.max(0.1, minInterval === Infinity ? 0.5 : minInterval)) * 10) / 10;

  const metrics: RhythmMapMetrics = {
    avgNotesPerSecond: avgNps,
    peakNotesPerSecond: peakNps,
    minNoteIntervalSec: minInterval === Infinity ? 0 : Math.round(minInterval * 1000) / 1000,
    laneDistribution,
    estimatedBpm: (map as RhythmMapV2).metrics?.estimatedBpm ?? null,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics,
  };
}
