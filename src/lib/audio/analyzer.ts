/**
 * Lightweight Onset & Rhythm-Map Analyzer for PraiseTiles
 * Rule version: 1.0.0
 * 
 * ALGORITHM & HONESTY STATEMENT:
 * This analyzer performs lightweight energy-flux transient detection directly in the browser.
 * It detects prominent rhythmic energy peaks and maps them to a synchronized 4-lane grid
 * with progressive 3-stage density (Star 1, 2, and 3).
 * 
 * IMPORTANT: It does NOT perform polyphonic melody transcription or pitch-to-note extraction.
 * Generated note patterns represent beat-aligned rhythmic structures derived from the audio's
 * dynamic transients, providing a playable arcade rhythm game experience.
 */

import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Note, RhythmMap } from '@/types/game';

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
  return `pt-v1-${Math.round(duration)}s-${sampleRate}hz-${hexHash}`;
}

/**
 * Analyzes decoded AudioBuffer and produces a versioned 4-lane RhythmMap
 * with 3-star progression.
 */
export function generateRhythmMapFromAudio(
  buffer: AudioBuffer,
  songTitle: string = 'Authorized Track'
): RhythmMap {
  const duration = buffer.duration;
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const star1End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_1;
  const star2End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_2;
  const star3End = duration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_3;

  // Frame size: 50ms frames for transient analysis
  const frameDuration = 0.05; // 50ms
  const frameSize = Math.floor(sampleRate * frameDuration);
  const numFrames = Math.floor(channelData.length / frameSize);

  // 1. Calculate RMS energy per frame
  const energies: number[] = new Float32Array(numFrames) as unknown as number[];
  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize;
    let sumSquares = 0;
    for (let s = 0; s < frameSize; s++) {
      const sample = channelData[start + s];
      sumSquares += sample * sample;
    }
    energies[f] = Math.sqrt(sumSquares / frameSize);
  }

  // 2. Calculate spectral/energy flux (half-wave rectified difference)
  const flux: number[] = new Float32Array(numFrames) as unknown as number[];
  let meanFlux = 0;
  for (let f = 1; f < numFrames; f++) {
    const diff = energies[f] - energies[f - 1];
    flux[f] = diff > 0 ? diff : 0;
    meanFlux += flux[f];
  }
  meanFlux /= Math.max(1, numFrames - 1);

  // Calculate standard deviation of flux for adaptive thresholding
  let varSum = 0;
  for (let f = 1; f < numFrames; f++) {
    const d = flux[f] - meanFlux;
    varSum += d * d;
  }
  const stdDevFlux = Math.sqrt(varSum / Math.max(1, numFrames - 1));

  // 3. Peak detection with adaptive threshold
  // Base threshold: mean + 0.8 * stdDev
  const threshold = meanFlux + 0.8 * stdDevFlux;

  const rawOnsets: { time: number; energy: number }[] = [];
  for (let f = 2; f < numFrames - 2; f++) {
    const val = flux[f];
    if (
      val > threshold &&
      val >= flux[f - 1] &&
      val >= flux[f - 2] &&
      val >= flux[f + 1] &&
      val >= flux[f + 2]
    ) {
      const time = f * frameDuration;
      // Skip the first 1.5 seconds to let the player prepare after countdown
      if (time >= 1.5 && time <= duration - 1.0) {
        rawOnsets.push({ time, energy: val });
      }
    }
  }

  // 4. Map onsets into 3-Star density stages across 4 lanes
  const notes: Note[] = [];
  let noteIndex = 0;
  let lastNoteTime = 0;
  let lastLane = 1;

  for (const onset of rawOnsets) {
    const time = onset.time;
    const stage =
      time < star1End ? 1 : time < star2End ? 2 : 3;

    // Minimum interval between notes based on stage density:
    // Star 1: >= 0.70s minimum interval (spacious, introductory)
    // Star 2: >= 0.40s minimum interval (moderate, upbeat)
    // Star 3: >= 0.22s minimum interval (fast praise runs)
    const minInterval = stage === 1 ? 0.70 : stage === 2 ? 0.40 : 0.22;

    if (time - lastNoteTime < minInterval) {
      continue;
    }

    // Lane selection logic:
    // For Star 1: focus primarily on inner lanes 1 & 2 for beginner comfort
    // For Star 2: spread to lanes 0, 1, 2, 3
    // For Star 3: dynamic full-fretboard/four-lane patterns
    let lane: number;
    if (stage === 1) {
      lane = lastLane === 1 ? 2 : 1;
    } else {
      // Pick a lane different from the immediate previous lane
      const candidates = [0, 1, 2, 3].filter((l) => l !== lastLane);
      // Deterministic choice based on time and index for consistency
      const pickIdx = (Math.floor(time * 10) + noteIndex) % candidates.length;
      lane = candidates[pickIdx];
    }

    notes.push({
      id: `n-${noteIndex++}`,
      lane,
      time: Math.round(time * 1000) / 1000,
      hit: false,
      grade: null,
    });

    lastNoteTime = time;
    lastLane = lane;
  }

  // Fallback: If track has extremely quiet/subtle transients and fewer than 15 notes were found,
  // synthesize standard musical beat grid based on 120 BPM defaults
  if (notes.length < 15) {
    notes.length = 0;
    noteIndex = 0;
    lastLane = 0;
    const beatInterval = 0.5; // 120 BPM = 0.5s per beat
    let t = 2.0;
    while (t < duration - 1.0) {
      const stage = t < star1End ? 1 : t < star2End ? 2 : 3;
      const step = stage === 1 ? beatInterval * 2 : stage === 2 ? beatInterval : beatInterval * 0.75;
      
      const lane = (lastLane + 1) % 4;
      notes.push({
        id: `fb-${noteIndex++}`,
        lane,
        time: Math.round(t * 1000) / 1000,
        hit: false,
        grade: null,
      });
      lastLane = lane;
      t += step;
    }
  }

  const fingerprint = generateAudioFingerprint(buffer);

  return {
    version: GAMEPLAY_CONFIG.RULES_VERSION,
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
  };
}
