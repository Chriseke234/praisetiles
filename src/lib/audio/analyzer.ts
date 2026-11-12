/**
 * Advanced Multi-Band Onset & Rhythm-Map Analyzer for PraiseTiles
 * Rule version: 2.0.0 (Phase 6 Audio Intelligence Engine)
 * 
 * ALGORITHM & HONESTY STATEMENT:
 * This analyzer performs 2-band sub-band spectral flux transient detection directly in the browser.
 * It separates low-frequency energy (kick drums, bass transients < 250 Hz) from high-frequency
 * percussive/melodic attacks (> 250 Hz), computes localized adaptive thresholds over a sliding window,
 * suppresses duplicate onsets, and deterministically maps events into a 4-lane grid with 3-star density progression.
 * 
 * IMPORTANT: It does NOT perform polyphonic melody transcription or pitch-to-note extraction.
 * Generated note patterns represent beat-aligned rhythmic structures derived from the audio's
 * dynamic transients, providing a responsive and musically engaging arcade rhythm game experience.
 */

import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { AUDIO_CONFIG } from '@/config/audio';
import {
  DifficultyProfileName,
  NoteV2,
  OnsetCandidate,
  RhythmMapMetrics,
  RhythmMapV2,
} from '@/types/audio';

/**
 * Creates a deterministic fingerprint string for the audio track based on duration,
 * sample rate, channel count, and sampled audio values.
 */
export function generateAudioFingerprint(buffer: AudioBuffer): string {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;
  const length = buffer.length;

  // Sample 64 points across the buffer to create a fast, deterministic hash
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(length / 64));
  for (let i = 0; i < length; i += step) {
    const val = Math.floor((channelData[i] + 1) * 10000);
    hash ^= val;
    hash = Math.imul(hash, 0x01000193);
  }

  const hexHash = (hash >>> 0).toString(16).padStart(8, '0');
  return `pt-v2-${Math.round(duration)}s-${sampleRate}hz-${hexHash}`;
}

/**
 * Computes a deterministic checksum for a rhythm map's core content.
 */
