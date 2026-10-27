/**
 * Synthetic Gospel Praise Audio Generator
 * 
 * Provides an authorized, royalty-free praise backing track for instant play
 * and unit/integration testing without bundling copyrighted audio files.
 * Generates an upbeat 120 BPM 40-second praise progression:
 * I - V - vi - IV (C - G - Am - F) with kick, clap, and gospel keyboard chords.
 */

export function generateSyntheticGospelTrack(
  audioContext: AudioContext | OfflineAudioContext
): AudioBuffer {
  const sampleRate = audioContext.sampleRate || 44100;
  const duration = 40; // 40 seconds (meets 30s-300s constraint)
  const bpm = 120;
  const beatDuration = 60 / bpm; // 0.5s per beat
  const totalSamples = Math.floor(sampleRate * duration);

  const buffer = audioContext.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Chords frequencies:
  // C: C4 (261.63), E4 (329.63), G4 (392.00)
  // G: G3 (196.00), B3 (246.94), D4 (293.66)
  // Am: A3 (220.00), C4 (261.63), E4 (329.63)
  // F: F3 (174.61), A3 (220.00), C4 (261.63)
  const chords = [
    [261.63, 329.63, 392.0], // C
    [196.0, 246.94, 293.66], // G
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
  ];

  const totalBeats = Math.floor(duration / beatDuration);

  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * beatDuration;
    const beatSampleStart = Math.floor(beatTime * sampleRate);
    const measure = Math.floor(beat / 4);
    const chordIndex = measure % chords.length;
    const currentChord = chords[chordIndex];

    // 1. Kick on beat 0 and beat 2 of each 4-beat measure
    if (beat % 2 === 0) {
      const kickSamples = Math.floor(0.12 * sampleRate);
      for (let s = 0; s < kickSamples; s++) {
        const idx = beatSampleStart + s;
        if (idx >= totalSamples) break;
        const progress = s / kickSamples;
        const freq = 120 * Math.exp(-progress * 15);
        const amp = 0.5 * Math.exp(-progress * 10);
        const val = amp * Math.sin(2 * Math.PI * freq * (s / sampleRate));
        left[idx] += val;
        right[idx] += val;
      }
    }

    // 2. Clap / Snare transient on beat 1 and beat 3 (backbeat)
    if (beat % 2 === 1) {
      const clapSamples = Math.floor(0.15 * sampleRate);
      for (let s = 0; s < clapSamples; s++) {
        const idx = beatSampleStart + s;
        if (idx >= totalSamples) break;
        const progress = s / clapSamples;
        const noise = (Math.random() * 2 - 1) * 0.25;
        const tone = Math.sin(2 * Math.PI * 350 * (s / sampleRate)) * 0.15;
        const amp = Math.exp(-progress * 12);
        const val = (noise + tone) * amp;
        left[idx] += val;
        right[idx] += val;
      }
    }

    // 3. Gospel keyboard arpeggio (praise chords)
    const notePitch = currentChord[beat % 3];
    const keySamples = Math.floor(0.35 * sampleRate);
    for (let s = 0; s < keySamples; s++) {
      const idx = beatSampleStart + s;
      if (idx >= totalSamples) break;
      const progress = s / keySamples;
      const t = s / sampleRate;
      // Warm additive harmonics for Rhodes/organ feel
      const fundamental = Math.sin(2 * Math.PI * notePitch * t);
      const overtone = 0.3 * Math.sin(2 * Math.PI * notePitch * 2 * t);
      const sub = 0.2 * Math.sin(2 * Math.PI * (notePitch / 2) * t);
      const envelope = Math.exp(-progress * 4.5);
      const val = (fundamental + overtone + sub) * 0.25 * envelope;

      // Slight stereo spread
      left[idx] += val * 0.9;
      right[idx] += val * 1.1;
    }
  }

  // Normalize audio to avoid clipping
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  if (peak > 0.85) {
    const factor = 0.85 / peak;
    for (let i = 0; i < totalSamples; i++) {
      left[i] *= factor;
      right[i] *= factor;
    }
  }

  return buffer;
}

/**
 * Converts an AudioBuffer into a standard WAV file blob for testing and upload verification.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Interleave channels
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
