import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractYouTubeVideoId } from '@/app/api/music/youtube/route';
import { generateRhythmMapForDuration } from '@/lib/audio/analyzer';
import { YouTubeAudioPlayer } from '@/lib/audio/youtubePlayer';
import { PlayableAudioClock } from '@/types/game';

describe('Streaming Music Integration Engine', () => {
  describe('YouTube Video ID Extraction', () => {
    it('correctly extracts ID from standard youtube.com/watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=KwX1f2gYKZ4';
      expect(extractYouTubeVideoId(url)).toBe('KwX1f2gYKZ4');
    });

    it('correctly extracts ID from youtu.be short URL', () => {
      const url = 'https://youtu.be/n4XWfwLHeLM?t=15';
      expect(extractYouTubeVideoId(url)).toBe('n4XWfwLHeLM');
    });

    it('correctly extracts ID from music.youtube.com URL', () => {
      const url = 'https://music.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('correctly extracts ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/KwX1f2gYKZ4?autoplay=1';
      expect(extractYouTubeVideoId(url)).toBe('KwX1f2gYKZ4');
    });

    it('recognizes raw 11-character video ID', () => {
      expect(extractYouTubeVideoId('KwX1f2gYKZ4')).toBe('KwX1f2gYKZ4');
    });

    it('returns null for invalid inputs', () => {
      expect(extractYouTubeVideoId('not-a-youtube-url')).toBeNull();
      expect(extractYouTubeVideoId('')).toBeNull();
    });
  });

  describe('generateRhythmMapForDuration (Streaming & YouTube Map Engine)', () => {
    it('generates a valid 4-lane rhythm map matching the specified duration', () => {
      const map = generateRhythmMapForDuration('Graves Into Gardens', 120, 130);

      expect(map).toBeDefined();
      expect(map.version).toBe('2.0.0');
      expect(map.duration).toBe(120);
      expect(map.totalNotes).toBeGreaterThan(30);
      expect(map.notes.length).toBe(map.totalNotes);
      expect(map.stages.star1End).toBeCloseTo(120 * 0.33, 1);
      expect(map.stages.star2End).toBeCloseTo(120 * 0.66, 1);
      expect(map.stages.star3End).toBe(120);
    });

    it('assigns notes only to lanes 0, 1, 2, 3', () => {
      const map = generateRhythmMapForDuration('Way Maker', 90, 120);
      map.notes.forEach((note) => {
        expect([0, 1, 2, 3]).toContain(note.lane);
        expect(note.time).toBeGreaterThanOrEqual(0);
        expect(note.time).toBeLessThanOrEqual(90);
      });
    });

    it('generates both short and sustained long tiles', () => {
      const map = generateRhythmMapForDuration('Gratitude', 180, 100);
      const shortNotes = map.notes.filter((n) => n.type === 'short');
      const longNotes = map.notes.filter((n) => n.type === 'long');

      expect(shortNotes.length).toBeGreaterThan(0);
      expect(longNotes.length).toBeGreaterThan(0);
      longNotes.forEach((n) => {
        expect(n.duration).toBeGreaterThan(0);
        expect(n.sustainState).toBe('idle');
      });
    });

    it('clamps duration to valid boundaries [30s, 300s]', () => {
      const tooShort = generateRhythmMapForDuration('Short Track', 10);
      expect(tooShort.duration).toBe(30);

      const tooLong = generateRhythmMapForDuration('Long Symphony', 900);
      expect(tooLong.duration).toBe(300);
    });
  });

  describe('YouTubeAudioPlayer & PlayableAudioClock', () => {
    let player: YouTubeAudioPlayer;

    beforeEach(() => {
      player = new YouTubeAudioPlayer('KwX1f2gYKZ4');
    });

    afterEach(() => {
      player.destroy();
    });

    it('implements the PlayableAudioClock contract', () => {
      const clock: PlayableAudioClock = player;
      expect(typeof clock.play).toBe('function');
      expect(typeof clock.pause).toBe('function');
      expect(typeof clock.resume).toBe('function');
      expect(typeof clock.stop).toBe('function');
      expect(typeof clock.getCurrentTime).toBe('function');
      expect(typeof clock.getDuration).toBe('function');
      expect(typeof clock.setVolume).toBe('function');
    });

    it('clamps volume between 0.0 and 1.0', () => {
      player.setVolume(1.5);
      expect(player.getVolume()).toBe(1.0);

      player.setVolume(-0.5);
      expect(player.getVolume()).toBe(0.0);

      player.setVolume(0.65);
      expect(player.getVolume()).toBe(0.65);
    });

    it('reports current time correctly when idle and stopped', () => {
      expect(player.getCurrentTime()).toBe(0);
      expect(player.getIsPlaying()).toBe(false);

      player.stop();
      expect(player.getCurrentTime()).toBe(0);
      expect(player.getIsPlaying()).toBe(false);
    });
  });
});
