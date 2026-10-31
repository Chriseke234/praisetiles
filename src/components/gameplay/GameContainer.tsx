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
import { getCurrentStarStage, createInitialScoreState } from '@/lib/game/scoring';
import { useKeyBindings } from '@/hooks/useKeyBindings';
import { PianoTilesView } from './PianoTilesView';
import { GuitarTilesView } from './GuitarTilesView';
import { Volume2, VolumeX, Star, Zap, ArrowLeft, Sliders } from 'lucide-react';

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
  const [countdown, setCountdown] = useState<number | null>(3);
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

  // Configurable keyboard bindings (resolves GDD Open Decision #4)
  const { keys: keyBindings, keyToLane } = useKeyBindings();

  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeLanesTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const initialCalibrationRef = useRef<number>(calibrationMs);

  // Update calibration offset on active engine dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCalibrationOffset(calibrationMs / 1000);
    }
  }, [calibrationMs]);

  // Initialize engine
  useEffect(() => {
    const timeouts = activeLanesTimeoutRef.current;
    const engine = new GameEngine(map, instrument, {
      onScoreUpdate: (state) => setScoreState(state),
      onNoteJudged: (noteId, grade, lane) => {
        setLatestJudgement({ grade, lane, key: Date.now() });
        setNotes((prevNotes) =>
          prevNotes.map((n) => (n.id === noteId ? { ...n, hit: true, grade } : n))
        );
      },
      onRunFailed: (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        onRunFinished(result);
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

    return () => {
      engine.stop();
      audioPlayer.stop();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      timeouts.forEach(clearTimeout);
    };
  }, [map, instrument, audioPlayer, onRunFinished]);

  // Handle Lane Tap
  const handleLaneTap = useCallback((lane: number) => {
    if (engineRef.current) {
      engineRef.current.handleLaneInput(lane);
    }
  }, []);

  // Keyboard controls listener (configurable via useKeyBindings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = keyToLane(e.key);
      if (lane !== -1) handleLaneTap(lane);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLaneTap, keyToLane]);

  // Countdown & Audio Start sequence
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      // Begin gameplay!
      timer = setTimeout(async () => {
        setCountdown(null);
        if (engineRef.current) {
          engineRef.current.start();
          await audioPlayer.play(0, () => {
            // Song ended cleanly
            engineRef.current?.handleCompletion();
          });
        }
      }, 500);
    }
    return () => clearTimeout(timer);
  }, [countdown, audioPlayer]);

  // Main high-precision animation loop
  useEffect(() => {
    const loop = () => {
      if (engineRef.current) {
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
  }, [audioPlayer]);

  const currentStarStage = getCurrentStarStage(currentAudioTime, map.duration);

  // Active combo multiplier
  const multiplier =
    scoreState.combo >= 100
      ? 3.0
      : scoreState.combo >= 50
      ? 2.0
      : scoreState.combo >= 25
      ? 1.5
      : scoreState.combo >= 10
      ? 1.2
      : 1.0;

  return (
    <div className="relative w-full h-screen flex flex-col justify-between bg-[#07080c] text-white overflow-hidden select-none">
      {/* Top HUD */}
      <header className="relative z-30 w-full max-w-lg mx-auto p-3 sm:p-4 flex items-center justify-between border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-sm">
        {/* Exit & Star Stage */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            aria-label="Exit Game"
            className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* 3-Star Indicator */}
          <div className="flex items-center gap-1 bg-gray-900/90 px-2.5 py-1 rounded-full border border-gray-800">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={`w-3.5 h-3.5 transition-colors ${
                  star <= currentStarStage
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-700'
                }`}
              />
            ))}
            <span className="text-[10px] uppercase font-bold text-gray-300 ml-1">
              Stage {currentStarStage}
            </span>
          </div>
        </div>

        {/* Live Score & Accuracy */}
        <div className="flex flex-col items-center">
          <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
            {scoreState.score.toLocaleString()}
          </span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            {scoreState.runAccuracy.toFixed(1)}% Accuracy
          </span>
        </div>

        {/* Combo & Multiplier */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-lg font-black text-emerald-400 font-mono flex items-center gap-0.5">
              <Zap className="w-3.5 h-3.5 fill-emerald-400" />
              {scoreState.combo}x
            </span>
            <span
              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                multiplier > 1.0
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {multiplier.toFixed(1)}x
            </span>
          </div>

          {/* Calibration button */}
          <button
            onClick={() => setShowCalibration((prev) => !prev)}
            aria-label="Audio/Input Calibration"
            title={`Timing Offset: ${calibrationMs >= 0 ? '+' : ''}${calibrationMs}ms`}
            className={`p-1.5 rounded-lg transition ${
              calibrationMs !== 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-gray-900 hover:bg-gray-800 text-gray-400'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Volume toggle */}
          <button
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            aria-label={volume > 0 ? 'Mute Audio' : 'Unmute Audio'}
            className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 transition"
          >
            {volume > 0 ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
          </button>
        </div>
      </header>

      {/* Timing Calibration Popup */}
      {showCalibration && (
        <div className="absolute top-14 right-4 z-50 p-4 rounded-2xl bg-gray-950/95 border border-gray-800 shadow-2xl backdrop-blur-md w-64 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Latency Calibration</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {calibrationMs >= 0 ? `+${calibrationMs}` : calibrationMs} ms
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            Adjust timing offset to compensate for Bluetooth audio or display delay.
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
          <div className="flex justify-between text-[9px] text-gray-500 font-mono">
            <span>-150ms (Earlier)</span>
            <span>+150ms (Later)</span>
          </div>
        </div>
      )}

      {/* Main 4-Lane Arena Container */}
      <main className="relative flex-1 w-full max-w-lg mx-auto overflow-hidden">
        {/* Render Instrument Presentation */}
        {instrument === 'piano' ? (
          <PianoTilesView
            notes={notes}
            currentTime={currentAudioTime}
            activeLanes={activeLanes}
            onLaneTap={handleLaneTap}
            reducedMotion={reducedMotion}
            keyLabels={keyBindings}
          />
        ) : (
          <GuitarTilesView
            notes={notes}
            currentTime={currentAudioTime}
            activeLanes={activeLanes}
            onLaneTap={handleLaneTap}
            reducedMotion={reducedMotion}
            keyLabels={keyBindings}
          />
        )}

        {/* Floating Judgement Feedback */}
        {latestJudgement && (
          <div
            key={latestJudgement.key}
            className={`absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center animate-bounce text-center`}
          >
            <span
              className={`text-2xl sm:text-3xl font-black tracking-widest uppercase drop-shadow-md ${
                latestJudgement.grade === 'PERFECT'
                  ? 'text-amber-400 text-glow-gold'
                  : latestJudgement.grade === 'GREAT'
                  ? 'text-cyan-400 text-glow-cyan'
                  : latestJudgement.grade === 'GOOD'
                  ? 'text-emerald-400'
                  : 'text-rose-500'
              }`}
            >
              {latestJudgement.grade}
            </span>
          </div>
        )}

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-40">
            <span className="text-7xl sm:text-8xl font-black text-amber-400 animate-pulse text-glow-gold">
              {countdown === 0 ? 'PRAISE!' : countdown}
            </span>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mt-4">
              Get Ready &bull; 4 Lanes &bull; Strict Failure
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
