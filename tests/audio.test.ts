import { describe, it, expect } from 'vitest';
import { inspectAudioHeader, validateAudioFile } from '../src/lib/audio/validator';
import { generateRhythmMapFromAudio, generateAudioFingerprint } from '../src/lib/audio/analyzer';

describe('Audio Validation & Header Inspection', () => {
  it('correctly identifies ID3v2 MP3 headers', () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const res = inspectAudioHeader(bytes);
    expect(res.valid).toBe(true);
    expect(res.format).toContain('MP3');
  });

  it('correctly identifies WAV (RIFF...WAVE) headers', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // WAVE
    ]);
    const res = inspectAudioHeader(bytes);
    expect(res.valid).toBe(true);
    expect(res.format).toContain('WAV');
  });

  it('correctly identifies MP4 ftyp headers', () => {
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x4d, 0x34, 0x41, 0x20, // M4A
    ]);
    const res = inspectAudioHeader(bytes);
    expect(res.valid).toBe(true);
    expect(res.format).toContain('MP4');
  });

  it('rejects corrupt or unsupported headers', () => {
    const randomBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    const res = inspectAudioHeader(randomBytes);
    expect(res.valid).toBe(false);
  });

  it('rejects files exceeding the 15 MB threshold', async () => {
    const oversizeBytes = new Uint8Array(16 * 1024 * 1024); // 16 MB
    const file = new File([oversizeBytes], 'large_track.mp3', { type: 'audio/mpeg' });
    const res = await validateAudioFile(file);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('too large');
  });

  it('rejects files with invalid audio headers', async () => {
    const textBytes = new TextEncoder().encode('Hello world this is not an audio file');
    const file = new File([textBytes], 'fake.mp3', { type: 'audio/mpeg' });
    const res = await validateAudioFile(file);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unsupported file format');
  });
});

describe('Rhythm Map Generation & 3-Star Staging', () => {
  // Create mock AudioBuffer
  function createMockAudioBuffer(duration: number, sampleRate: number = 44100): AudioBuffer {
    const totalSamples = Math.floor(duration * sampleRate);
    const channelData = new Float32Array(totalSamples);

    // Simulate rhythmic beats every 0.5 seconds (120 BPM)
    const beatIntervalSamples = Math.floor(0.5 * sampleRate);
    for (let s = 0; s < totalSamples; s += beatIntervalSamples) {
      // Create a transient spike
      for (let k = 0; k < 200 && s + k < totalSamples; k++) {
        channelData[s + k] = 0.8 * Math.exp(-k / 20);
      }
    }

    return {
      duration,
      sampleRate,
      length: totalSamples,
      numberOfChannels: 1,
      getChannelData: () => channelData,
      copyFromChannel: () => {},
      copyToChannel: () => {},
    } as unknown as AudioBuffer;
  }

  it('generates consistent audio fingerprint', () => {
    const buffer1 = createMockAudioBuffer(60);
    const fp1 = generateAudioFingerprint(buffer1);
    const fp2 = generateAudioFingerprint(buffer1);
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/60s/);
  });

  it('produces valid 4-lane notes conforming to 3-Star progressive boundaries', () => {
    const buffer = createMockAudioBuffer(90);
    const map = generateRhythmMapFromAudio(buffer, 'Praise Anthem');

    expect(['1.0.0', '2.0.0']).toContain(map.version);
    expect(map.songTitle).toBe('Praise Anthem');
    expect(map.duration).toBe(90);
    expect(map.notes.length).toBeGreaterThan(10);

    // Star stage boundary checks
    expect(map.stages.star1End).toBeCloseTo(90 * 0.33, 1);
    expect(map.stages.star2End).toBeCloseTo(90 * 0.66, 1);
    expect(map.stages.star3End).toBe(90);

    // Verify all note properties
    for (const note of map.notes) {
      expect(note.lane).toBeGreaterThanOrEqual(0);
      expect(note.lane).toBeLessThanOrEqual(3);
      expect(note.time).toBeGreaterThanOrEqual(1.5);
      expect(note.time).toBeLessThanOrEqual(90);
      expect(note.hit).toBe(false);
    }

    // Verify progression: Star 3 note density should be higher than Star 1 note density
    const star1Notes = map.notes.filter((n) => n.time < map.stages.star1End);
    const star3Notes = map.notes.filter((n) => n.time >= map.stages.star2End);

    const star1Density = star1Notes.length / map.stages.star1End;
    const star3Density = star3Notes.length / (map.duration - map.stages.star2End);

    expect(star3Density).toBeGreaterThan(star1Density);
  });
});
