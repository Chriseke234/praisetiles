/**
 * Core 4-Lane Game Engine for PraiseTiles
 * Rule version: 1.0.0
 * 
 * Manages the note timeline, hit judgements, input events, strict failure rules,
 * and game state. Decoupled from React render frequency using high-resolution audio clock.
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
} from '@/types/game';
import {
  getTimingJudgement,
  createInitialScoreState,
  applyHitToScoreState,
  applyMissToScoreState,
} from './scoring';

export interface GameEngineCallbacks {
  onScoreUpdate: (state: ScoreState) => void;
  onNoteJudged: (noteId: string, grade: HitGrade, lane: number) => void;
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
    }));
    this.scoreState = createInitialScoreState();
    this.isRunning = false;
    this.isTerminated = false;
    this.currentAudioTime = 0;
    this.notesHitCount = 0;
    this.callbacks.onScoreUpdate(this.scoreState);
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
   * Called every animation frame with current audio clock time in seconds.
   */
  public update(currentTime: number): void {
    if (!this.isRunning || this.isTerminated) return;

    this.currentAudioTime = currentTime;

    // Check for missed notes
    // Any unhit note whose target time + Good window has passed is a Miss
    const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (!note.hit && note.time + goodWindow < currentTime) {
        // STRICT FAILURE RULE: One missed note immediately ends the player's run
        note.hit = true;
        note.grade = 'MISS';
        this.scoreState = applyMissToScoreState(this.scoreState);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onNoteJudged(note.id, 'MISS', note.lane);
        this.handleFailure('MISSED_NOTE');
        return;
      }
    }

    // Check for natural song completion
    if (currentTime >= this.map.duration) {
      this.handleCompletion();
    }
  }

  /**
   * Handles user tap/key press on a specific lane (0, 1, 2, or 3).
   * Strict failure rules:
   * - If an unhit note is in the valid timing window (±150ms), award grade (Perfect/Great/Good).
   * - If NO unhit note is in the valid timing window, INCORRECT TAP ends run immediately.
   */
  public handleLaneInput(lane: number): void {
    if (!this.isRunning || this.isTerminated) return;

    if (this.callbacks.onLaneTapEffect) {
      this.callbacks.onLaneTapEffect(lane);
    }

    const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
    const now = this.currentAudioTime;

    // Find the earliest unhit note in this lane within valid hit window
    let candidateNote: Note | null = null;
    let minDiff = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.lane === lane && !note.hit) {
        const diff = now - note.time;
        if (Math.abs(diff) <= goodWindow) {
          if (Math.abs(diff) < minDiff) {
            minDiff = Math.abs(diff);
            candidateNote = note;
          }
        }
      }
    }

    if (candidateNote) {
      // Valid hit!
      const diff = now - candidateNote.time;
      const grade = getTimingJudgement(diff);
      if (grade) {
        candidateNote.hit = true;
        candidateNote.grade = grade;
        this.notesHitCount++;
        this.scoreState = applyHitToScoreState(this.scoreState, grade);
        this.callbacks.onScoreUpdate(this.scoreState);
        this.callbacks.onNoteJudged(candidateNote.id, grade, lane);

        // Check if this was the last note and audio is near end
        const remainingUnhit = this.notes.some((n) => !n.hit);
        if (!remainingUnhit && now >= this.map.duration - 0.5) {
          this.handleCompletion();
        }
        return;
      }
    }

    // STRICT FAILURE RULE: Incorrect tap immediately ends the player's run!
    this.handleFailure('INCORRECT_TAP');
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
    };

    this.callbacks.onRunCompleted(result);
  }
}
