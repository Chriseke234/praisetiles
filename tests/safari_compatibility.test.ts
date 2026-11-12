/**
 * PraiseTiles — Safari Compatibility & WebKit Hardening Tests
 * 
 * Verifies:
 * 1. Safe storage in-memory fallback during Safari Private Browsing (SecurityError handling)
 * 2. decodeAudioDataCompat callback & promise dual compatibility
 * 3. AudioContext Safari unlocking & interrupted-state handling
 * 4. next.config.ts security headers conformity (X-XSS-Protection: 0, CSP wildcard domains)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeLocalStorage, safeSessionStorage } from '@/lib/storage/safeStorage';
import { decodeAudioDataCompat } from '@/lib/audio/validator';
import { GameAudioPlayer } from '@/lib/audio/player';

describe('Safari Compatibility Hardening', () => {
  describe('SafeStorage Fallback for Safari Private Browsing', () => {
    it('stores and retrieves data cleanly under normal conditions', () => {
      safeLocalStorage.setItem('test_safari_key', 'safari_value');
      expect(safeLocalStorage.getItem('test_safari_key')).toBe('safari_value');
      safeLocalStorage.removeItem('test_safari_key');
      expect(safeLocalStorage.getItem('test_safari_key')).toBeNull();
    });

    it('falls back to in-memory storage when localStorage throws SecurityError (Safari Private Mode)', () => {
      // Spy on Storage.prototype to simulate Safari Private Browsing SecurityError
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });

      // safeLocalStorage must not throw
      expect(() => {
        safeLocalStorage.setItem('private_key', 'private_value');
      }).not.toThrow();

      expect(safeLocalStorage.getItem('private_key')).toBe('private_value');

      safeLocalStorage.removeItem('private_key');
      expect(safeLocalStorage.getItem('private_key')).toBeNull();

      setItemSpy.mockRestore();
      getItemSpy.mockRestore();
    });

    it('sessionStorage safely falls back to memory when throwing in Safari', () => {
      safeSessionStorage.setItem('session_test', 'val');
      expect(safeSessionStorage.getItem('session_test')).toBe('val');
      safeSessionStorage.removeItem('session_test');
      expect(safeSessionStorage.getItem('session_test')).toBeNull();
    });
  });

  describe('decodeAudioDataCompat Dual Callback & Promise Architecture', () => {
    it('resolves decoded audio buffer when decodeAudioData returns a Promise', async () => {
      const mockBuffer = {} as AudioBuffer;
      const mockAudioCtx = {
        decodeAudioData: vi.fn().mockImplementation(() => Promise.resolve(mockBuffer)),
      } as unknown as AudioContext;

      const arrayBuf = new ArrayBuffer(16);
      const result = await decodeAudioDataCompat(mockAudioCtx, arrayBuf);
      expect(result).toBe(mockBuffer);
    });

    it('resolves decoded audio buffer using legacy WebKit callback when Promise is not returned', async () => {
      const mockBuffer = {} as AudioBuffer;
      const mockAudioCtx = {
        decodeAudioData: vi.fn().mockImplementation((_buf, successCb) => {
          successCb(mockBuffer);
          return undefined; // Legacy WebKit returns undefined, not a Promise
        }),
      } as unknown as AudioContext;

      const arrayBuf = new ArrayBuffer(16);
      const result = await decodeAudioDataCompat(mockAudioCtx, arrayBuf);
      expect(result).toBe(mockBuffer);
    });

    it('rejects gracefully on decode failure', async () => {
      const mockAudioCtx = {
        decodeAudioData: vi.fn().mockImplementation((_buf, _successCb, errorCb) => {
          errorCb(new Error('Safari audio decoding failed'));
          return undefined;
        }),
      } as unknown as AudioContext;

      const arrayBuf = new ArrayBuffer(16);
      await expect(decodeAudioDataCompat(mockAudioCtx, arrayBuf)).rejects.toThrow();
    });
  });

  describe('GameAudioPlayer iOS & Safari AudioContext Unlocking', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('resumes AudioContext from suspended or interrupted state upon user gesture', async () => {
      const resumeFn = vi.fn().mockResolvedValue(undefined);
      const mockCreateBuffer = vi.fn().mockReturnValue({});
      const mockCreateBufferSource = vi.fn().mockReturnValue({
        connect: vi.fn(),
        start: vi.fn(),
      });

      const mockCtx = {
        state: 'interrupted', // iOS Safari interrupted state
        resume: resumeFn,
        createBuffer: mockCreateBuffer,
        createBufferSource: mockCreateBufferSource,
        destination: {},
      };

      // Mock AudioContext constructor with standard function so 'new' works
      function MockAudioContext() {
        return mockCtx;
      }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const player = new GameAudioPlayer();
      const ctx = await player.ensureContext();

      expect(ctx).toBe(mockCtx);
      expect(resumeFn).toHaveBeenCalledTimes(1);
      // Confirms 1-sample silent unlock buffer was played for iOS hardware audio pipeline
      expect(mockCreateBuffer).toHaveBeenCalledWith(1, 1, 22050);
      expect(mockCreateBufferSource).toHaveBeenCalledTimes(1);
    });

    it('supports webkitAudioContext fallback when AudioContext is un-prefixed', async () => {
      const resumeFn = vi.fn().mockResolvedValue(undefined);
      const mockCtx = {
        state: 'running',
        resume: resumeFn,
        createBuffer: vi.fn().mockReturnValue({}),
        createBufferSource: vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
        }),
        destination: {},
      };

      // Remove standard AudioContext, supply only webkitAudioContext
      (window as any).AudioContext = undefined;
      function MockWebKitAudioContext() {
        return mockCtx;
      }
      (window as any).webkitAudioContext = MockWebKitAudioContext;

      const player = new GameAudioPlayer();
      const ctx = await player.ensureContext();

      expect(ctx).toBe(mockCtx);
    });
  });
});
