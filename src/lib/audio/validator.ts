/**
 * Audio file validator for PraiseTiles
 * Rule version: 1.0.0
 * 
 * Enforces strict GDD v1.0 upload rules:
 * - Max file size: 15 MB
 * - Min duration: 30 seconds
 * - Max duration: 5 minutes (300 seconds)
 * - Supported formats: MP3, WAV, decodable MP4/AAC
 * - Validates file magic bytes (not just extension)
 */

import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { AudioValidationResult } from '@/types/game';

/**
 * Checks binary header magic numbers to identify real audio container/format.
 */
export function inspectAudioHeader(buffer: Uint8Array): { format: string; valid: boolean } {
  if (buffer.length < 12) {
    return { format: 'UNKNOWN', valid: false };
  }

  // ID3v2 tag (MP3)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { format: 'MP3 (ID3v2)', valid: true };
  }

  // MP3 frame sync: 11 bits set (0xFF followed by 0xEx or 0xFx)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { format: 'MP3 (Frame)', valid: true };
  }

  // RIFF header for WAV (RIFF....WAVE)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45
  ) {
    return { format: 'WAV (RIFF)', valid: true };
  }

  // ISO Base Media File Format (MP4/M4A) contains 'ftyp' at offset 4
  if (
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    return { format: 'MP4/M4A (ftyp)', valid: true };
  }

  // Ogg container (OggS)
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return { format: 'OGG', valid: true };
  }

  return { format: 'UNKNOWN', valid: false };
}

/**
 * Validates audio file constraints (size, format headers, duration, and decodability).
 */
export async function validateAudioFile(
  file: File,
  audioContext?: AudioContext
): Promise<AudioValidationResult & { buffer?: AudioBuffer }> {
  const { MAX_FILE_SIZE_BYTES, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS } = GAMEPLAY_CONFIG.UPLOAD;

  // 1. File size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMb} MB). Maximum allowed size is 15 MB.`,
      fileSize: file.size,
    };
  }

  // 2. Read initial bytes for binary header verification
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return {
      valid: false,
      error: 'Failed to read file from disk. The file may be corrupt or inaccessible.',
    };
  }

  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 32));
  const headerCheck = inspectAudioHeader(headerBytes);

  if (!headerCheck.valid) {
    return {
      valid: false,
      error: `Unsupported file format. Please upload a valid MP3, WAV, or MP4 audio file.`,
      fileSize: file.size,
    };
  }

  // 3. Audio decoding & duration check if AudioContext is available
  if (audioContext) {
    try {
      // Clone array buffer for decodeAudioData (which detaches the buffer in some browsers)
      const clonedBuffer = arrayBuffer.slice(0);
      const decodedBuffer = await audioContext.decodeAudioData(clonedBuffer);
      const duration = decodedBuffer.duration;

      if (duration < MIN_DURATION_SECONDS) {
        return {
          valid: false,
          error: `Audio is too short (${Math.round(duration)}s). Minimum required duration is 30 seconds.`,
          duration,
          fileSize: file.size,
        };
      }

      if (duration > MAX_DURATION_SECONDS) {
        return {
          valid: false,
          error: `Audio is too long (${Math.round(duration / 60)}m ${Math.round(duration % 60)}s). Maximum duration is 5 minutes (300s).`,
          duration,
          fileSize: file.size,
        };
      }

      return {
        valid: true,
        duration,
        fileSize: file.size,
        mimeType: headerCheck.format,
        buffer: decodedBuffer,
      };
    } catch {
      return {
        valid: false,
        error: 'Browser audio decoder failed to decode this file. The audio data may be malformed.',
        fileSize: file.size,
      };
    }
  }

  return {
    valid: true,
    fileSize: file.size,
    mimeType: headerCheck.format,
  };
}
