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

    it('correctly extracts ID from youtube shorts URL', () => {
      const url = 'https://www.youtube.com/shorts/KwX1f2gYKZ4';
      expect(extractYouTubeVideoId(url)).toBe('KwX1f2gYKZ4');
    });

    it('correctly extracts ID from youtube live URL', () => {
      const url = 'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
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

  describe('Audio Stream Proxy API (/api/music/proxy)', () => {
    it('rejects missing url parameter with 400', async () => {
      const { GET } = await import('@/app/api/music/proxy/route');
      const req = new Request('http://localhost:3000/api/music/proxy');
      const res = await GET(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/missing "url"/i);
    });

    it('rejects invalid or non-HTTP protocols with 400', async () => {
      const { GET } = await import('@/app/api/music/proxy/route');
      const req = new Request('http://localhost:3000/api/music/proxy?url=ftp://evil.com/audio.mp3');
      const res = await GET(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/protocol/i);
    });

    it('rejects internal IP addresses (SSRF guard) with 403', async () => {
      const { GET } = await import('@/app/api/music/proxy/route');
      const testCases = [
        'http://127.0.0.1:8080/audio.mp3',
        'http://localhost:3000/api/secret',
        'http://169.254.169.254/latest/meta-data',
        'http://192.168.1.1/stream.m4a',
        'http://10.0.0.1/audio.wav',
      ];

      for (const target of testCases) {
        const req = new Request(`http://localhost:3000/api/music/proxy?url=${encodeURIComponent(target)}`);
        const res = await GET(req as any);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toMatch(/restricted|internal/i);
      }
    });

    it('returns permissive CORS preflight headers on OPTIONS', async () => {
      const { OPTIONS } = await import('@/app/api/music/proxy/route');
      const res = await OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });

  describe('YouTube API Resolution (/api/music/youtube)', () => {
    it('returns success: true and track object for direct video ID or URL', async () => {
      const { GET } = await import('@/app/api/music/youtube/route');
      const req = new Request('http://localhost:3000/api/music/youtube?url=https://www.youtube.com/watch?v=KwX1f2gYKZ4');
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.videoId).toBe('KwX1f2gYKZ4');
      expect(json.title).toBeDefined();
      expect(json.author).toBeDefined();
      expect(json.thumbnailUrl).toContain('KwX1f2gYKZ4');
      expect(json.track).toBeDefined();
      expect(json.track.videoId).toBe('KwX1f2gYKZ4');
    });

    it('rejects empty query with 400', async () => {
      const { GET } = await import('@/app/api/music/youtube/route');
      const req = new Request('http://localhost:3000/api/music/youtube');
      const res = await GET(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/missing/i);
    });
  });
});
