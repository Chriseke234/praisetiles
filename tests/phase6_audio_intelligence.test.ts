/**
 * Phase 6 Audio Intelligence, Multi-Band Onset Detection & Playability Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  inspectAudioHeader,
  validateAudioFile,
  analyzeAudioBufferQuality,
} from '../src/lib/audio/validator';
import {
  generateAudioFingerprint,
  generateRhythmMapFromAudio,
  estimateTempoFromFlux,
} from '../src/lib/audio/analyzer';
import { validateRhythmMapPlayability } from '../src/lib/audio/mapValidator';
import { GameEngine } from '../src/lib/game/engine';
import { RhythmMap } from '../src/types/game';

// Helper to create synthetic AudioBuffers with controllable waveform transients
function createTestAudioBuffer(
  durationSec: number,
  sampleRate: number = 44100,
  opts?: {
    beatBpm?: number;
    amplitude?: number;
    silent?: boolean;
    clipped?: boolean;
  }
): AudioBuffer {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const channelData = new Float32Array(totalSamples);
  const amplitude = opts?.amplitude ?? 0.8;

  if (!opts?.silent) {
    if (opts?.clipped) {
      // Create widespread clipping (> 20% of buffer)
      for (let s = 0; s < totalSamples; s += 3) {
        channelData[s] = 1.0;
      }
    } else {
      const bpm = opts?.beatBpm ?? 120;
      const beatIntervalSamples = Math.floor((60 / bpm) * sampleRate);

      for (let s = 0; s < totalSamples; s += beatIntervalSamples) {
        for (let k = 0; k < 300 && s + k < totalSamples; k++) {
          channelData[s + k] = amplitude * Math.exp(-k / 30);
        }
      }
    }
  }

  return {
    duration: durationSec,
    sampleRate,
    length: totalSamples,
    numberOfChannels: 1,
    getChannelData: () => channelData,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

// ===========================================================================
// 1. AUDIO VALIDATION & QUALITY DIAGNOSTICS
// ===========================================================================
describe('Audio Validation & Quality Diagnostics', () => {
  it('correctly inspects ID3v2 MP3 headers', () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(inspectAudioHeader(bytes).valid).toBe(true);
  });

  it('correctly inspects WAV RIFF headers', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(inspectAudioHeader(bytes).valid).toBe(true);
  });

  it('detects near-silent audio and flags it as invalid', () => {
    const silentBuffer = createTestAudioBuffer(60, 44100, { silent: true });
    const quality = analyzeAudioBufferQuality(silentBuffer);
    expect(quality.isNearSilent).toBe(true);
    expect(quality.peakAmplitude).toBeLessThan(0.005);
    expect(quality.rmsEnergy).toBeLessThan(0.001);
  });

  it('detects clipped audio and computes clipping percentage', () => {
    const clippedBuffer = createTestAudioBuffer(60, 44100, { clipped: true });
    const quality = analyzeAudioBufferQuality(clippedBuffer);
    expect(quality.isClipped).toBe(true);
    expect(quality.clipPercentage).toBeGreaterThan(15.0);
  });

  it('detects non-silent, healthy audio', () => {
    const healthyBuffer = createTestAudioBuffer(60, 44100, { beatBpm: 120, amplitude: 0.7 });
    const quality = analyzeAudioBufferQuality(healthyBuffer);
    expect(quality.isNearSilent).toBe(false);
    expect(quality.peakAmplitude).toBeGreaterThan(0.5);
  });

  it('aborts validation when AbortSignal is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const file = new File([new Uint8Array(100)], 'test.mp3', { type: 'audio/mpeg' });
    const result = await validateAudioFile(file, undefined, controller.signal);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cancelled');
  });

  it('rejects files exceeding 15 MB limit', async () => {
    const bigFile = new File([new Uint8Array(16 * 1024 * 1024)], 'big.mp3', { type: 'audio/mpeg' });
    const result = await validateAudioFile(bigFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

// ===========================================================================
// 2. MULTI-BAND ONSET DETECTION & ANALYSIS
// ===========================================================================
describe('Multi-Band Onset Detection & Fingerprinting', () => {
  it('generates consistent, deterministic audio fingerprint', () => {
    const buffer = createTestAudioBuffer(60, 44100, { beatBpm: 120 });
    const fp1 = generateAudioFingerprint(buffer);
    const fp2 = generateAudioFingerprint(buffer);
    expect(fp1).toBe(fp2);
    expect(fp1).toContain('pt-v2-60s');
  });

  it('produces deterministic checksum for identical rhythm maps', () => {
    const buffer = createTestAudioBuffer(60, 44100, { beatBpm: 128 });
    const map1 = generateRhythmMapFromAudio(buffer, 'Track 1', 'standard');
    const map2 = generateRhythmMapFromAudio(buffer, 'Track 1', 'standard');

    expect(map1.integrityChecksum).toBe(map2.integrityChecksum);
    expect(map1.totalNotes).toBe(map2.totalNotes);
  });

  it('estimates tempo from periodic flux signal', () => {
    // Generate a 120 BPM periodic flux pattern (every 0.5s = 25 hops of 20ms)
    const hopDuration = 0.02;
    const totalFrames = 500;
    const flux = new Float32Array(totalFrames);
    const periodFrames = Math.round(0.5 / hopDuration); // 25 frames

    for (let f = 0; f < totalFrames; f += periodFrames) {
      flux[f] = 1.0;
    }

    const estimatedBpm = estimateTempoFromFlux(flux, hopDuration);
    expect(estimatedBpm).toBe(120);
  });

  it('assigns confidence scores and band types to generated notes', () => {
    const buffer = createTestAudioBuffer(60, 44100, { beatBpm: 120 });
    const map = generateRhythmMapFromAudio(buffer, 'Praise Anthem', 'standard');

    expect(map.notes.length).toBeGreaterThan(15);
    for (const note of map.notes) {
      expect(note.confidence).toBeDefined();
      expect(note.confidence).toBeGreaterThanOrEqual(0);
      expect(note.confidence).toBeLessThanOrEqual(1.0);
      expect(['low', 'high', 'full']).toContain(note.bandType);
    }
  });
});

// ===========================================================================
// 3. DIFFICULTY PROFILES & 3-STAR PROGRESSION
// ===========================================================================
describe('Difficulty Profiles & Density Constraints', () => {
  it('advanced profile produces higher or equal note density compared to beginner', () => {
    const buffer = createTestAudioBuffer(90, 44100, { beatBpm: 130 });
    const beginnerMap = generateRhythmMapFromAudio(buffer, 'Track', 'beginner');
    const advancedMap = generateRhythmMapFromAudio(buffer, 'Track', 'advanced');

    expect(advancedMap.totalNotes).toBeGreaterThanOrEqual(beginnerMap.totalNotes);
    expect(advancedMap.metrics.avgNotesPerSecond).toBeGreaterThanOrEqual(
      beginnerMap.metrics.avgNotesPerSecond
    );
  });

  it('beginner profile respects wider minimum intervals in Star 1', () => {
    const buffer = createTestAudioBuffer(90, 44100, { beatBpm: 140 });
    const beginnerMap = generateRhythmMapFromAudio(buffer, 'Track', 'beginner');

    const star1Notes = beginnerMap.notes.filter((n) => n.time < beginnerMap.stages.star1End);
    for (let i = 1; i < star1Notes.length; i++) {
      const interval = star1Notes[i].time - star1Notes[i - 1].time;
      // Should be >= beginner min interval (0.85s - small rounding tolerance)
      expect(interval).toBeGreaterThanOrEqual(0.80);
    }
  });

  it('preserves progressive 3-Star density (Star 3 >= Star 1)', () => {
    const buffer = createTestAudioBuffer(90, 44100, { beatBpm: 130 });
    const map = generateRhythmMapFromAudio(buffer, 'Progressive Praise', 'standard');

    const star1Notes = map.notes.filter((n) => n.time < map.stages.star1End);
    const star3Notes = map.notes.filter((n) => n.time >= map.stages.star2End);

    const star1Duration = map.stages.star1End;
    const star3Duration = map.duration - map.stages.star2End;

    const star1Density = star1Notes.length / star1Duration;
    const star3Density = star3Notes.length / star3Duration;

    expect(star3Density).toBeGreaterThanOrEqual(star1Density);
  });
});

// ===========================================================================
// 4. PLAYABILITY VALIDATION ENGINE
// ===========================================================================
describe('Playability Validation Suite', () => {
  it('accepts a valid generated RhythmMapV2', () => {
    const buffer = createTestAudioBuffer(60, 44100, { beatBpm: 120 });
    const map = generateRhythmMapFromAudio(buffer, 'Valid Track', 'standard');
    const report = validateRhythmMapPlayability(map);

    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.metrics.avgNotesPerSecond).toBeGreaterThan(0);
  });

  it('rejects a map with fewer than minimum total notes', () => {
    const sparseMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'fp-sparse',
      songTitle: 'Too Sparse',
      duration: 60,
      totalNotes: 5,
      notes: Array.from({ length: 5 }, (_, i) => ({
        id: `n-${i}`,
        lane: i % 4,
        time: 5 + i * 10,
        hit: false,
      })),
      stages: { star1End: 20, star2End: 40, star3End: 60 },
    };

    const report = validateRhythmMapPlayability(sparseMap);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('too few notes'))).toBe(true);
  });

  it('rejects unplayably fast note intervals (< 100ms)', () => {
    const burstMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'fp-burst',
      songTitle: 'Impossible Burst',
      duration: 60,
      totalNotes: 20,
      notes: Array.from({ length: 20 }, (_, i) => ({
        id: `n-${i}`,
        lane: i % 4,
        time: i === 5 ? 10.05 : 10.0 + i * 0.5, // 50ms interval between note 4 and 5
        hit: false,
      })).sort((a, b) => a.time - b.time),
      stages: { star1End: 20, star2End: 40, star3End: 60 },
    };

    const report = validateRhythmMapPlayability(burstMap);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Unplayable note interval'))).toBe(true);
  });

  it('rejects extreme lane imbalance (> 55% notes on a single lane)', () => {
    const imbalancedMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'fp-imbalanced',
      songTitle: 'Lane 0 Heavy',
      duration: 60,
      totalNotes: 20,
      // 16 out of 20 notes on lane 0 = 80%
      notes: Array.from({ length: 20 }, (_, i) => ({
        id: `n-${i}`,
        lane: i < 16 ? 0 : 1,
        time: 2.0 + i * 1.5,
        hit: false,
      })),
      stages: { star1End: 20, star2End: 40, star3End: 60 },
    };

    const report = validateRhythmMapPlayability(imbalancedMap);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Lane imbalance'))).toBe(true);
  });

  it('rejects notes with timestamps outside the song duration', () => {
    const outOfBoundsMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'fp-oob',
      songTitle: 'Out of Bounds',
      duration: 60,
      totalNotes: 20,
      notes: Array.from({ length: 20 }, (_, i) => ({
        id: `n-${i}`,
        lane: i % 4,
        time: i === 19 ? 75.0 : 2.0 + i * 2.0, // note 19 exceeds 60s duration
        hit: false,
      })),
      stages: { star1End: 20, star2End: 40, star3End: 60 },
    };

    const report = validateRhythmMapPlayability(outOfBoundsMap);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('exceeds map duration'))).toBe(true);
  });
});

// ===========================================================================
// 5. GAME ENGINE CALIBRATION & INPUT DEDUPLICATION
// ===========================================================================
describe('GameEngine Latency Calibration & Input Deduplication', () => {
  function createTestMap(duration: number = 30): RhythmMap {
    return {
      version: '2.0.0',
      audioFingerprint: 'fp-engine-test',
      songTitle: 'Engine Test',
      duration,
      totalNotes: 20,
      notes: Array.from({ length: 20 }, (_, i) => ({
        id: `n-${i}`,
        lane: i % 4,
        time: 2.0 + i * 1.0, // Every 1.0s starting at 2.0s
        hit: false,
        grade: null,
      })),
      stages: { star1End: 10, star2End: 20, star3End: 30 },
    };
  }

  it('supports configurable latency calibration offset', () => {
    const map = createTestMap();
    const engine = new GameEngine(map, 'piano', {
      onScoreUpdate: () => {},
      onNoteJudged: () => {},
      onRunFailed: () => {},
      onRunCompleted: () => {},
    });

    engine.setCalibrationOffset(0.050); // +50ms
    expect(engine.getCalibrationOffset()).toBe(0.050);

    // Clamps to ±150ms
    engine.setCalibrationOffset(0.300);
    expect(engine.getCalibrationOffset()).toBe(0.150);

    engine.setCalibrationOffset(-0.250);
    expect(engine.getCalibrationOffset()).toBe(-0.150);
  });

  it('correctly shifts hit judgement using calibration offset', () => {
    const map = createTestMap();
    let judgedGrade: string | null = null;

    const engine = new GameEngine(map, 'piano', {
      onScoreUpdate: () => {},
      onNoteJudged: (_id, grade) => { judgedGrade = grade; },
      onRunFailed: () => {},
      onRunCompleted: () => {},
    });

    engine.start();

    // Note 0 is at time 2.0s on lane 0.
    // If player taps at 2.040s with 0 calibration: diff = +40ms -> PERFECT (window is ±50ms)
    // If player taps at 2.070s with +30ms calibration: adjusted = 2.070 - 0.030 = 2.040s -> PERFECT!
    engine.setCalibrationOffset(0.030); // Compensate for 30ms latency
    engine.update(2.070);
    engine.handleLaneInput(0);

    expect(judgedGrade).toBe('PERFECT');
  });

  it('deduplicates rapid input events on the same lane (< 30ms)', () => {
    const map = createTestMap();
    let hitCount = 0;

    const engine = new GameEngine(map, 'piano', {
      onScoreUpdate: () => {},
      onNoteJudged: () => { hitCount++; },
      onRunFailed: () => {},
      onRunCompleted: () => {},
    });

    engine.start();
    engine.update(2.0); // Exactly on Note 0 (lane 0)

    // First tap registers
    engine.handleLaneInput(0);
    expect(hitCount).toBe(1);

    // Simulated double-event 5ms later (e.g. pointerdown + touchstart)
    engine.update(2.005);
    engine.handleLaneInput(0);

    // Should NOT trigger failure or second judgement
    expect(hitCount).toBe(1);
  });
});