export function calculateMapChecksum(map: {
  version: string;
  audioFingerprint: string;
  duration: number;
  totalNotes: number;
  notes: { id: string; time: number; lane: number }[];
}): string {
  let hash = 0x811c9dc5;
  const seedStr = `${map.version}:${map.audioFingerprint}:${Math.round(map.duration * 100)}:${map.totalNotes}`;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  for (const n of map.notes) {
    const noteStr = `${n.lane}@${Math.round(n.time * 1000)}`;
    for (let i = 0; i < noteStr.length; i++) {
      hash ^= noteStr.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Estimates overall song tempo (BPM) via autocorrelation of the energy flux signal.
 * Returns estimated BPM (e.g. 120) or null if no strong periodicity is detected.
 */
export function estimateTempoFromFlux(
  flux: Float32Array,
  hopDurationSec: number
): number | null {
  if (flux.length < 100) return null;

  // Search range: 60 BPM to 180 BPM
  const minLag = Math.floor((60 / 180) / hopDurationSec);
  const maxLag = Math.floor((60 / 60) / hopDurationSec);

  let bestLag = -1;
  let maxCorr = 0;

  for (let lag = minLag; lag <= maxLag && lag < flux.length / 2; lag++) {
    let corr = 0;
    const count = Math.min(flux.length - lag, 1000); // Sample up to 1000 frames
    for (let i = 0; i < count; i++) {
      corr += flux[i] * flux[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag > 0) {
    const periodSec = bestLag * hopDurationSec;
    const bpm = Math.round(60 / periodSec);
    if (bpm >= 60 && bpm <= 180) {
      return bpm;
    }
  }

  return null;
}

/**
 * Pure function mapping onset candidates to 4-lane notes with short & long sustain notes
 * and enforcing the Long-Tile Mutual Exclusivity Rule.
 */
export function mapCandidatesToNotes(
  candidates: Array<{ time: number; confidence: number; bandType?: 'low' | 'high' | 'full'; sustainDurationSec?: number }>,
  duration: number,
  star1End: number,
  star2End: number,
  profile: typeof AUDIO_CONFIG.DIFFICULTY_PROFILES['standard'] = AUDIO_CONFIG.DIFFICULTY_PROFILES.standard
): NoteV2[] {
  const notes: NoteV2[] = [];
  let noteIndex = 0;
  let lastNoteTime = 0;
  let lastLane = 1;
  let activeSustainUntil = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const time = candidate.time;
    const bandType = candidate.bandType ?? 'full';

    // RULE: When a long tile is active, suppress competing note generation
    if (time < activeSustainUntil) {
      continue;
    }

    const stage = time < star1End ? 1 : time < star2End ? 2 : 3;

    const minInterval =
      stage === 1
        ? profile.minIntervalStar1Sec
        : stage === 2
        ? profile.minIntervalStar2Sec
        : profile.minIntervalStar3Sec;

    if (time - lastNoteTime < minInterval) {
      continue;
    }

    // Determine if this note qualifies as a long (sustained) tile:
    let nextCandidateTime = duration;
    for (let j = i + 1; j < candidates.length; j++) {
      if (candidates[j].time - time >= minInterval) {
        nextCandidateTime = candidates[j].time;
        break;
      }
    }
    const gap = nextCandidateTime - time;

    // Genuine sustain: must have sufficient gap and detected acoustic persistence or strong downbeat anchor
    const hasAcousticSustain = Boolean(candidate.sustainDurationSec && candidate.sustainDurationSec >= 0.5);
    const isLongSustainEligible =
      gap >= 0.85 &&
      candidate.confidence >= 0.60 &&
      time + 0.6 <= duration &&
      (hasAcousticSustain || (noteIndex % 4 === 0 && gap >= 1.0) || (bandType === 'low' && gap >= 1.1));

    let noteType: 'short' | 'long' = 'short';
    let sustainDuration: number | undefined = undefined;

    if (isLongSustainEligible) {
      noteType = 'long';
      const rawDur = candidate.sustainDurationSec
        ? Math.min(candidate.sustainDurationSec, gap - 0.2)
        : Math.round((gap - 0.25) * 10) / 10;
      sustainDuration = Math.min(1.8, Math.max(0.6, Math.round(rawDur * 10) / 10));
      activeSustainUntil = time + sustainDuration + 0.15;
    }

    const allowedLanes =
      stage === 1
        ? profile.allowedLanesStar1
        : stage === 2
        ? profile.allowedLanesStar2
        : profile.allowedLanesStar3;

    const laneChoices = allowedLanes.filter((l) => l !== lastLane);
    const validChoices = laneChoices.length > 0 ? laneChoices : allowedLanes;

    // Special rhythm patterns: alternating patterns on fast runs, downbeat anchoring on kicks
    let lane: number;
    if (bandType === 'low' && validChoices.includes(0)) {
      // Anchoring kick on outer/inner lane alternation
      lane = (noteIndex % 2 === 0 && validChoices.includes(0)) ? 0 : validChoices[noteIndex % validChoices.length];
    } else if (gap < 0.35 && validChoices.length >= 2) {
      // Fast alternating pattern (e.g. ping-pong between lanes)
      const altPick = (lastLane + 2) % validChoices.length;
      lane = validChoices[altPick] ?? validChoices[0];
    } else {
      const bandOffset = bandType === 'low' ? 0 : bandType === 'high' ? 2 : 1;
      const pickIdx = (Math.floor(time * 10) + noteIndex + bandOffset) % validChoices.length;
      lane = validChoices[pickIdx];
    }

    notes.push({
      id: `n-${noteIndex++}`,
      lane,
      time: Math.round(time * 1000) / 1000,
      hit: false,
      grade: null,
      type: noteType,
      duration: sustainDuration,
      sustainProgress: noteType === 'long' ? 0 : undefined,
      sustainState: noteType === 'long' ? 'idle' : undefined,
      confidence: candidate.confidence,
      bandType,
    });

    lastNoteTime = time;
    lastLane = lane;
  }

  return notes;
}

/**
 * Analyzes decoded AudioBuffer using 2-Band Spectral Flux with adaptive local windowing
 * and produces a versioned 4-lane RhythmMapV2 with 3-star progression.
 */
export function generateRhythmMapFromAudio(
  buffer: AudioBuffer,
  songTitle: string = 'Authorized Track',
  difficulty: DifficultyProfileName = 'standard'
): RhythmMapV2 {
  const duration = buffer.duration;
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const profile = AUDIO_CONFIG.DIFFICULTY_PROFILES[difficulty] ?? AUDIO_CONFIG.DIFFICULTY_PROFILES.standard;

  const star1End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_1;
  const star2End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_2;
  const star3End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_3;

  // 1. DSP Setup: Frame size (40ms) & Hop size (20ms)
  const frameDuration = AUDIO_CONFIG.DSP.FRAME_DURATION_SEC;
  const hopDuration = AUDIO_CONFIG.DSP.HOP_DURATION_SEC;
  const frameSize = Math.floor(sampleRate * frameDuration);
  const hopSize = Math.floor(sampleRate * hopDuration);
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  if (numFrames <= 0) {
    throw new Error('Audio track is too short for rhythm analysis.');
  }

  // 2. Multi-Band Separation:
  // Low-pass filter (~250 Hz) for kick/bass transients using a single-pole IIR filter
  // RC = 1 / (2 * pi * cutoff); alpha = dt / (RC + dt)
  const cutoffHz = AUDIO_CONFIG.DSP.SUB_BAND_CROSSOVER_HZ;
  const dt = 1.0 / sampleRate;
  const rc = 1.0 / (2.0 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);

  const lowData = new Float32Array(channelData.length);
  let lastLow = 0;
  for (let i = 0; i < channelData.length; i++) {
    lastLow += alpha * (channelData[i] - lastLow);
    lowData[i] = lastLow;
  }

  // 3. Compute Low-band and High-band energy envelopes
  const lowEnergies = new Float32Array(numFrames);
  const highEnergies = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sumLow = 0;
    let sumHigh = 0;

    for (let s = 0; s < frameSize; s++) {
      const idx = start + s;
      const lowSample = lowData[idx];
      const highSample = channelData[idx] - lowSample; // High-pass component
      sumLow += lowSample * lowSample;
      sumHigh += highSample * highSample;
    }

    lowEnergies[f] = Math.sqrt(sumLow / frameSize);
    highEnergies[f] = Math.sqrt(sumHigh / frameSize);
  }

  // 4. Compute 2-Band Spectral Flux (Half-Wave Rectified Difference)
  const combinedFlux = new Float32Array(numFrames);
  const bandIdentities: ('low' | 'high' | 'full')[] = new Array(numFrames);

  for (let f = 1; f < numFrames; f++) {
    const diffLow = Math.max(0, lowEnergies[f] - lowEnergies[f - 1]);
    const diffHigh = Math.max(0, highEnergies[f] - highEnergies[f - 1]);

    const weightedFlux =
      diffLow * AUDIO_CONFIG.DSP.LOW_BAND_WEIGHT +
      diffHigh * AUDIO_CONFIG.DSP.HIGH_BAND_WEIGHT;

    combinedFlux[f] = weightedFlux;

    if (diffLow > diffHigh * 1.5) {
      bandIdentities[f] = 'low';
    } else if (diffHigh > diffLow * 1.5) {
      bandIdentities[f] = 'high';
    } else {
      bandIdentities[f] = 'full';
    }
  }

  // Estimate tempo from combined flux
  const estimatedBpm = estimateTempoFromFlux(combinedFlux, hopDuration);

  // 5. Local Adaptive Window Thresholding & Peak Detection
  // Window size: 800ms / 20ms hop = ~40 frames
  const windowRadius = Math.max(3, Math.floor((AUDIO_CONFIG.DSP.LOCAL_WINDOW_SEC / hopDuration) / 2));
  const sensitivity = profile.adaptiveThresholdSensitivity;

  const candidateOnsets: OnsetCandidate[] = [];

  for (let f = windowRadius; f < numFrames - windowRadius; f++) {
    const val = combinedFlux[f];
    if (val <= 0.0001) continue;

    // Check if this frame is a local peak within ±2 frames
    const isLocalPeak =
      val >= combinedFlux[f - 1] &&
      val >= combinedFlux[f - 2] &&
      val >= combinedFlux[f + 1] &&
      val >= combinedFlux[f + 2];

    if (!isLocalPeak) continue;

    // Calculate local mean and standard deviation across sliding window
    let localSum = 0;
    for (let w = f - windowRadius; w <= f + windowRadius; w++) {
      localSum += combinedFlux[w];
    }
    const localMean = localSum / (2 * windowRadius + 1);

    let localVariance = 0;
    for (let w = f - windowRadius; w <= f + windowRadius; w++) {
      const diff = combinedFlux[w] - localMean;
      localVariance += diff * diff;
    }
    const localStdDev = Math.sqrt(localVariance / (2 * windowRadius + 1));

    // Adaptive threshold for this frame
    const threshold = localMean + sensitivity * localStdDev;

    if (val > threshold) {
      const time = f * hopDuration;
      // Skip prepare padding at start and exit padding at end
      if (
        time >= AUDIO_CONFIG.DSP.INITIAL_PREPARE_PADDING_SEC &&
        time <= duration - AUDIO_CONFIG.DSP.END_PADDING_SEC
      ) {
        // Calculate confidence score (normalized difference above threshold)
        const confidence = Math.min(1.0, (val - threshold) / (localStdDev > 0 ? localStdDev * 2 : 1.0));

        // Evaluate genuine acoustic energy persistence across subsequent frames (up to 1.6s)
        let sustainedFrames = 0;
        const maxSustainFrames = Math.min(Math.floor(1.6 / hopDuration), numFrames - f - 1);
        const minSustainFrames = Math.floor(0.45 / hopDuration);
        const energyFloor = Math.max(0.001, (lowEnergies[f] + highEnergies[f]) * 0.35);

        for (let s = 1; s <= maxSustainFrames; s++) {
          const combinedPostEnergy = lowEnergies[f + s] + highEnergies[f + s];
          if (combinedPostEnergy >= energyFloor) {
            sustainedFrames++;
          } else {
            break;
          }
        }

        const sustainDurationSec = sustainedFrames >= minSustainFrames
          ? Math.min(1.8, Math.max(0.6, Math.round(sustainedFrames * hopDuration * 10) / 10))
          : undefined;

        candidateOnsets.push({
          time,
          energy: val,
          confidence: Math.round(confidence * 100) / 100,
          bandType: bandIdentities[f],
          sustainDurationSec,
        });
      }
    }
  }

  // 6. Duplicate Onset Suppression:
  // Discard candidates that occur within 120ms of a previous higher-energy onset
  const suppressionWindow = AUDIO_CONFIG.DSP.DUPLICATE_SUPPRESSION_WINDOW_SEC;
  const filteredCandidates: OnsetCandidate[] = [];

  for (let i = 0; i < candidateOnsets.length; i++) {
    const current = candidateOnsets[i];
    let isSuppressed = false;

    // Look back at accepted candidates
    for (let j = filteredCandidates.length - 1; j >= 0; j--) {
      const prev = filteredCandidates[j];
      if (current.time - prev.time < suppressionWindow) {
        if (prev.energy >= current.energy) {
          isSuppressed = true;
          break;
        }
      } else {
        break;
      }
    }

    if (!isSuppressed) {
      filteredCandidates.push(current);
    }
  }

  // 7. Map Onsets into 3-Star Density Stages across 4 Lanes (Short & Sustained Long Tiles)
  const notes: NoteV2[] = mapCandidatesToNotes(filteredCandidates, duration, star1End, star2End, profile);

  // 8. Fallback for Extremely Sparse / Ambient Tracks
  // If track has fewer than MIN_TOTAL_NOTES, synthesize musically placed beats
  if (notes.length < AUDIO_CONFIG.VALIDATION.MIN_TOTAL_NOTES) {
    notes.length = 0;
    let noteIndex = 0;
    let lastLane = 0;
    const fallbackBpm = estimatedBpm ?? 120;
    const beatInterval = 60 / fallbackBpm;
    let t = 2.0;

    while (t < duration - 1.0) {
      const stage = t < star1End ? 1 : t < star2End ? 2 : 3;
      const step = stage === 1 ? beatInterval * 2 : stage === 2 ? beatInterval : beatInterval * 0.75;
      const allowedLanes = stage === 1 ? profile.allowedLanesStar1 : [0, 1, 2, 3];
      const lane = allowedLanes[(lastLane + 1) % allowedLanes.length];

      // Introduce occasional sustained note in slower sections
      const isLong = step >= 1.2 && noteIndex % 5 === 0;
      const sustainDur = isLong ? Math.min(1.5, Math.round((step - 0.3) * 10) / 10) : undefined;

      notes.push({
        id: `fb-${noteIndex++}`,
        lane,
        time: Math.round(t * 1000) / 1000,
        hit: false,
        grade: null,
        type: isLong ? 'long' : 'short',
        duration: sustainDur,
        sustainProgress: isLong ? 0 : undefined,
        sustainState: isLong ? 'idle' : undefined,
        confidence: 0.7,
        bandType: 'full',
      });

      lastLane = lane;
      t += isLong && sustainDur ? sustainDur + 0.3 : step;
    }
  }

  // 9. Compute Metrics
  const laneCounts = [0, 0, 0, 0];
  let minIntervalFound = Infinity;

  for (let i = 0; i < notes.length; i++) {
    laneCounts[notes[i].lane]++;
    if (i > 0) {
      const diff = notes[i].time - notes[i - 1].time;
      if (diff < minIntervalFound) minIntervalFound = diff;
    }
  }

  const laneDistribution: [number, number, number, number] = [
    Math.round((laneCounts[0] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[1] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[2] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[3] / Math.max(1, notes.length)) * 1000) / 10,
  ];

  const avgNps = Math.round((notes.length / Math.max(1, duration)) * 10) / 10;
  const fingerprint = generateAudioFingerprint(buffer);

  const mapMetadata = {
    version: '2.0.0' as const,
    audioFingerprint: fingerprint,
    duration,
    totalNotes: notes.length,
    notes,
  };

  const checksum = calculateMapChecksum(mapMetadata);

  const metrics: RhythmMapMetrics = {
    avgNotesPerSecond: avgNps,
    peakNotesPerSecond: Math.round((1 / Math.max(0.1, minIntervalFound)) * 10) / 10,
    minNoteIntervalSec: Math.round(minIntervalFound * 1000) / 1000,
    laneDistribution,
    estimatedBpm,
  };

  return {
    version: '2.0.0',
    mapId: `map-${fingerprint}-${difficulty}`,
    algorithmVersion: AUDIO_CONFIG.ALGORITHM_VERSION,
    audioFingerprint: fingerprint,
    songTitle,
    duration,
    totalNotes: notes.length,
    notes,
    stages: {
      star1End: Math.round(star1End * 100) / 100,
      star2End: Math.round(star2End * 100) / 100,
      star3End: Math.round(star3End * 100) / 100,
    },
    difficultyProfile: difficulty,
    metrics,
    validationStatus: 'valid',
    integrityChecksum: checksum,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generates a progressive 3-star beat-aligned rhythm map for a given duration and song title
 * (e.g. for YouTube tracks or streaming audio where direct AudioBuffer PCM is unavailable).
 */
export function generateRhythmMapForDuration(
  songTitle: string,
  rawDuration: number,
  estimatedBpm: number = 120,
  difficulty: DifficultyProfileName = 'standard'
): RhythmMapV2 {
  const MIN_DURATION = 30;
  const MAX_DURATION = 300;
  // Clamp duration to valid gameplay range (30s to 300s)
  const duration = Math.min(
    MAX_DURATION,
    Math.max(MIN_DURATION, rawDuration || 60)
  );

  const star1End = duration * 0.33;
  const star2End = duration * 0.66;
  const star3End = duration;

  const bpm = estimatedBpm >= 60 && estimatedBpm <= 200 ? estimatedBpm : 120;
  const beatInterval = 60 / bpm;

  const notes: NoteV2[] = [];
  let noteIndex = 0;
  let lastLane = 0;
  let t = 2.0; // 2s initial breathing room

  while (t < duration - 1.0) {
    const stage = t < star1End ? 1 : t < star2End ? 2 : 3;
    // Escalating rhythm frequency per stage
    const step = stage === 1 ? beatInterval * 1.5 : stage === 2 ? beatInterval : beatInterval * 0.75;
    
    // Lane distribution
    const allowedLanes = stage === 1 ? [0, 1, 2] : [0, 1, 2, 3];
    let lane = (lastLane + 1) % allowedLanes.length;
    if (noteIndex % 3 === 0) {
      lane = (lastLane + 2) % allowedLanes.length;
    }
    lastLane = lane;

    // Introduce regular sustained long tiles
    const isLong = noteIndex > 0 && noteIndex % 6 === 0;
    const sustainDur = isLong ? Math.min(1.8, Math.max(0.6, Math.round(step * 1.4 * 10) / 10)) : undefined;

    notes.push({
      id: `note-stream-${noteIndex}-${t.toFixed(3)}`,
      time: Math.round(t * 1000) / 1000,
      lane: allowedLanes[lane],
      hit: false,
      grade: null,
      type: isLong ? 'long' : 'short',
      duration: sustainDur,
      sustainProgress: isLong ? 0 : undefined,
      sustainState: isLong ? 'idle' : undefined,
    });

    noteIndex++;
    t += step;
  }

  // Ensure minimum total notes
  while (notes.length < AUDIO_CONFIG.VALIDATION.MIN_TOTAL_NOTES && t < duration + 10) {
    t += 0.8;
    notes.push({
      id: `note-stream-fill-${notes.length}`,
      time: Math.round(t * 1000) / 1000,
      lane: notes.length % 4,
      hit: false,
      grade: null,
      type: 'short',
    });
  }

  const fingerprint = `pt-stream-${Math.round(duration)}s-${encodeURIComponent(songTitle.slice(0, 16))}`;
  const mapMetadata = {
    version: '2.0.0' as const,
    audioFingerprint: fingerprint,
    duration,
    totalNotes: notes.length,
    notes,
  };
  const checksum = calculateMapChecksum(mapMetadata);

  const laneCounts = [0, 0, 0, 0];
  for (const n of notes) {
    laneCounts[n.lane]++;
  }

  const laneDistribution: [number, number, number, number] = [
    Math.round((laneCounts[0] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[1] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[2] / Math.max(1, notes.length)) * 1000) / 10,
    Math.round((laneCounts[3] / Math.max(1, notes.length)) * 1000) / 10,
  ];

  const avgNps = Math.round((notes.length / Math.max(1, duration)) * 10) / 10;

  const metrics: RhythmMapMetrics = {
    avgNotesPerSecond: avgNps,
    peakNotesPerSecond: Math.round((bpm / 60) * 10) / 10,
    minNoteIntervalSec: Math.round(beatInterval * 0.75 * 1000) / 1000,
    laneDistribution,
    estimatedBpm: bpm,
  };

  return {
    version: '2.0.0',
    mapId: `map-${fingerprint}-${difficulty}`,
    algorithmVersion: AUDIO_CONFIG.ALGORITHM_VERSION,
    audioFingerprint: fingerprint,
    songTitle,
    duration,
    totalNotes: notes.length,
    notes,
    stages: {
      star1End: Math.round(star1End * 100) / 100,
      star2End: Math.round(star2End * 100) / 100,
      star3End: Math.round(star3End * 100) / 100,
    },
    difficultyProfile: difficulty,
    metrics,
    validationStatus: 'valid',
    integrityChecksum: checksum,
    createdAt: new Date().toISOString(),
  };
}
