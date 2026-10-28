'use client';

/**
 * RoomGameContainer — Multiplayer wrapper around the existing GameEngine.
 *
 * Reuses Phase 1 GameEngine, GameAudioPlayer, PianoTilesView and GuitarTilesView
 * without modification. Adds:
 *  - Synchronized start via AudioContext scheduling
 *  - Periodic score broadcasting (~2s intervals)
 *  - Elimination broadcast on run failure
 *  - Opponent status bar
 *  - Match result submission via RoomContext.finalizeMatch
 *
 * Players who are eliminated continue to observe; others keep playing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RhythmMap,
  InstrumentType,
  RunResult,
  ScoreState,
  HitGrade,
  Note,
} from '@/types/game';
import { GameEngine } from '@/lib/game/engine';
import { GameAudioPlayer } from '@/lib/audio/player';
import { getCurrentStarStage, createInitialScoreState } from '@/lib/game/scoring';
import { PianoTilesView } from '@/components/gameplay/PianoTilesView';
import { GuitarTilesView } from '@/components/gameplay/GuitarTilesView';
import { OpponentStatusBar } from './OpponentStatusBar';
import { useRoom } from '@/lib/multiplayer/RoomContext';
import { Volume2, VolumeX, Star, Zap } from 'lucide-react';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';
import { PlayerEliminatedPayload } from '@/types/room';

interface RoomGameContainerProps {
  map:              RhythmMap;
  instrument:       InstrumentType;
  audioPlayer:      GameAudioPlayer;
  matchId:          string;
  scheduledStartAt: string; // ISO 8601
  volume:           number;
  onVolumeChange:   (vol: number) => void;
  reducedMotion:    boolean;
  onMatchFinished:  (result: RunResult) => void;
}

export const RoomGameContainer: React.FC<RoomGameContainerProps> = ({
  map,
  instrument,
  audioPlayer,
  matchId,
  scheduledStartAt,
  volume,
  onVolumeChange,
  reducedMotion,
  onMatchFinished,
}) => {
  const { opponents, broadcastScore, broadcastEliminated, finalizeMatch } = useRoom();

  const [countdown, setCountdown]           = useState<number | null>(null);
  const [scoreState, setScoreState]         = useState<ScoreState>(createInitialScoreState);
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0);
  const [notes, setNotes]                   = useState<readonly Note[]>(() =>
    map.notes.map((n) => ({ ...n, hit: false, grade: null }))
  );
  const [activeLanes, setActiveLanes]       = useState<boolean[]>([false, false, false, false]);
  const [latestJudgement, setLatestJudgement] = useState<{ grade: HitGrade; lane: number; key: number } | null>(null);
  const [gameStarted, setGameStarted]       = useState(false);

  const engineRef         = useRef<GameEngine | null>(null);
  const animFrameRef      = useRef<number | null>(null);
  const scoreTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesHitRef       = useRef(0);
  const totalEncRef       = useRef(0);
  const scoreStateRef     = useRef<ScoreState>(createInitialScoreState());
  const activeLanesTimeout = useRef<ReturnType<typeof setTimeout>[]>([]);

  // -----------------------------------------------------------------------
  // Synchronized start: schedule AudioContext play at scheduledStartAt
  // -----------------------------------------------------------------------
  useEffect(() => {
    const startMs = new Date(scheduledStartAt).getTime();
    const nowMs   = Date.now();
    const delayMs = Math.max(0, startMs - nowMs);

    // Show countdown (seconds remaining)
    const tickDown = () => {
      const remaining = Math.max(0, new Date(scheduledStartAt).getTime() - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (remaining > 0) {
        requestAnimationFrame(tickDown);
      }
    };
    requestAnimationFrame(tickDown);

    const startTimeout = setTimeout(() => {
      // Use Web Audio API clock for precision
      audioPlayer.play(0).catch(console.error);
      setGameStarted(true);
      setCountdown(null);
    }, delayMs);

    return () => {
      clearTimeout(startTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledStartAt]);

  // -----------------------------------------------------------------------
  // Engine + rAF loop — only start once audio has started
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!gameStarted) return;

    const timeouts = activeLanesTimeout.current;

    const engine = new GameEngine(map, instrument, {
      onScoreUpdate: (state) => {
        setScoreState(state);
        scoreStateRef.current = state;
      },
      onNoteJudged: (noteId, grade, lane) => {
        setLatestJudgement({ grade, lane, key: Date.now() });
        setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, hit: true, grade } : n));
        notesHitRef.current++;
      },
      onRunFailed: async (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);

        const elim: PlayerEliminatedPayload = {
          userId:        '',
          score:         result.score,
          accuracy:      result.accuracy,
          highestCombo:  result.highestCombo,
          failureReason: result.failureReason ?? 'unknown',
          eliminatedAt:  new Date().toISOString(),
        };
        broadcastEliminated(elim);

        // Non-blocking — player moves to observer mode
        finalizeMatch({
          matchId,
          score:          result.score,
          accuracy:       result.accuracy,
          highestCombo:   result.highestCombo,
          completed:      false,
          failureReason:  result.failureReason,
          notesHit:       result.notesHit,
          totalNotes:     result.totalNotes,
          elapsedTime:    result.elapsedTime,
        }).catch(console.error);

        onMatchFinished(result);
      },
      onRunCompleted: async (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);

        await finalizeMatch({
          matchId,
          score:         result.score,
          accuracy:      result.accuracy,
          highestCombo:  result.highestCombo,
          completed:     true,
          failureReason: null,
          notesHit:      result.notesHit,
          totalNotes:    result.totalNotes,
          elapsedTime:   result.elapsedTime,
        });

        onMatchFinished(result);
      },
      onLaneTapEffect: (lane) => {
        setActiveLanes((prev) => {
          const next = [...prev];
          next[lane] = true;
          return next;
        });
        const t = setTimeout(() => {
          setActiveLanes((prev) => {
            const next = [...prev];
            next[lane] = false;
            return next;
          });
        }, 120);
        activeLanesTimeout.current.push(t);
      },
    });

    engineRef.current = engine;
    engine.start();

    // rAF loop — totalEncountered approximated from scoreState
    const loop = () => {
      const t = audioPlayer.getCurrentTime();
      setCurrentAudioTime(t);
      // Phase 1 engine does not expose getTotalEncountered; use scoreState tally
      const s = scoreStateRef.current;
      totalEncRef.current = s.perfectCount + s.greatCount + s.goodCount + s.missCount;
      engine.update(t);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    // Score broadcast interval (~2s)
    scoreTimerRef.current = setInterval(() => {
      broadcastScore(scoreStateRef.current, notesHitRef.current, totalEncRef.current);
    }, MULTIPLAYER_CONFIG.MATCH.SCORE_BROADCAST_INTERVAL_MS);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
      timeouts.forEach(clearTimeout);
      engine.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);

  // -----------------------------------------------------------------------
  // Keyboard controls
  // -----------------------------------------------------------------------
  const handleLaneTap = useCallback((lane: number) => {
    if (engineRef.current) {
      engineRef.current.handleLaneInput(lane);
    }
  }, []);

  useEffect(() => {
    const KEYS: Record<string, number> = { d: 0, f: 1, j: 2, k: 3 };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = KEYS[e.key.toLowerCase()];
      if (lane !== undefined) handleLaneTap(lane);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLaneTap]);

  const currentStage = getCurrentStarStage(currentAudioTime, map.duration);

  const viewProps = {
    notes,
    currentTime: currentAudioTime,
    activeLanes,
    latestJudgement,
    reducedMotion,
    onLaneTap: handleLaneTap,
  };

  return (
    <div className="relative w-full min-h-screen bg-[#090a0f] flex flex-col">
      {/* Opponent bar */}
      <div className="relative z-20 w-full">
        <OpponentStatusBar opponents={opponents} />
      </div>

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 pointer-events-none">
        {/* Score */}
        <div className="bg-black/60 border border-gray-800 rounded-xl px-3 py-1.5 pointer-events-none">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Score</p>
          <p className="text-lg font-black text-white tabular-nums">
            {scoreState.score.toLocaleString()}
          </p>
        </div>

        {/* Combo + Stars */}
        <div className="flex items-center gap-2">
          <div className="bg-black/60 border border-gray-800 rounded-xl px-3 py-1.5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Combo</p>
            <p className="text-lg font-black text-amber-400 tabular-nums">x{scoreState.combo}</p>
          </div>
          <div className="bg-black/60 border border-gray-800 rounded-xl px-2 py-1.5 flex gap-0.5">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${s <= currentStage ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
              />
            ))}
          </div>
        </div>

        {/* Accuracy */}
        <div className="bg-black/60 border border-gray-800 rounded-xl px-3 py-1.5 pointer-events-none">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Acc</p>
          <p className="text-lg font-black text-cyan-400 tabular-nums">
            {scoreState.runAccuracy.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <Zap className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-7xl font-black text-white tabular-nums">{countdown}</p>
            <p className="text-sm text-gray-400 mt-2">Synchronized start…</p>
          </div>
        </div>
      )}

      {/* Gameplay view */}
      <div className="flex-1 relative">
        {instrument === 'piano' ? (
          <PianoTilesView {...viewProps} />
        ) : (
          <GuitarTilesView {...viewProps} />
        )}
      </div>

      {/* Volume control */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-black/60 border border-gray-800 rounded-xl px-3 py-1.5">
        <button
          onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
          aria-label={volume > 0 ? 'Mute' : 'Unmute'}
          className="text-gray-400 hover:text-amber-400 transition"
        >
          {volume > 0 ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
        </button>
        <input
          type="range" min="0" max="1" step="0.05" value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Volume"
          className="w-16 h-1.5 bg-gray-700 rounded"
        />
      </div>
    </div>
  );
};
