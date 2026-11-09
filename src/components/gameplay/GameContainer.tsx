'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { createInitialScoreState } from '@/lib/game/scoring';
import { PianoTilesView } from './PianoTilesView';
import { GuitarTilesView } from './GuitarTilesView';
import { MilestoneProgressBar } from './MilestoneProgressBar';
import { AtmosphericBackground } from './AtmosphericBackground';
import { Volume2, VolumeX, ArrowLeft, Sliders, RotateCcw, Award, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useKeyBindings } from '@/hooks/useKeyBindings';

interface GameContainerProps {
  map: RhythmMap;
  instrument: InstrumentType;
  audioPlayer: GameAudioPlayer;
  volume: number;
  onVolumeChange: (vol: number) => void;
  reducedMotion: boolean;
  onRunFinished: (result: RunResult) => void;
  onExit: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({
  map,
  instrument,
  audioPlayer,
  volume,
  onVolumeChange,
  reducedMotion,
  onRunFinished,
  onExit,
}) => {
  const { stats } = useAuth();
  const [isWaitingForStart, setIsWaitingForStart] = useState(true);
  const [failedResult, setFailedResult] = useState<RunResult | null>(null);
  const [scoreState, setScoreState] = useState<ScoreState>(createInitialScoreState);
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0);
  const [notes, setNotes] = useState<readonly Note[]>(() =>
    map.notes.map((n) => ({ ...n, hit: false, grade: null }))
  );
  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);
  const [latestJudgement, setLatestJudgement] = useState<{
    grade: HitGrade;
    lane: number;
    key: number;
  } | null>(null);
  const [calibrationMs, setCalibrationMs] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('praisetiles_calibration_ms');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    }
    return 0;
  });
  const [showCalibration, setShowCalibration] = useState(false);
  const { keyToLane, keys: keyBindings } = useKeyBindings();
  const heldKeysRef = useRef<Set<string>>(new Set());

  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeLanesTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const judgementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialCalibrationRef = useRef<number>(calibrationMs);

  // Update calibration offset on active engine dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCalibrationOffset(calibrationMs / 1000);
    }
  }, [calibrationMs]);

  // Instantiate engine
  const initEngine = useCallback(() => {
    const timeouts = activeLanesTimeoutRef.current;
    const engine = new GameEngine(map, instrument, {
      onScoreUpdate: (state) => setScoreState(state),
      onNoteJudged: (noteId, grade, lane) => {
        setLatestJudgement({ grade, lane, key: Date.now() });
        if (judgementTimeoutRef.current) clearTimeout(judgementTimeoutRef.current);
        judgementTimeoutRef.current = setTimeout(() => {
          setLatestJudgement(null);
        }, 600);

        setNotes((prevNotes) =>
          prevNotes.map((n) =>
            n.id === noteId ? { ...n, hit: true, grade, hitTimestamp: Date.now() } as Note : n
          )
        );
      },
      onRunFailed: (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setFailedResult(result);
      },
      onRunCompleted: (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        onRunFinished(result);
      },
      onLaneTapEffect: (lane) => {
        setActiveLanes((prev) => {
          const next = [...prev];
          next[lane] = true;
          return next;
        });
        const timeout = setTimeout(() => {
          setActiveLanes((prev) => {
            const next = [...prev];
            next[lane] = false;
            return next;
          });
        }, 120);
        timeouts.push(timeout);
      },
    });

    engine.setCalibrationOffset(initialCalibrationRef.current / 1000);
    engineRef.current = engine;
    return engine;
  }, [map, instrument, audioPlayer, onRunFinished]);

  useEffect(() => {
    const engine = initEngine();
    const timeouts = activeLanesTimeoutRef.current;

    return () => {
      engine.stop();
      audioPlayer.stop();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (judgementTimeoutRef.current) clearTimeout(judgementTimeoutRef.current);
      timeouts.forEach(clearTimeout);
    };
  }, [initEngine, audioPlayer]);

  // Start match kickoff smoothly on user action without consuming song notes
  const handleStartGame = useCallback(async () => {
    if (!isWaitingForStart) return;
    setIsWaitingForStart(false);

    if (engineRef.current) {
      // Warm up audio context first so start is instantaneous without clock freeze
      await audioPlayer.ensureContext();
      engineRef.current.start();
      await audioPlayer.play(0, () => {
        engineRef.current?.handleCompletion();
      });
    }
  }, [isWaitingForStart, audioPlayer]);

  // Restart song cleanly from in-lane fail state
  const handleRestart = useCallback(() => {
    setFailedResult(null);
    setIsWaitingForStart(true);
    setScoreState(createInitialScoreState());
    setCurrentAudioTime(0);
    setNotes(map.notes.map((n) => ({ ...n, hit: false, grade: null })));
    setLatestJudgement(null);
    initEngine();
  }, [map, initEngine]);

  // Direct Tile Interaction Handlers (Piano Tiles style)
  const handleTilePointerDown = useCallback((noteId: string, lane: number) => {
    if (isWaitingForStart) {
      handleStartGame();
      return;
    }
    if (engineRef.current) {
      engineRef.current.handleDirectTileDown(noteId, lane);
    }
  }, [isWaitingForStart, handleStartGame]);

  const handleTilePointerUp = useCallback((noteId: string, lane: number) => {
    if (engineRef.current) {
      engineRef.current.handleDirectTileUp(noteId, lane);
    }
  }, []);

  const handleLanePointerDown = useCallback((lane: number) => {
    if (isWaitingForStart) {
      handleStartGame();
      return;
    }
    if (engineRef.current) {
      engineRef.current.handleLaneInput(lane);
    }
  }, [isWaitingForStart, handleStartGame]);

  // Desktop Keyboard Event Listeners (D, F, J, K + Space to Start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (isWaitingForStart) {
        if (e.code === 'Space' || e.code === 'Enter' || keyToLane(e.key) >= 0) {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      const lane = keyToLane(e.key);
      if (lane >= 0) {
        e.preventDefault();
        const lowerKey = e.key.toLowerCase();
        if (!heldKeysRef.current.has(lowerKey)) {
          heldKeysRef.current.add(lowerKey);
          handleLanePointerDown(lane);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const lane = keyToLane(e.key);
      if (lane >= 0) {
        heldKeysRef.current.delete(e.key.toLowerCase());
        if (engineRef.current) {
          engineRef.current.handlePointerUp(lane);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isWaitingForStart, handleStartGame, keyToLane, handleLanePointerDown]);

  const handlePointerLeaveArea = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.handlePointerCancel();
    }
  }, []);

  // Main high-precision animation loop
  useEffect(() => {
    const loop = () => {
      if (engineRef.current && !isWaitingForStart && !failedResult) {
        const time = audioPlayer.getCurrentTime();
        setCurrentAudioTime(time);
        engineRef.current.update(time);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioPlayer, isWaitingForStart, failedResult]);

  // Track milestone progress percentage (0 - 100%)
  const progressPercent = map.duration > 0 ? (currentAudioTime / map.duration) * 100 : 0;

  return (
    <div className="relative w-full h-screen flex flex-col justify-between bg-[#080414] text-white overflow-hidden select-none">
      {/* Deep Purple Ethereal Atmosphere & Water Piano Silhouette */}
      <AtmosphericBackground />

      {/* Top Floating HUD: Controls, Milestone Bar & Centered Large Score */}
      <header className="relative z-30 w-full max-w-lg mx-auto pt-3 px-4 flex flex-col items-center">
        {/* Utility Controls Row */}
        <div className="w-full flex items-center justify-between">
          <button
            onClick={onExit}
            aria-label="Exit Game"
            className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/20 text-gray-300 hover:text-white hover:border-amber-400/50 transition backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalibration((prev) => !prev)}
              aria-label="Latency Calibration"
              title={`Calibration: ${calibrationMs >= 0 ? '+' : ''}${calibrationMs}ms`}
              className={`p-2 rounded-xl border backdrop-blur-sm transition ${
                calibrationMs !== 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-purple-950/60 border-purple-500/20 text-gray-300 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
              aria-label={volume > 0 ? 'Mute Audio' : 'Unmute Audio'}
              className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/20 text-gray-300 hover:text-white hover:border-amber-400/50 transition backdrop-blur-sm"
            >
              {volume > 0 ? (
                <Volume2 className="w-4 h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
          </div>
        </div>

        {/* Milestone Progress Bar (3 Stars + 3 Crowns) */}
        <div className="w-full mt-1">
          <MilestoneProgressBar
            progressPercent={progressPercent}
            score={scoreState.score}
          />
        </div>

        {/* Large Prominent Centered Score Typography */}
        <div className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] mt-1">
          {scoreState.score.toLocaleString()}
        </div>

        {/* 3 Shields / Lives Indicator */}
        <div className="flex items-center gap-1.5 mt-1">
          {[1, 2, 3].map((num) => {
            const hasShield = (scoreState.shieldsRemaining ?? 3) >= num;
            return (
              <div
                key={num}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  hasShield
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                    : 'bg-gray-800/40 text-gray-600 border border-gray-700/40 scale-90'
                }`}
                title={`Shield ${num}`}
              >
                <Shield className="w-3.5 h-3.5 fill-current" />
              </div>
            );
          })}
        </div>
      </header>

      {/* Latency Calibration Popup */}
      {showCalibration && (
        <div className="absolute top-16 right-4 z-50 p-4 rounded-2xl bg-[#110726]/95 border border-purple-500/40 shadow-2xl backdrop-blur-md w-64 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Calibration</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {calibrationMs >= 0 ? `+${calibrationMs}` : calibrationMs} ms
            </span>
          </div>
          <p className="text-[10px] text-gray-300">
            Adjust timing offset for Bluetooth audio or display delay.
          </p>
          <input
            type="range"
            min={-150}
            max={150}
            step={5}
            value={calibrationMs}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setCalibrationMs(val);
              if (engineRef.current) engineRef.current.setCalibrationOffset(val / 1000);
              if (typeof window !== 'undefined') localStorage.setItem('praisetiles_calibration_ms', val.toString());
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>-150ms</span>
            <span>+150ms</span>
          </div>
        </div>
      )}

      {/* Main 4-Lane Arena Container */}
      <main className="relative flex-1 w-full max-w-lg mx-auto overflow-hidden">
        {instrument === 'piano' ? (
          <PianoTilesView
            notes={notes}
            currentTime={currentAudioTime}
            approachTime={engineRef.current?.getDynamicApproachTime()}
            activeLanes={activeLanes}
            keyBindings={keyBindings}
            onTilePointerDown={handleTilePointerDown}
            onTilePointerUp={handleTilePointerUp}
            onLanePointerDown={handleLanePointerDown}
            onPointerLeaveArea={handlePointerLeaveArea}
            reducedMotion={reducedMotion}
            isWaitingForStart={isWaitingForStart}
            onStartGame={handleStartGame}
            songTitle={map.songTitle}
            artist="Praise & Worship"
            highScore={stats?.bestScore ?? 0}
          />
        ) : (
          <GuitarTilesView
            notes={notes}
            currentTime={currentAudioTime}
            approachTime={engineRef.current?.getDynamicApproachTime()}
            activeLanes={activeLanes}
            keyBindings={keyBindings}
            onTilePointerDown={handleTilePointerDown}
            onTilePointerUp={handleTilePointerUp}
            onLanePointerDown={handleLanePointerDown}
            onPointerLeaveArea={handlePointerLeaveArea}
            reducedMotion={reducedMotion}
            isWaitingForStart={isWaitingForStart}
            onStartGame={handleStartGame}
            songTitle={map.songTitle}
            artist="Praise & Worship"
          />
        )}

        {/* Floating Neon Judgement Pop & Attached Combo Badge (Screen 2 Inspiration) */}
        {latestJudgement && !isWaitingForStart && !failedResult && (
          <div
            key={latestJudgement.key}
            className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center animate-bounce text-center"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-3xl sm:text-4xl font-black tracking-widest uppercase drop-shadow-[0_0_20px_rgba(244,114,182,0.9)] ${
                  latestJudgement.grade === 'PERFECT'
                    ? 'text-pink-400 bg-gradient-to-r from-pink-400 via-purple-300 to-amber-300 bg-clip-text text-transparent'
                    : latestJudgement.grade === 'GREAT'
                    ? 'text-cyan-400'
                    : latestJudgement.grade === 'GOOD'
                    ? 'text-amber-400'
                    : 'text-rose-500'
                }`}
              >
                {latestJudgement.grade}
              </span>
              {scoreState.combo > 1 && (
                <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight bg-white/10 px-2 py-0.5 rounded-lg border border-white/20 shadow-md">
                  x{scoreState.combo}
                </span>
              )}
            </div>
          </div>
        )}

        {/* In-Lane Failure / Revive Cards Overlay (Screen 3 Inspiration) */}
        {failedResult && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-center px-4 animate-fadeIn">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
                Praise Interrupted
              </h3>
              <p className="text-xs text-purple-200 font-medium">
                {failedResult.failureReason === 'MISSED_NOTE'
                  ? 'A falling tile reached the bottom'
                  : 'An empty lane was tapped'}
              </p>
            </div>

            {/* In-Lane Interactive Action Cards */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto w-full">
              {/* Retry / Play Card */}
              <button
                onClick={handleRestart}
                className="h-28 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.6)] flex flex-col items-center justify-center gap-2 text-black font-black transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-8 h-8 stroke-[2.5]" />
                <span className="text-sm uppercase tracking-widest">RETRY</span>
              </button>

              {/* Summary / Revive Card */}
              <button
                onClick={() => onRunFinished(failedResult)}
                className="h-28 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-900 border border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.6)] flex flex-col items-center justify-center gap-2 text-white font-black transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Award className="w-8 h-8 stroke-[2.5] text-amber-300" />
                <span className="text-sm uppercase tracking-widest text-amber-300">RESULTS</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
