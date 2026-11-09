import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameEngineCallbacks } from '../src/lib/game/engine';
import { RhythmMap, RunResult } from '../src/types/game';

describe('GameEngine & Strict Failure Mechanics', () => {
  const mockMap: RhythmMap = {
    version: '1.0.0',
    audioFingerprint: 'test-fingerprint',
    songTitle: 'Joyful Praise',
    duration: 30.0,
    totalNotes: 3,
    notes: [
      { id: 'n-0', lane: 0, time: 2.0, hit: false, grade: null },
      { id: 'n-1', lane: 1, time: 3.0, hit: false, grade: null },
      { id: 'n-2', lane: 2, time: 4.0, hit: false, grade: null },
    ],
    stages: { star1End: 10, star2End: 20, star3End: 30 },
  };

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

  it('awards PERFECT and advances combo on accurate tap', () => {
    const { callbacks, failedMock, noteJudgedMock } = createCallbacks();
    const engine = new GameEngine(mockMap, 'piano', callbacks);
    engine.start();

    // Advance clock to 2.01s (within 50ms of note 0 at 2.0s)
    engine.update(2.01);
    engine.handleLaneInput(0);

    expect(failedMock).not.toHaveBeenCalled();
    expect(noteJudgedMock).toHaveBeenCalledWith('n-0', 'PERFECT', 0);

    const scoreState = engine.getScoreState();
    expect(scoreState.score).toBe(100);
    expect(scoreState.combo).toBe(1);
    expect(scoreState.perfectCount).toBe(1);
    expect(scoreState.runAccuracy).toBe(100.0);
  });

  it('3-STRIKE FAILURE: 3 incorrect taps deplete shields and end run', () => {
    const { callbacks, failedMock } = createCallbacks();
    const engine = new GameEngine(mockMap, 'piano', callbacks);
    engine.start();

    // At 1.0s, user taps lane 0 (note is at 2.0s -> outside window)
    engine.update(1.0);
    engine.handleLaneInput(0);
    expect(failedMock).not.toHaveBeenCalled();
    expect(engine.getScoreState().shieldsRemaining).toBe(2);

    // Second incorrect tap (advance clock past 30ms debounce)
    engine.update(1.05);
    engine.handleLaneInput(0);
    expect(failedMock).not.toHaveBeenCalled();
    expect(engine.getScoreState().shieldsRemaining).toBe(1);

    // Third incorrect tap - shields depleted -> fails run
    engine.update(1.10);
    engine.handleLaneInput(0);
    expect(failedMock).toHaveBeenCalledTimes(1);
    const result: RunResult = failedMock.mock.calls[0][0];
    expect(result.completed).toBe(false);
    expect(result.failureReason).toBe('INCORRECT_TAP');
    expect(result.isPartial).toBe(true);
    expect(result.score).toBe(0);
  });

  it('3-STRIKE FAILURE: Missed notes deplete shields and end run when exhausted', () => {
    const { callbacks, failedMock, noteJudgedMock } = createCallbacks();
    const engine = new GameEngine(mockMap, 'guitar', callbacks);
    engine.start();

    // Note 0 is at 2.0s (lane 0). Clock advances past 2.36s (> 2.0 + 0.350s)
    engine.update(1.9);
    expect(failedMock).not.toHaveBeenCalled();

    engine.update(2.40); // Note 0 is missed! (Shields: 2)
    expect(failedMock).not.toHaveBeenCalled();
    expect(noteJudgedMock).toHaveBeenCalledWith('n-0', 'MISS', 0);
    expect(engine.getScoreState().shieldsRemaining).toBe(2);

    engine.update(3.40); // Note 1 is missed! (lane 1, Shields: 1)
    expect(failedMock).not.toHaveBeenCalled();
    expect(noteJudgedMock).toHaveBeenCalledWith('n-1', 'MISS', 1);
    expect(engine.getScoreState().shieldsRemaining).toBe(1);

    engine.update(4.40); // Note 2 is missed! (lane 2, Shields: 0) -> Failure
    expect(failedMock).toHaveBeenCalledTimes(1);
    expect(noteJudgedMock).toHaveBeenCalledWith('n-2', 'MISS', 2);

    const result: RunResult = failedMock.mock.calls[0][0];
    expect(result.completed).toBe(false);
    expect(result.failureReason).toBe('MISSED_NOTE');
    expect(result.instrument).toBe('guitar');
  });

  it('completes song run when all notes hit and duration is reached', () => {
    const { callbacks, completedMock, failedMock } = createCallbacks();
    const engine = new GameEngine(mockMap, 'piano', callbacks);
    engine.start();

    // Hit note 0 at 2.0s
    engine.update(2.0);
    engine.handleLaneInput(0);

    // Hit note 1 at 3.0s
    engine.update(3.0);
    engine.handleLaneInput(1);

    // Hit note 2 at 4.0s
    engine.update(4.0);
    engine.handleLaneInput(2);

    expect(failedMock).not.toHaveBeenCalled();

    // Advance clock to end of song
    engine.update(30.0);
    expect(completedMock).toHaveBeenCalledTimes(1);
    const result: RunResult = completedMock.mock.calls[0][0];
    expect(result.completed).toBe(true);
    expect(result.failureReason).toBeNull();
    expect(result.notesHit).toBe(3);
    expect(result.accuracy).toBe(100.0);
    expect(result.highestCombo).toBe(3);
  });

  it('retry resets score and notes without regenerating map', () => {
    const { callbacks, failedMock } = createCallbacks();
    const engine = new GameEngine(mockMap, 'piano', callbacks);
    engine.start();

    // Deplete all 3 shields
    engine.update(1.0);
    engine.handleLaneInput(3);
    engine.update(1.05);
    engine.handleLaneInput(3);
    engine.update(1.10);
    engine.handleLaneInput(3);
    expect(failedMock).toHaveBeenCalledTimes(1);

    // Reset for retry
    engine.resetNotes();
    expect(engine.getScoreState().score).toBe(0);
    expect(engine.getScoreState().combo).toBe(0);
    expect(engine.getScoreState().maxCombo).toBe(0);
    expect(engine.getScoreState().shieldsRemaining).toBe(3);
    expect(engine.getNotes().every((n) => !n.hit)).toBe(true);

    // Start new run and succeed
    engine.start();
    engine.update(2.0);
    engine.handleLaneInput(0);
    expect(engine.getScoreState().score).toBe(100);
  });

  it('both piano and guitar use exact same map timestamps and evaluation', () => {
    const cb1 = createCallbacks();
    const cb2 = createCallbacks();

    const pianoEngine = new GameEngine(mockMap, 'piano', cb1.callbacks);
    const guitarEngine = new GameEngine(mockMap, 'guitar', cb2.callbacks);

    pianoEngine.start();
    guitarEngine.start();

    pianoEngine.update(2.02);
    guitarEngine.update(2.02);

    pianoEngine.handleLaneInput(0);
    guitarEngine.handleLaneInput(0);

    expect(pianoEngine.getScoreState().score).toBe(guitarEngine.getScoreState().score);
    expect(pianoEngine.getScoreState().runAccuracy).toBe(guitarEngine.getScoreState().runAccuracy);
  });
});
