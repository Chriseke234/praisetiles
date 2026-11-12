'use client';

/**
 * RoomGameContainer — Upgraded Multiplayer Gameplay Engine with
 * Live Leaderboard Status, #1 Leading Indicator, Non-Disruptive Elimination Spectating,
 * and Dynamic Gameplay Effects Overlay.
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
import { GameplayEffectsOverlay } from '@/components/gameplay/GameplayEffectsOverlay';
import { useRoom } from '@/lib/multiplayer/RoomContext';
import { Volume2, VolumeX, Star, Zap, Crown, Eye } from 'lucide-react';
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
  const [isEliminated, setIsEliminated]     = useState(false);

  const engineRef         = useRef<GameEngine | null>(null);
  const animFrameRef      = useRef<number | null>(null);
  const scoreTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesHitRef       = useRef(0);
  const totalEncRef       = useRef(0);
  const scoreStateRef     = useRef<ScoreState>(createInitialScoreState());
  const activeLanesTimeout = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Calculate live placement among active room players
  const higherOpponentsCount = opponents.filter(
    (o) => !o.isEliminated && o.score > scoreState.score
  ).length;
  const currentRank = 1 + higherOpponentsCount;
  const isLeading = currentRank === 1 && scoreState.score > 0;

  // -----------------------------------------------------------------------
  // Synchronized start: schedule AudioContext play at scheduledStartAt
  // -----------------------------------------------------------------------
  useEffect(() => {
    const startMs = new Date(scheduledStartAt).getTime();
    const nowMs   = Date.now();
    const delayMs = Math.max(0, startMs - nowMs);

    const tickDown = () => {
      const remaining = Math.max(0, new Date(scheduledStartAt).getTime() - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (remaining > 0) {
        requestAnimationFrame(tickDown);
      }
    };
    requestAnimationFrame(tickDown);

    const startTimeout = setTimeout(() => {
      audioPlayer.play(0).catch(console.error);
      setGameStarted(true);
      setCountdown(null);
    }, delayMs);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [scheduledStartAt, audioPlayer]);

  // -----------------------------------------------------------------------
  // Engine + rAF loop
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

        setIsEliminated(true);

        const elim: PlayerEliminatedPayload = {
          userId:        '',
          score:         result.score,
          accuracy:      result.accuracy,
          highestCombo:  result.highestCombo,
          failureReason: result.failureReason ?? 'unknown',
          eliminatedAt:  new Date().toISOString(),
        };
        broadcastEliminated(elim);

        // Non-blocking finalize
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

    const loop = () => {
      const t = audioPlayer.getCurrentTime();
      setCurrentAudioTime(t);
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
  }, [gameStarted, map, instrument, audioPlayer, broadcastScore, broadcastEliminated, finalizeMatch, matchId, onMatchFinished]);

  // Direct Tile Interaction Handlers
  const handleTilePointerDown = useCallback((noteId: string, lane: number) => {
    if (isEliminated) return;
    if (engineRef.current) {
      engineRef.current.handleDirectTileDown(noteId, lane);
    }
  }, [isEliminated]);

  const handleTilePointerUp = useCallback((noteId: string, lane: number) => {
    if (isEliminated) return;
    if (engineRef.current) {
      engineRef.current.handleDirectTileUp(noteId, lane);
    }
  }, [isEliminated]);

  const handleLanePointerDown = useCallback((lane: number) => {
    if (isEliminated) return;
    if (engineRef.current) {
      engineRef.current.handleLaneInput(lane);
    }
  }, [isEliminated]);

  const handlePointerLeaveArea = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.handlePointerCancel();
    }
  }, []);

  const currentStage = getCurrentStarStage(currentAudioTime, map.duration);

  const viewProps = {
    notes,
    currentTime: currentAudioTime,
    approachTime: engineRef.current?.getDynamicApproachTime(),
    activeLanes,
    reducedMotion,
    onTilePointerDown: handleTilePointerDown,
    onTilePointerUp: handleTilePointerUp,
    onLanePointerDown: handleLanePointerDown,
    onPointerLeaveArea: handlePointerLeaveArea,
  };

  return (
    <div className="relative w-full min-h-screen bg-[#090a0f] flex flex-col select-none overflow-hidden">
      {/* Live Opponent Status Bar */}
      <div className="relative z-20 w-full">
        <OpponentStatusBar opponents={opponents} />
      </div>

      {/* Dynamic Hit Effects, Combo Fire & Perfect Streak Overlay */}
      <GameplayEffectsOverlay
        latestJudgement={latestJudgement}
        combo={scoreState.combo}
        currentPerfectStreak={scoreState.currentPerfectStreak ?? 0}
        reducedMotion={reducedMotion}
      />

      {/* Realtime Competitor HUD */}
      <div className="absolute top-12 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 pointer-events-none">
        {/* Score & Rank */}
        <div className="bg-black/70 border border-gray-800 rounded-xl px-3 py-1.5 pointer-events-none flex items-center gap-2.5 backdrop-blur-md">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">Score</p>
            <p className="text-lg font-black text-white tabular-nums font-mono">
              {scoreState.score.toLocaleString()}
            </p>
          </div>
          {isLeading && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-300 text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.6)]">
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>#1 Leading</span>
            </div>
          )}
        </div>

        {/* Combo + Stars */}
        <div className="flex items-center gap-2">
          <div className="bg-black/70 border border-gray-800 rounded-xl px-3 py-1.5 text-center backdrop-blur-md">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">Combo</p>
            <p className="text-lg font-black text-amber-400 tabular-nums font-mono">x{scoreState.combo}</p>
          </div>
          <div className="bg-black/70 border border-gray-800 rounded-xl px-2 py-1.5 flex gap-0.5 backdrop-blur-md">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${s <= currentStage ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
              />
            ))}
          </div>
        </div>

        {/* Accuracy */}
        <div className="bg-black/70 border border-gray-800 rounded-xl px-3 py-1.5 pointer-events-none backdrop-blur-md">
          <p className="text-[9px] text-gray-400 uppercase tracking-widest">Acc</p>
          <p className="text-lg font-black text-cyan-400 tabular-nums font-mono">
            {scoreState.runAccuracy.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Synchronized Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <Zap className="w-10 h-10 text-amber-400 mx-auto mb-2 animate-bounce" />
            <p className="text-7xl font-black text-white tabular-nums font-mono">{countdown}</p>
            <p className="text-sm text-gray-400 mt-2 font-bold uppercase tracking-wider">Synchronized Match Start…</p>
          </div>
        </div>
      )}

      {/* Non-Disruptive Elimination Banner */}
      {isEliminated && (
        <div className="absolute top-28 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-white flex items-center gap-2 backdrop-blur-md shadow-2xl animate-pulse">
            <Eye className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black uppercase tracking-wider">
              Run Interrupted • Spectating Active Room Match
            </span>
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
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-black/70 border border-gray-800 rounded-xl px-3 py-1.5 backdrop-blur-md">
        <button
          onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
          aria-label={volume > 0 ? 'Mute' : 'Unmute'}
          className="text-gray-400 hover:text-amber-400 transition cursor-pointer"
        >
          {volume > 0 ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
        </button>
        <input
          type="range" min="0" max="1" step="0.05" value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Volume"
          className="w-16 h-1.5 bg-gray-700 rounded cursor-pointer accent-amber-500"
        />
      </div>
    </div>
  );
};
