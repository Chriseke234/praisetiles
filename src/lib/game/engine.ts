/**
 * Core 4-Lane Game Engine for PraiseTiles
 * Rule version: 2.0.0 (Interactive Rhythm Gameplay with Sustained Tiles & Dynamic Speed)
 * 
 * Manages the note timeline, short and long sustained hit judgements, direct pointer/touch interactions,
 * strict failure rules, dynamic approach speed, and game state.
 */

import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import {
  Note,
  RhythmMap,
  ScoreState,
  RunResult,
  HitGrade,
  FailureReason,
  InstrumentType,
  SustainState,
} from '@/types/game';
import {
  getTimingJudgement,
  createInitialScoreState,
  applyHitToScoreState,
  applyMissToScoreState,
  applySustainTickToScoreState,
  applySustainCompletionToScoreState,
  applyEarlyReleaseToScoreState,
  getDynamicApproachTime,
} from './scoring';

export interface GameEngineCallbacks {
  onScoreUpdate: (state: ScoreState) => void;
  onNoteJudged: (noteId: string, grade: HitGrade, lane: number) => void;
  onSustainProgress?: (noteId: string, progress: number, state: SustainState) => void;
  onRunFailed: (result: RunResult) => void;
  onRunCompleted: (result: RunResult) => void;
  onLaneTapEffect?: (lane: number) => void;
}

export class GameEngine {
  private map: RhythmMap;
  private instrument: InstrumentType;
  private notes: Note[] = [];
  private scoreState: ScoreState;
  private callbacks: GameEngineCallbacks;
  private isRunning: boolean = false;
  private isTerminated: boolean = false;
  private currentAudioTime: number = 0;
  private notesHitCount: number = 0;
  private calibrationOffsetSec: number = 0;
  private lastTapTimeByLane: number[] = [-1, -1, -1, -1];

  // Direct Interaction & Sustain State Tracking
  private laneHeld: boolean[] = [false, false, false, false];
  private activeSustainNote: Note | null = null;
  private sustainLastTickTime: number = 0;

  constructor(
    map: RhythmMap,
    instrument: InstrumentType,
    callbacks: GameEngineCallbacks
  ) {
    this.map = map;
    this.instrument = instrument;
    this.callbacks = callbacks;
    this.scoreState = createInitialScoreState();
    this.resetNotes();
  }

  /**
   * Resets note states for retry without regenerating the map or re-uploading audio.
   */
  public resetNotes(): void {
    this.notes = this.map.notes.map((n) => ({
      ...n,
      hit: false,
      grade: null,
      type: n.type ?? 'short',
      duration: n.duration,
      sustainProgress: n.type === 'long' ? 0 : undefined,
      sustainState: n.type === 'long' ? 'idle' : undefined,
    }));
    this.scoreState = createInitialScoreState();
    this.isRunning = false;
    this.isTerminated = false;
    this.currentAudioTime = 0;
    this.notesHitCount = 0;
    this.lastTapTimeByLane = [-1, -1, -1, -1];
    this.laneHeld = [false, false, false, false];
    this.activeSustainNote = null;
    this.sustainLastTickTime = 0;
    this.callbacks.onScoreUpdate(this.scoreState);
  }

  public setCalibrationOffset(offsetSec: number): void {
    // Bound calibration between -150ms and +150ms
    this.calibrationOffsetSec = Math.max(-0.150, Math.min(0.150, offsetSec));
  }

  public getCalibrationOffset(): number {
    return this.calibrationOffsetSec;
  }

  public start(): void {
    this.isRunning = true;
    this.isTerminated = false;
  }

  public stop(): void {
    this.isRunning = false;
  }

  public getNotes(): readonly Note[] {
    return this.notes;
  }

  public getScoreState(): ScoreState {
    return this.scoreState;
  }

  public getCurrentTime(): number {
    return this.currentAudioTime;
  }

  public getInstrument(): InstrumentType {
    return this.instrument;
  }

