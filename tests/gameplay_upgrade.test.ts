/**
 * Comprehensive Test Suite for PraiseTiles Gameplay Experience, Engagement & Multiplayer Upgrade
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/lib/game/engine';
import {
  createInitialScoreState,
  applyHitToScoreState,
  applyMissToScoreState,
  applySustainCompletionToScoreState,
  applyEarlyReleaseToScoreState,
} from '@/lib/game/scoring';
import { mapCandidatesToNotes } from '@/lib/audio/analyzer';
import {
  getGhostScoreAtTime,
  GhostSnapshot,
} from '@/lib/game/ghost';
import {
  getDefaultChallenges,
  updateChallengesOnMatch,
  evaluateAchievements,
  checkDailyLoginStreak,
} from '@/lib/progression/challenges';
import { RhythmMap, Note, RunResult } from '@/types/game';

describe('1. Perfect Streak & Sustain Bonus Scoring Engine', () => {
  it('initializes with 0 current and max perfect streak', () => {
    const scoreState = createInitialScoreState();
    expect(scoreState.currentPerfectStreak).toBe(0);
    expect(scoreState.maxPerfectStreak).toBe(0);
    expect(scoreState.sustainBonusPoints).toBe(0);
    expect(scoreState.completedSustainsCount).toBe(0);
  });

  it('increments perfect streak on PERFECT hits', () => {
    let state = createInitialScoreState();
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(1);
    expect(state.maxPerfectStreak).toBe(1);

    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(2);
    expect(state.maxPerfectStreak).toBe(2);

    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(3);
    expect(state.maxPerfectStreak).toBe(3);
  });

  it('resets current perfect streak on GREAT or GOOD, but preserves max streak', () => {
    let state = createInitialScoreState();
    state = applyHitToScoreState(state, 'PERFECT');
    state = applyHitToScoreState(state, 'PERFECT');
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(3);
    expect(state.maxPerfectStreak).toBe(3);

    // Hit GREAT -> resets current streak to 0, max stays 3
    state = applyHitToScoreState(state, 'GREAT');
    expect(state.currentPerfectStreak).toBe(0);
    expect(state.maxPerfectStreak).toBe(3);

    // Hit PERFECT again -> starts climbing from 1
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(1);
    expect(state.maxPerfectStreak).toBe(3);
  });

  it('resets current perfect streak on MISS', () => {
    let state = createInitialScoreState();
    state = applyHitToScoreState(state, 'PERFECT');
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(2);

    state = applyMissToScoreState(state);
    expect(state.currentPerfectStreak).toBe(0);
    expect(state.maxPerfectStreak).toBe(2);
  });

  it('awards completion bonus points and increments count on sustain completion', () => {
    let state = createInitialScoreState();
    const initialScore = state.score;

    state = applySustainCompletionToScoreState(state);
    expect(state.score).toBe(initialScore + 100);
    expect(state.sustainBonusPoints).toBe(100);
    expect(state.completedSustainsCount).toBe(1);

    state = applySustainCompletionToScoreState(state);
    expect(state.score).toBe(initialScore + 200);
    expect(state.sustainBonusPoints).toBe(200);
    expect(state.completedSustainsCount).toBe(2);
  });

  it('resets perfect streak and awards no bonus on early release', () => {
    let state = createInitialScoreState();
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.currentPerfectStreak).toBe(1);

    state = applyEarlyReleaseToScoreState(state);
    expect(state.currentPerfectStreak).toBe(0);
    expect(state.sustainBonusPoints).toBe(0);
    expect(state.completedSustainsCount).toBe(0);
  });
});

describe('2. Engine Pause & Resume Controls', () => {
  const dummyMap: RhythmMap = {
    version: '1.0.0',
    audioFingerprint: 'test-fingerprint',
    songTitle: 'Test Song',
    duration: 10,
    totalNotes: 2,
    stages: { star1End: 3, star2End: 6, star3End: 10 },
    notes: [
      { id: 'n1', lane: 0, time: 2.0, hit: false, grade: null },
      { id: 'n2', lane: 1, time: 4.0, hit: false, grade: null },
    ],
  };

  it('pauses and resumes gameplay clock correctly', () => {
    const onScoreUpdate = vi.fn();
    const onNoteJudged = vi.fn();
    const onRunFailed = vi.fn();
    const onRunCompleted = vi.fn();

    const engine = new GameEngine(dummyMap, 'piano', {
      onScoreUpdate,
      onNoteJudged,
      onRunFailed,
      onRunCompleted,
    });

    engine.start();
    expect(engine.getIsPaused()).toBe(false);

    // Pause
    engine.pause();
    expect(engine.getIsPaused()).toBe(true);

    // Inputs are ignored while paused
    engine.handleDirectTileDown('n1', 0);
    expect(onNoteJudged).not.toHaveBeenCalled();

    // Frame update does not process misses while paused
    engine.update(3.0);
    expect(onNoteJudged).not.toHaveBeenCalled();

    // Resume
    engine.resume();
    expect(engine.getIsPaused()).toBe(false);

    engine.stop();
  });
});

describe('3. Dedicated Practice Mode (Zero Failure Termination)', () => {
  const dummyMap: RhythmMap = {
    version: '1.0.0',
    audioFingerprint: 'test-practice',
    songTitle: 'Practice Track',
    duration: 5,
    totalNotes: 2,
    stages: { star1End: 1.5, star2End: 3.5, star3End: 5 },
    notes: [
      { id: 'p1', lane: 0, time: 1.0, hit: false, grade: null },
      { id: 'p2', lane: 1, time: 2.0, hit: false, grade: null },
    ],
  };

  it('does not terminate the run when all notes are missed in Practice Mode', () => {
    const onScoreUpdate = vi.fn();
    const onNoteJudged = vi.fn();
    const onRunFailed = vi.fn();
    const onRunCompleted = vi.fn();

    const engine = new GameEngine(dummyMap, 'piano', {
      onScoreUpdate,
      onNoteJudged,
      onRunFailed,
      onRunCompleted,
    });

    engine.setPracticeMode(true);
    expect(engine.getIsPractice()).toBe(true);
    engine.start();

    // Advance past note 1 (missed)
    engine.update(1.5);
    expect(onNoteJudged).toHaveBeenCalledWith('p1', 'MISS', 0);
    expect(onRunFailed).not.toHaveBeenCalled(); // No failure!

    // Advance past note 2 (missed)
    engine.update(2.5);
    expect(onNoteJudged).toHaveBeenCalledWith('p2', 'MISS', 1);
    expect(onRunFailed).not.toHaveBeenCalled(); // Still no failure!

    // Song completes naturally
    engine.update(5.0);
    expect(onRunCompleted).toHaveBeenCalled();
    const result = onRunCompleted.mock.calls[0][0] as RunResult;
    expect(result.completed).toBe(true);
    expect(result.isPractice).toBe(true);

    engine.stop();
  });
});

describe('4. Song Analysis Engine: Energy Persistence & Long Tile Exclusivity', () => {
  it('generates sustained long notes when genuine acoustic persistence is detected', () => {
    const candidates = [
      { time: 1.0, confidence: 0.9, bandType: 'low' as const, sustainDurationSec: 1.2 },
      { time: 3.0, confidence: 0.8, bandType: 'high' as const },
    ];

    const notes = mapCandidatesToNotes(candidates, 10, 3, 6);
    expect(notes.length).toBeGreaterThanOrEqual(2);

    const firstNote = notes[0];
    expect(firstNote.type).toBe('long');
    expect(firstNote.duration).toBeGreaterThanOrEqual(0.6);
    expect(firstNote.duration).toBeLessThanOrEqual(1.8);
  });

  it('enforces long-tile mutual exclusivity: suppresses notes overlapping active sustain', () => {
    const candidates = [
      { time: 1.0, confidence: 0.9, bandType: 'low' as const, sustainDurationSec: 1.2 },
      { time: 1.5, confidence: 0.9, bandType: 'high' as const }, // Overlaps 1.0 + 1.2s sustain!
      { time: 2.8, confidence: 0.8, bandType: 'full' as const },
    ];

    const notes = mapCandidatesToNotes(candidates, 10, 3, 6);
    // Note at 1.5s MUST be suppressed because long tile at 1.0s is active until ~2.35s
    const overlapping = notes.find((n) => n.time === 1.5);
    expect(overlapping).toBeUndefined();
  });
});

describe('5. Ghost Challenge Replay Engine', () => {
  const snapshots: GhostSnapshot[] = [
    { time: 0, score: 0, combo: 0 },
    { time: 2, score: 200, combo: 2 },
    { time: 4, score: 600, combo: 4 },
    { time: 6, score: 1200, combo: 6 },
  ];

  it('interpolates ghost score accurately between timestamps', () => {
    expect(getGhostScoreAtTime(snapshots, 0)).toBe(0);
    expect(getGhostScoreAtTime(snapshots, 1)).toBe(100);
    expect(getGhostScoreAtTime(snapshots, 2)).toBe(200);
    expect(getGhostScoreAtTime(snapshots, 3)).toBe(400);
    expect(getGhostScoreAtTime(snapshots, 4)).toBe(600);
    expect(getGhostScoreAtTime(snapshots, 5)).toBe(900);
    expect(getGhostScoreAtTime(snapshots, 6)).toBe(1200);
    expect(getGhostScoreAtTime(snapshots, 10)).toBe(1200); // Clamped to max
  });
});

describe('6. Progression, Challenges & Login Streaks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default daily and weekly challenges', () => {
    const challenges = getDefaultChallenges();
    expect(challenges.length).toBe(5);
    expect(challenges.some((c) => c.period === 'daily')).toBe(true);
    expect(challenges.some((c) => c.period === 'weekly')).toBe(true);
  });

  it('updates challenge progress on match completion', () => {
    const mockResult: RunResult = {
      score: 50000,
      accuracy: 96.5,
      highestCombo: 60,
      highestPerfectStreak: 30,
      completedSustainsCount: 5,
      sustainBonusPoints: 1250,
      notesHit: 100,
      totalNotes: 100,
      completed: true,
      failureReason: null,
      elapsedTime: 90,
      songDuration: 90,
      instrument: 'piano',
      isPartial: false,
    };

    const { updatedChallenges, newlyCompleted } = updateChallengesOnMatch(mockResult);
    expect(updatedChallenges.length).toBe(5);

    // Should complete the daily high accuracy challenge (>=92%)
    const highAcc = updatedChallenges.find((c) => c.id === 'daily_high_acc');
    expect(highAcc?.completed).toBe(true);

    // Should complete the 50+ combo challenge
    const combo50 = updatedChallenges.find((c) => c.id === 'daily_combo_50');
    expect(combo50?.completed).toBe(true);

    expect(newlyCompleted.length).toBeGreaterThanOrEqual(2);
  });

  it('evaluates achievement badges properly', () => {
    const mockResult: RunResult = {
      score: 80000,
      accuracy: 95.0,
      highestCombo: 80,
      highestPerfectStreak: 30,
      perfectCount: 60,
      completedSustainsCount: 22,
      sustainBonusPoints: 5500,
      notesHit: 120,
      totalNotes: 120,
      completed: true,
      failureReason: null,
      elapsedTime: 120,
      songDuration: 120,
      instrument: 'piano',
      isPartial: false,
    };

    const unlocked = evaluateAchievements(mockResult, {
      totalSongsPlayed: 1,
      highestPerfectStreak: 30,
      totalSustainsCompleted: 22,
      playedPiano: true,
      playedGuitar: true,
    });

    expect(unlocked).toContain('first_performance');
    expect(unlocked).toContain('rhythm_keeper');
    expect(unlocked).toContain('perfect_touch');
    expect(unlocked).toContain('combo_master');
    expect(unlocked).toContain('instrument_explorer');
    expect(unlocked).toContain('sustain_master');
    expect(unlocked).toContain('perfect_streak');
  });

  it('calculates consecutive day login streak', () => {
    const streak = checkDailyLoginStreak();
    expect(streak.currentStreak).toBeGreaterThanOrEqual(1);
    expect(streak.todayRewardXp).toBe(50);
  });
});
