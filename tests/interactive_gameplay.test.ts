import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameEngineCallbacks } from '../src/lib/game/engine';
import { RhythmMap } from '../src/types/game';
import { GAMEPLAY_CONFIG } from '../src/config/gameplay';
import { getDynamicApproachTime } from '../src/lib/game/scoring';
import { mapCandidatesToNotes } from '../src/lib/audio/analyzer';

describe('Interactive Rhythm Gameplay Upgrade', () => {
  function createCallbacks(): {
    callbacks: GameEngineCallbacks;
    failedMock: ReturnType<typeof vi.fn>;
    completedMock: ReturnType<typeof vi.fn>;
    scoreMock: ReturnType<typeof vi.fn>;
    noteJudgedMock: ReturnType<typeof vi.fn>;
  } {
    const failedMock = vi.fn();
    const completedMock = vi.fn();
    const scoreMock = vi.fn();
    const noteJudgedMock = vi.fn();

    return {
      callbacks: {
        onScoreUpdate: scoreMock,
        onNoteJudged: noteJudgedMock,
        onRunFailed: failedMock,
        onRunCompleted: completedMock,
      },
      failedMock,
      completedMock,
      scoreMock,
      noteJudgedMock,
    };
  }

  describe('Direct Pointer Interaction & Short Tiles', () => {
    const shortTileMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'test-fingerprint',
      songTitle: 'Short Tile Praise',
      duration: 30.0,
      totalNotes: 2,
      notes: [
        { id: 's-0', lane: 0, time: 2.0, hit: false, type: 'short' },
        { id: 's-1', lane: 1, time: 3.0, hit: false, type: 'short' },
      ],
      stages: { star1End: 10, star2End: 20, star3End: 30 },
    };

    it('registers short tile tap via handlePointerDown without keyboard key', () => {
      const { callbacks, failedMock, noteJudgedMock } = createCallbacks();
      const engine = new GameEngine(shortTileMap, 'piano', callbacks);
      engine.start();

      engine.update(2.01);
      engine.handlePointerDown(0);

      expect(failedMock).not.toHaveBeenCalled();
      expect(noteJudgedMock).toHaveBeenCalledWith('s-0', 'PERFECT', 0);

      const scoreState = engine.getScoreState();
      expect(scoreState.score).toBe(100);
      expect(scoreState.combo).toBe(1);

      // Releasing pointer on short tile ends interaction safely
      engine.handlePointerUp(0);
      expect(failedMock).not.toHaveBeenCalled();
    });

    it('supports sweeping / dragging across lanes with handlePointerMoveAcross', () => {
      const { callbacks, failedMock, noteJudgedMock } = createCallbacks();
      const engine = new GameEngine(shortTileMap, 'piano', callbacks);
      engine.start();

      // Pointer held down elsewhere and moves across lane 0
      engine.update(2.01);
      engine.handlePointerMoveAcross(0);

      expect(failedMock).not.toHaveBeenCalled();
      expect(noteJudgedMock).toHaveBeenCalledWith('s-0', 'PERFECT', 0);
      expect(engine.getScoreState().combo).toBe(1);
    });
  });

  describe('Long Sustain Tiles Mechanics & Scoring', () => {
    const longTileMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'test-fingerprint',
      songTitle: 'Sustained Chord Praise',
      duration: 30.0,
      totalNotes: 1,
      notes: [
        { id: 'l-0', lane: 2, time: 2.0, hit: false, type: 'long', duration: 1.0 },
      ],
      stages: { star1End: 10, star2End: 20, star3End: 30 },
    };

    it('awards base score on initial down, tick points while holding, and completion bonus on finish', () => {
      const { callbacks, failedMock, noteJudgedMock } = createCallbacks();
      const engine = new GameEngine(longTileMap, 'piano', callbacks);
      engine.start();

      // Initial press on lane 2 at 2.0s
      engine.update(2.0);
      engine.handlePointerDown(2);

      expect(failedMock).not.toHaveBeenCalled();
      expect(noteJudgedMock).toHaveBeenCalledWith('l-0', 'PERFECT', 2);
      // Base score is 100 for PERFECT
      expect(engine.getScoreState().score).toBe(100);

      // Hold and advance through time ticks (0.1s increments)
      engine.update(2.2);
      expect(engine.getScoreState().score).toBeGreaterThan(100);

      // Advance through full sustain duration (ends at 3.0s)
      engine.update(3.01);
      expect(failedMock).not.toHaveBeenCalled();

      // Completion bonus is awarded
      const finalScore = engine.getScoreState().score;
      // 100 base + (~10 ticks * 10 pts) + 100 completion bonus = ~300 pts
      expect(finalScore).toBeGreaterThanOrEqual(280);

      // Safely release pointer after sustain completed
      engine.handlePointerUp(2);
      expect(failedMock).not.toHaveBeenCalled();
    });

    it('detects early release, resets combo, and does not award completion bonus', () => {
      const { callbacks, failedMock } = createCallbacks();
      const engine = new GameEngine(longTileMap, 'piano', callbacks);
      engine.start();

      // Initial press at 2.0s
      engine.update(2.0);
      engine.handlePointerDown(2);
      expect(engine.getScoreState().combo).toBe(1);

      // Hold until 2.3s (premature: requires 3.0s)
      engine.update(2.3);
      const scoreBeforeRelease = engine.getScoreState().score;

      // Player releases early
      engine.handlePointerUp(2);

      // Early release resets combo to 0
      expect(engine.getScoreState().combo).toBe(0);

      // Advance time past 3.0s — no completion bonus should be awarded
      engine.update(3.1);
      expect(engine.getScoreState().score).toBe(scoreBeforeRelease);
    });
  });

  describe('Long-Tile Mutual Exclusivity in Rhythm Generation', () => {
    it('suppresses competing notes during active long sustain durations', () => {
      // 6 candidates: 1.0s, 2.0s (gap >= 0.9s -> long tile), 2.3s, 2.6s, 3.2s, 4.0s
      const candidates = [
        { time: 1.0, confidence: 0.9, bandType: 'low' as const },
        { time: 2.0, confidence: 0.85, bandType: 'low' as const },
        { time: 2.3, confidence: 0.8, bandType: 'full' as const },
        { time: 2.6, confidence: 0.8, bandType: 'full' as const },
        { time: 3.2, confidence: 0.85, bandType: 'high' as const },
        { time: 4.0, confidence: 0.9, bandType: 'full' as const },
      ];
      const notes = mapCandidatesToNotes(candidates, 5.0, 1.5, 3.5);

      const longNote = notes.find((n) => n.type === 'long');
      expect(longNote).toBeDefined();

      if (longNote && longNote.duration) {
        const sustainEnd = longNote.time + longNote.duration;
        // Verify no notes fall within the active sustain window
        const overlappingNotes = notes.filter(
          (n) => n.id !== longNote.id && n.time >= longNote.time && n.time < sustainEnd
        );
        expect(overlappingNotes.length).toBe(0);
      }
    });
  });

  describe('Dynamic Approach Speed Scaling', () => {
    it('progressively scales approach time across star stages without changing audio time', () => {
      const approachStar1 = getDynamicApproachTime(2.0, 30.0);
      const approachStar2 = getDynamicApproachTime(15.0, 30.0);
      const approachStar3 = getDynamicApproachTime(25.0, 30.0);

      expect(approachStar1).toBe(GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_1);
      expect(approachStar2).toBe(GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_2);
      expect(approachStar3).toBe(GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_3);

      // Star 3 approach time must be faster (smaller duration to cross screen) than Star 1
      expect(approachStar3).toBeLessThan(approachStar2);
      expect(approachStar2).toBeLessThan(approachStar1);
    });
  });

  describe('Piano & Guitar Instrument Parity', () => {
    const testMap: RhythmMap = {
      version: '2.0.0',
      audioFingerprint: 'parity-test',
      songTitle: 'Parity Test',
      duration: 30.0,
      totalNotes: 2,
      notes: [
        { id: 'p-0', lane: 1, time: 1.0, hit: false, type: 'short' },
        { id: 'p-1', lane: 3, time: 2.5, hit: false, type: 'long', duration: 0.8 },
      ],
      stages: { star1End: 10, star2End: 20, star3End: 30 },
    };

    it('executes identical scoring and sustain mechanics in guitar mode as piano mode', () => {
      const pianoCallbacks = createCallbacks();
      const guitarCallbacks = createCallbacks();

      const pianoEngine = new GameEngine(testMap, 'piano', pianoCallbacks.callbacks);
      const guitarEngine = new GameEngine(testMap, 'guitar', guitarCallbacks.callbacks);

      pianoEngine.start();
      guitarEngine.start();

      // Hit short note at 1.0s
      pianoEngine.update(1.0);
      pianoEngine.handlePointerDown(1);
      pianoEngine.handlePointerUp(1);

      guitarEngine.update(1.0);
      guitarEngine.handlePointerDown(1);
      guitarEngine.handlePointerUp(1);

      expect(pianoEngine.getScoreState().score).toBe(guitarEngine.getScoreState().score);

      // Hit long note at 2.5s
      pianoEngine.update(2.5);
      pianoEngine.handlePointerDown(3);

      guitarEngine.update(2.5);
      guitarEngine.handlePointerDown(3);

      pianoEngine.update(3.31);
      guitarEngine.update(3.31);

      pianoEngine.handlePointerUp(3);
      guitarEngine.handlePointerUp(3);

      expect(pianoEngine.getScoreState().score).toBe(guitarEngine.getScoreState().score);
      expect(pianoEngine.getScoreState().maxCombo).toBe(guitarEngine.getScoreState().maxCombo);
    });
  });
});