  public setInstrument(instrument: InstrumentType): void {
    this.instrument = instrument;
  }

  /**
   * Calculates the current dynamic approach time (speed) driven by song progression and tempo.
   */
  public getDynamicApproachTime(): number {
    const estimatedBpm = (this.map as any).metrics?.estimatedBpm ?? null;
    return getDynamicApproachTime(this.currentAudioTime, this.map.duration, estimatedBpm);
  }

  /**
   * Called every animation frame with current audio clock time in seconds.
   */
  public update(currentTime: number): void {
    if (!this.isRunning || this.isTerminated) return;

    this.currentAudioTime = currentTime;
    const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;

    // 1. Evaluate Active Sustained Note (Long Tile)
    if (this.activeSustainNote && this.activeSustainNote.sustainState === 'holding') {
      const note = this.activeSustainNote;
      const duration = note.duration ?? 0.8;
      const startTime = note.time;
      const endTime = startTime + duration;

      // Check if player is holding the required lane
      if (!this.laneHeld[note.lane]) {
        // Player released contact!
        // Check if released within early release tolerance (e.g. within 100ms of finish)
        if (currentTime >= endTime - GAMEPLAY_CONFIG.SUSTAIN.EARLY_RELEASE_TOLERANCE_SEC) {
          // Sustain successfully completed right at the threshold
          note.sustainState = 'completed';
          note.sustainProgress = 1.0;
          this.scoreState = applySustainCompletionToScoreState(this.scoreState);
          this.callbacks.onScoreUpdate(this.scoreState);
          this.callbacks.onSustainProgress?.(note.id, 1.0, 'completed');
          this.activeSustainNote = null;
        } else {
          // Early release penalty: combo resets, progress halts
          note.sustainState = 'released_early';
          this.scoreState = applyEarlyReleaseToScoreState(this.scoreState);
          this.callbacks.onScoreUpdate(this.scoreState);
          this.callbacks.onSustainProgress?.(note.id, note.sustainProgress ?? 0, 'released_early');
          this.activeSustainNote = null;
        }
      } else {
        // Still holding contact!
        const heldDuration = Math.max(0, currentTime - startTime);
        const progress = Math.min(1.0, heldDuration / duration);
        note.sustainProgress = progress;

        // Award sustain tick points every 100ms (accumulate over frame intervals)
        while (currentTime - this.sustainLastTickTime >= GAMEPLAY_CONFIG.SUSTAIN.TICK_INTERVAL_SECONDS) {
          this.scoreState = applySustainTickToScoreState(this.scoreState);
          this.callbacks.onScoreUpdate(this.scoreState);
          this.sustainLastTickTime += GAMEPLAY_CONFIG.SUSTAIN.TICK_INTERVAL_SECONDS;
        }

        this.callbacks.onSustainProgress?.(note.id, progress, 'holding');

        // Check for full sustain completion
        if (currentTime >= endTime) {
          note.sustainState = 'completed';
          note.sustainProgress = 1.0;
          this.scoreState = applySustainCompletionToScoreState(this.scoreState);
          this.callbacks.onScoreUpdate(this.scoreState);
          this.callbacks.onSustainProgress?.(note.id, 1.0, 'completed');
          this.activeSustainNote = null;
        }
      }
    }

    // 2. Check for Missed Notes (both short notes and unhit long notes)
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (!note.hit && note.time + goodWindow < currentTime) {
        note.hit = true;
        note.grade = 'MISS';
        if (note.type === 'long') {
          note.sustainState = 'released_early';
        }
        this.scoreState = applyMissToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onNoteJudged(note.id, 'MISS', note.lane);

        // 3-Strike Life System: Fail only if all shields are lost
        if ((this.scoreState.shieldsRemaining ?? 0) <= 0) {
          this.handleFailure('MISSED_NOTE');
          return;
        }
      }
    }

    // 3. Check for natural song completion
    if (currentTime >= this.map.duration) {
      this.handleCompletion();
    }
  }

  /**
   * Direct tile pointer-down: called when the player presses directly on a specific
   * falling tile (by note ID). This is the PRIMARY input path for Piano-Tiles-style
   * interaction.
   *
   * - Locates the note by ID (not by lane search), so only the touched tile can score.
   * - Validates the timing window the same way as lane input.
   * - Starts sustain tracking for long notes.
   * - Does NOT trigger INCORRECT_TAP — an empty-lane area tap simply has no tile and
   *   therefore never calls this method.
   */
  public handleDirectTileDown(noteId: string, lane: number): void {
    if (!this.isRunning || this.isTerminated) return;

    const now = this.currentAudioTime;

    // Deduplicate rapid pointer events within 30 ms on the same note
    const lastTap = this.lastTapTimeByLane[lane] ?? -1;
    if (now - lastTap < 0.030) return;
    this.lastTapTimeByLane[lane] = now;

    // Mark the lane as held (needed by sustain tracking in update())
    this.laneHeld[lane] = true;

    // Find the exact note by ID
    const note = this.notes.find((n) => n.id === noteId);
    if (!note || note.hit) return; // Already hit or not found — ignore

    const approachTime = this.getDynamicApproachTime();
    const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
    const adjustedTime = now - this.calibrationOffsetSec;
    const timeUntilHit = note.time - adjustedTime;

    // Determine judgement grade based on timing accuracy:
    const absDiff = Math.abs(timeUntilHit);
    let grade: HitGrade;
    if (absDiff <= GAMEPLAY_CONFIG.TIMING_WINDOWS.PERFECT_SEC) {
      grade = 'PERFECT';
    } else if (absDiff <= GAMEPLAY_CONFIG.TIMING_WINDOWS.GREAT_SEC) {
      grade = 'GREAT';
    } else if (absDiff <= GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC) {
      grade = 'GOOD';
    } else if (timeUntilHit > 0) {
      // Tapped while falling earlier on the screen (e.g. halfway down screen)
      // Award GREAT if in the lower half of approach, GOOD if higher up
      grade = timeUntilHit <= approachTime * 0.6 ? 'GREAT' : 'GOOD';
    } else {
      // Tapped near the bottom edge before leaving screen
      grade = 'GOOD';
    }

    note.hit = true;
    note.grade = grade;
    this.notesHitCount++;
    this.scoreState = applyHitToScoreState(this.scoreState, grade);
    this.callbacks.onScoreUpdate(this.scoreState);
    this.callbacks.onNoteJudged(note.id, grade, lane);

    if (this.callbacks.onLaneTapEffect) {
      this.callbacks.onLaneTapEffect(lane);
    }

    // Handle Long (Sustain) Tile initialization
    if (note.type === 'long' && note.duration) {
      note.sustainState = 'holding';
      note.sustainProgress = 0;
      this.activeSustainNote = note;
      this.sustainLastTickTime = now;
      this.callbacks.onSustainProgress?.(note.id, 0, 'holding');
    }

    // Check if this was the last note and audio is near end
    const remainingUnhit = this.notes.some((n) => !n.hit);
    if (!remainingUnhit && now >= this.map.duration - 0.5 && !this.activeSustainNote) {
      this.handleCompletion();
    }
  }

  /**
   * Direct tile pointer-up: called when the player releases a tile.
   * Ends sustain tracking for long notes by note ID.
   */
  public handleDirectTileUp(noteId: string, lane: number): void {
    this.laneHeld[lane] = false;

    // Only handle if this note is the active sustain
    if (
      this.activeSustainNote &&
      this.activeSustainNote.id === noteId &&
      this.activeSustainNote.sustainState === 'holding'
    ) {
      const note = this.activeSustainNote;
      const duration = note.duration ?? 0.8;
      const endTime = note.time + duration;

      if (this.currentAudioTime >= endTime - GAMEPLAY_CONFIG.SUSTAIN.EARLY_RELEASE_TOLERANCE_SEC) {
        // Released close enough to the end — count as full completion
        note.sustainState = 'completed';
        note.sustainProgress = 1.0;
        this.scoreState = applySustainCompletionToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onSustainProgress?.(note.id, 1.0, 'completed');
      } else {
        // Released early — apply penalty
        note.sustainState = 'released_early';
        this.scoreState = applyEarlyReleaseToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onSustainProgress?.(note.id, note.sustainProgress ?? 0, 'released_early');
      }
      this.activeSustainNote = null;
    }
  }

  /**
   * Pointer down on a lane: sets laneHeld and evaluates lane hit (supports fallback & unit tests).
   * Note: The primary in-game UI input path for Piano-Tiles gameplay is handleDirectTileDown.
   */
  public handlePointerDown(lane: number): void {
    if (!this.isRunning || this.isTerminated) return;
    this.laneHeld[lane] = true;
    this.handleLaneInput(lane, true);
  }

  /**
   * Continuous pointer move across lanes: sets laneHeld and evaluates tap on newly entered lane.
   */
  public handlePointerMoveAcross(lane: number): void {
    if (!this.isRunning || this.isTerminated) return;
    if (!this.laneHeld[lane]) {
      this.laneHeld[lane] = true;
      this.handleLaneInput(lane, true);
    }
  }

  /**
   * Pointer up on a lane (used for cancellation / sustain end when tile-based
   * release is not caught — e.g. pointer leaves the viewport).
   */
  public handlePointerUp(lane: number): void {
    this.laneHeld[lane] = false;

    // If an active sustain was running on this lane, handle release
    if (this.activeSustainNote && this.activeSustainNote.lane === lane && this.activeSustainNote.sustainState === 'holding') {
      const note = this.activeSustainNote;
      const duration = note.duration ?? 0.8;
      const endTime = note.time + duration;

      if (this.currentAudioTime >= endTime - GAMEPLAY_CONFIG.SUSTAIN.EARLY_RELEASE_TOLERANCE_SEC) {
        note.sustainState = 'completed';
        note.sustainProgress = 1.0;
        this.scoreState = applySustainCompletionToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onSustainProgress?.(note.id, 1.0, 'completed');
      } else {
        note.sustainState = 'released_early';
        this.scoreState = applyEarlyReleaseToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onSustainProgress?.(note.id, note.sustainProgress ?? 0, 'released_early');
      }
      this.activeSustainNote = null;
    }
  }

  /**
   * Releases all held lanes (e.g. on pointercancel or mouse leaving playfield).
   */
  public handlePointerCancel(): void {
    for (let l = 0; l < 4; l++) {
      if (this.laneHeld[l]) {
        this.handlePointerUp(l);
      }
    }
  }

  /**
   * Legacy lane-based input (kept for internal use and fallback only).
   * The primary gameplay path is now handleDirectTileDown/Up.
   * This method is no longer called from tile views — only internally.
   */
  public handleLaneInput(lane: number, isDirectContact: boolean = true): void {
    if (!this.isRunning || this.isTerminated) return;

    const now = this.currentAudioTime;

    // Deduplicate rapid touch/pointer events on the same lane within 30ms
    const lastTap = this.lastTapTimeByLane[lane] ?? -1;
    if (now - lastTap < 0.030) {
      return;
    }
    this.lastTapTimeByLane[lane] = now;

    if (this.callbacks.onLaneTapEffect) {
      this.callbacks.onLaneTapEffect(lane);
    }

    const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
    // Buffer window allows early lane taps within 500ms to register as hits rather than empty-lane penalties
    const earlyBufferSec = 0.500;
    // Apply user audio-visual calibration offset
    const adjustedTime = now - this.calibrationOffsetSec;

    // Find the earliest unhit note in this lane within valid hit window
    let candidateNote: Note | null = null;
    let minDiff = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.lane === lane && !note.hit) {
        const timeUntilHit = note.time - adjustedTime;
        if (Math.abs(timeUntilHit) <= goodWindow || (timeUntilHit > 0 && timeUntilHit <= earlyBufferSec)) {
          const absDiff = Math.abs(timeUntilHit);
          if (absDiff < minDiff) {
            minDiff = absDiff;
            candidateNote = note;
          }
        }
      }
    }

    if (candidateNote) {
      // Valid hit!
      const diff = adjustedTime - candidateNote.time;
      let grade = getTimingJudgement(diff);
      if (!grade && diff < 0 && Math.abs(diff) <= earlyBufferSec) {
        // Early tap caught in touch buffer
        grade = 'GOOD';
      }
      if (grade) {
        candidateNote.hit = true;
        candidateNote.grade = grade;
        this.notesHitCount++;
        this.scoreState = applyHitToScoreState(this.scoreState, grade);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onNoteJudged(candidateNote.id, grade, lane);

        // Handle Long (Sustain) Tile initialization
        if (candidateNote.type === 'long' && candidateNote.duration) {
          candidateNote.sustainState = 'holding';
          candidateNote.sustainProgress = 0;
          this.activeSustainNote = candidateNote;
          this.sustainLastTickTime = now;
          this.callbacks.onSustainProgress?.(candidateNote.id, 0, 'holding');
        }

        // Check if this was the last note and audio is near end
        const remainingUnhit = this.notes.some((n) => !n.hit);
        if (!remainingUnhit && now >= this.map.duration - 0.5 && !this.activeSustainNote) {
          this.handleCompletion();
        }
        return;
      }
    }

    // If an active sustain is being held on this lane, taps do not fail the run
    if (this.activeSustainNote && this.activeSustainNote.lane === lane && this.activeSustainNote.sustainState === 'holding') {
      return;
    }

    // Leniency: Empty lane tap breaks combo and consumes 1 shield (fails only on 0 shields)
    this.scoreState = applyMissToScoreState(this.scoreState);
    this.callbacks.onScoreUpdate(this.scoreState);
    if ((this.scoreState.shieldsRemaining ?? 0) <= 0) {
      this.handleFailure('INCORRECT_TAP');
    }
  }

  /**
   * Triggers run failure exactly once.
   */
  private handleFailure(reason: FailureReason): void {
    if (this.isTerminated) return;
    this.isTerminated = true;
    this.isRunning = false;

    const result: RunResult = {
      completed: false,
      failureReason: reason,
      score: this.scoreState.score,
      accuracy: this.scoreState.runAccuracy,
      highestCombo: this.scoreState.maxCombo,
      elapsedTime: Math.min(this.currentAudioTime, this.map.duration),
      songDuration: this.map.duration,
      totalNotes: this.map.totalNotes,
      notesHit: this.notesHitCount,
      instrument: this.instrument,
      isPartial: true,
      perfectCount: this.scoreState.perfectCount,
      greatCount: this.scoreState.greatCount,
      goodCount: this.scoreState.goodCount,
      missCount: this.scoreState.missCount,
    };

    this.callbacks.onRunFailed(result);
  }

  /**
   * Triggers run completion.
   */
  public handleCompletion(): void {
    if (this.isTerminated) return;
    this.isTerminated = true;
    this.isRunning = false;

    const result: RunResult = {
      completed: true,
      failureReason: null,
      score: this.scoreState.score,
      accuracy: this.scoreState.runAccuracy,
      highestCombo: this.scoreState.maxCombo,
      elapsedTime: this.map.duration,
      songDuration: this.map.duration,
      totalNotes: this.map.totalNotes,
      notesHit: this.notesHitCount,
      instrument: this.instrument,
      isPartial: false,
      perfectCount: this.scoreState.perfectCount,
      greatCount: this.scoreState.greatCount,
      goodCount: this.scoreState.goodCount,
      missCount: this.scoreState.missCount,
    };

    this.callbacks.onRunCompleted(result);
  }
}
