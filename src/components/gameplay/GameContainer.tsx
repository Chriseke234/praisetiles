'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  RhythmMap,
  InstrumentType,
  RunResult,
  ScoreState,
  HitGrade,
  Note,
  PlayableAudioClock,
} from '@/types/game';
import { GameEngine } from '@/lib/game/engine';
import { createInitialScoreState } from '@/lib/game/scoring';
import { PianoTilesView, TilesViewHandle } from './PianoTilesView';
import { GuitarTilesView } from './GuitarTilesView';
import { MilestoneProgressBar } from './MilestoneProgressBar';
import { AtmosphericBackground } from './AtmosphericBackground';
import { GameplayEffectsOverlay } from './GameplayEffectsOverlay';
import { PauseTasksCard } from './PauseTasksCard';
import { safeLocalStorage } from '@/lib/storage/safeStorage';
import {
  Volume2,
  VolumeX,
  Sliders,
  RotateCcw,
  Award,
  Shield,
  Pause,
  Play,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

interface GameContainerProps {
  map: RhythmMap;
  instrument: InstrumentType;
  audioPlayer: PlayableAudioClock;
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

  // Prepared map: preserve authentic musical timestamps from rhythm analysis
  const preparedMap = useMemo<RhythmMap>(() => {
    if (!map.notes || map.notes.length === 0) return map;
    return {
      ...map,
      notes: map.notes.map((n) => ({ ...n, hit: false, grade: null })),
    };
  }, [map]);

  const firstNote = preparedMap.notes.length > 0 ? preparedMap.notes[0] : null;
  // Optimal audio start offset so the opening tile flows down naturally from the top of the lanes
  const initialStartTime = useMemo(() => {
    if (!firstNote) return 0;
    if (firstNote.time <= 3.0) return 0;
    return Math.max(0, Math.round((firstNote.time - 1.75) * 1000) / 1000);
  }, [firstNote]);

  // Kickoff Countdown State: 3-2-1 auto-countdown prevents tile stagnation
  const [startCountdown, setStartCountdown] = useState<number | null>(3);
  const isWaitingForStart = startCountdown !== null;
  const hasStartedRef = useRef<boolean>(false);
  const lastRenderedTimeRef = useRef<number>(initialStartTime);

  const [failedResult, setFailedResult] = useState<RunResult | null>(null);
  const [scoreState, setScoreState] = useState<ScoreState>(createInitialScoreState);
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(initialStartTime);
  const [notes, setNotes] = useState<readonly Note[]>(() => preparedMap.notes);
  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);
  const [latestJudgement, setLatestJudgement] = useState<{
    grade: HitGrade;
    lane: number;
    key: number;
  } | null>(null);
  const [sustainBonus, setSustainBonus] = useState<{
    key: number;
    points: number;
  } | null>(null);

  // Pause & Resume State
  const [isPaused, setIsPaused] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [calibrationMs, setCalibrationMs] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = safeLocalStorage.getItem('praisetiles_calibration_ms');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    }
    return 0;
  });
  const [showCalibration, setShowCalibration] = useState(false);

  const engineRef = useRef<GameEngine | null>(null);
  const tilesViewRef = useRef<TilesViewHandle | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastReactSyncRef = useRef<number>(0);
  const activeLanesTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const judgementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sustainBonusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialCalibrationRef = useRef<number>(calibrationMs);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Monotonic clock bridge so tiles begin falling on frame 1 even while WebAudio/YouTube buffers
  const kickoffPerfTimeRef = useRef<number | null>(null);
  const kickoffOffsetRef = useRef<number>(initialStartTime);
  const audioClockLeadRef = useRef<number>(0);

  // Pre-warm audio context / YouTube IFrame on mount so tapping START has zero initialization delay
  useEffect(() => {
    if (typeof audioPlayer.ensureContext === 'function') {
      void audioPlayer.ensureContext().catch(() => {});
    }
  }, [audioPlayer]);

  // Update calibration offset on active engine dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCalibrationOffset(calibrationMs / 1000);
    }
  }, [calibrationMs]);

  // Instantiate engine
  const initEngine = useCallback(() => {
    const timeouts = activeLanesTimeoutRef.current;
    const engine = new GameEngine(preparedMap, instrument, {
      onScoreUpdate: (state) => setScoreState(state),
      onNoteJudged: (noteId, grade, lane) => {
        setLatestJudgement({ grade, lane, key: Date.now() });
        if (judgementTimeoutRef.current) clearTimeout(judgementTimeoutRef.current);
        judgementTimeoutRef.current = setTimeout(() => {
          setLatestJudgement(null);
        }, 600);

        setNotes((prevNotes) => {
          const idx = prevNotes.findIndex((n) => n.id === noteId);
          if (idx === -1) return prevNotes;
          const updated = [...prevNotes];
          updated[idx] = { ...updated[idx], hit: true, grade };
          return updated;
        });
      },
      onSustainCompleted: (_noteId, bonusPoints) => {
        setSustainBonus({ key: Date.now(), points: bonusPoints });
        if (sustainBonusTimeoutRef.current) clearTimeout(sustainBonusTimeoutRef.current);
        sustainBonusTimeoutRef.current = setTimeout(() => {
          setSustainBonus(null);
        }, 1200);
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
  }, [preparedMap, instrument, audioPlayer, onRunFinished]);

  useEffect(() => {
    const engine = initEngine();
    const timeouts = activeLanesTimeoutRef.current;

    return () => {
      engine.stop();
      audioPlayer.stop();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (judgementTimeoutRef.current) clearTimeout(judgementTimeoutRef.current);
      if (sustainBonusTimeoutRef.current) clearTimeout(sustainBonusTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      kickoffPerfTimeRef.current = null;
      timeouts.forEach(clearTimeout);
    };
  }, [initEngine, audioPlayer]);

  // Rhythmic Auto-Kickoff:
  // Starts audio playback and tile flow smoothly at 60-120fps from initialStartTime.
  const startPlayback = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setStartCountdown(null);

    kickoffOffsetRef.current = initialStartTime;
    kickoffPerfTimeRef.current = performance.now();
    lastRenderedTimeRef.current = initialStartTime;
    audioClockLeadRef.current = 0;

    if (engineRef.current) {
      engineRef.current.start();
      engineRef.current.update(initialStartTime);
      const approach = engineRef.current.getDynamicApproachTime();
      tilesViewRef.current?.updatePositions(initialStartTime, approach);
    }

    void audioPlayer.play(initialStartTime, () => {
      engineRef.current?.handleCompletion();
    });
  }, [initialStartTime, audioPlayer]);

  const handleStartGame = useCallback(() => {
    startPlayback();
  }, [startPlayback]);

  // Automatic 3-2-1 kickoff countdown on mount so tiles never sit stagnant
  useEffect(() => {
    let count = 3;
    setStartCountdown(3);
    hasStartedRef.current = false;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setStartCountdown(count);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        startPlayback();
      }
    }, 700);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [startPlayback]);

  // Pause match safely: freeze audio clock, engine progression, input
  const handlePause = useCallback(() => {
    if (isWaitingForStart || failedResult || isPaused) return;
    setIsPaused(true);
    if (engineRef.current) {
      engineRef.current.pause();
    }
    audioPlayer.pause();
  }, [isWaitingForStart, failedResult, isPaused, audioPlayer]);

  // Resume with 3-2-1 countdown
  const handleResume = useCallback(() => {
    if (!isPaused || resumeCountdown !== null) return;
    setShowExitConfirm(false);
    setResumeCountdown(3);

    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setResumeCountdown(count);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setResumeCountdown(null);
        setIsPaused(false);
        if (engineRef.current) {
          engineRef.current.resume();
        }
        await audioPlayer.resume(() => {
          engineRef.current?.handleCompletion();
        });
      }
    }, 800);
  }, [isPaused, resumeCountdown, audioPlayer]);

  // Restart song cleanly with 3-2-1 kickoff
  const handleRestart = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    hasStartedRef.current = false;
    kickoffPerfTimeRef.current = null;
    kickoffOffsetRef.current = initialStartTime;
    lastRenderedTimeRef.current = initialStartTime;
    audioClockLeadRef.current = 0;
    setResumeCountdown(null);
    setStartCountdown(3);
    setIsPaused(false);
    setShowExitConfirm(false);
    setFailedResult(null);
    setScoreState(createInitialScoreState());
    setCurrentAudioTime(initialStartTime);
    setNotes(preparedMap.notes.map((n) => ({ ...n, hit: false, grade: null })));
    setLatestJudgement(null);
    setSustainBonus(null);
    initEngine();

    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setStartCountdown(count);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        startPlayback();
      }
    }, 700);
  }, [preparedMap, initialStartTime, initEngine, startPlayback]);

  // Auto-pause on browser tab switch or app backgrounding (Safari safe)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isWaitingForStart && !failedResult && !isPaused) {
        handlePause();
      }
    };

    const handleWindowBlur = () => {
      // In iOS Safari, touching address bar or UI chrome fires window.blur without hiding the document.
      // Only pause if document is actually hidden or player navigated away.
      if (document.hidden && !isWaitingForStart && !failedResult && !isPaused) {
        handlePause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isWaitingForStart, failedResult, isPaused, handlePause]);

  // Direct Tile Interaction Handlers (Direct Touch & Click + Keyboard)
  const handleTilePointerDown = useCallback(
    (noteId: string, lane: number) => {
      if (isPaused || resumeCountdown !== null) return;
      if (startCountdown !== null) {
        startPlayback();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleDirectTileDown(noteId, lane);
      }
    },
    [isPaused, resumeCountdown, startCountdown, startPlayback]
  );

  const handleTilePointerUp = useCallback(
    (noteId: string, lane: number) => {
      if (isPaused || resumeCountdown !== null) return;
      if (engineRef.current) {
        engineRef.current.handleDirectTileUp(noteId, lane);
      }
    },
    [isPaused, resumeCountdown]
  );

  const handleLanePointerDown = useCallback(
    (lane: number) => {
      if (isPaused || resumeCountdown !== null) return;
      if (startCountdown !== null) {
        startPlayback();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleLaneInput(lane);
      }
    },
    [isPaused, resumeCountdown, startCountdown, startPlayback]
  );

  const handlePointerLeaveArea = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.handlePointerCancel();
    }
  }, []);

  // Main high-precision 60-120fps animation loop:
  // Drives tile GPU transforms directly via tilesViewRef (ZERO per-frame React re-renders).
  // React state (window mounting + progress bar) is throttled to every 200ms (~5Hz).
  useEffect(() => {
    const loop = (nowMs: number) => {
      if (engineRef.current && hasStartedRef.current && !failedResult && !isPaused) {
        const audioTime = audioPlayer.getCurrentTime();
        let time = audioTime;

        if (kickoffPerfTimeRef.current !== null) {
          const elapsedSinceKickoff = (performance.now() - kickoffPerfTimeRef.current) / 1000;
          const bridgedTime = kickoffOffsetRef.current + elapsedSinceKickoff;
          if (audioTime > kickoffOffsetRef.current + 0.01) {
            // Hardware audio clock is live — capture any positive lead and decay smoothly
            audioClockLeadRef.current = Math.max(0, bridgedTime - audioTime);
            kickoffPerfTimeRef.current = null;
            time = audioTime + audioClockLeadRef.current;
          } else {
            // Advance tiles continuously on frame 1 while audio spins up
            time = bridgedTime;
          }
        } else if (audioClockLeadRef.current > 0.001) {
          audioClockLeadRef.current *= 0.95;
          time = audioTime + audioClockLeadRef.current;
        }

        // Strict monotonicity check: time must NEVER freeze or go backwards
        if (time < lastRenderedTimeRef.current) {
          time = lastRenderedTimeRef.current + 0.001;
        }
        lastRenderedTimeRef.current = time;

        engineRef.current.update(time);
        const approach = engineRef.current.getDynamicApproachTime();
        tilesViewRef.current?.updatePositions(time, approach);

        // Throttled React sync (5Hz) to mount upcoming tiles (600ms preload buffer) & update HUD progress
        if (nowMs - lastReactSyncRef.current >= 200) {
          lastReactSyncRef.current = nowMs;
          setCurrentAudioTime(time);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioPlayer, failedResult, isPaused]);

  // Keyboard controls (D, F, J, K or custom keys + Space for pause/resume/countdown)
  useEffect(() => {
    let bindings = ['d', 'f', 'j', 'k'];
    try {
      const saved = safeLocalStorage.getItem('praisetiles_keybindings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          bindings = parsed.map((k: string) => k.toLowerCase());
        }
      }
    } catch {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      // Spacebar toggles pause/resume or skips start countdown
      if (e.code === 'Space' || key === ' ') {
        e.preventDefault();
        if (startCountdown !== null) {
          startPlayback();
          return;
        }
        if (isPaused) {
          handleResume();
        } else {
          handlePause();
        }
        return;
      }

      if (startCountdown !== null) {
        startPlayback();
        return;
      }

      const laneIdx = bindings.indexOf(key);
      if (laneIdx !== -1) {
        e.preventDefault();
        handleLanePointerDown(laneIdx);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const laneIdx = bindings.indexOf(key);
      if (laneIdx !== -1) {
        e.preventDefault();
        handlePointerLeaveArea();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startCountdown, isPaused, startPlayback, handleResume, handlePause, handleLanePointerDown, handlePointerLeaveArea]);

  // Track milestone progress percentage (0 - 100%)
  const progressPercent = map.duration > 0 ? (currentAudioTime / map.duration) * 100 : 0;

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] flex flex-col justify-between bg-[#080414] text-white overflow-hidden select-none">
      {/* Deep Purple Ethereal Atmosphere */}
      <AtmosphericBackground />

      {/* Dynamic Hit Animations, Particle Bursts, Combo Fire & Perfect Streak Overlay */}
      <GameplayEffectsOverlay
        latestJudgement={latestJudgement}
        combo={scoreState.combo}
        currentPerfectStreak={scoreState.currentPerfectStreak ?? 0}
        sustainBonusAwarded={sustainBonus}
        reducedMotion={reducedMotion}
      />

      {/* Top Floating HUD: Controls, Milestone Bar & Centered Large Score */}
      <header className="relative z-30 w-full max-w-lg mx-auto pt-3 safe-pt px-4 flex flex-col items-center">
        {/* Controls Row */}
        <div className="w-full flex items-center justify-between">
          {/* Pause Button */}
          <button
            onClick={handlePause}
            disabled={isWaitingForStart || !!failedResult || isPaused}
            aria-label="Pause Game"
            className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20 text-gray-300 hover:text-white hover:border-amber-400/50 transition backdrop-blur-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>

          {/* Right Utility Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalibration((prev) => !prev)}
              aria-label="Latency Calibration"
              title={`Calibration: ${calibrationMs >= 0 ? '+' : ''}${calibrationMs}ms`}
              className={`p-2.5 rounded-xl border backdrop-blur-sm transition cursor-pointer ${
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
              className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20 text-gray-300 hover:text-white hover:border-amber-400/50 transition backdrop-blur-sm cursor-pointer"
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
        <div className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] mt-1 font-mono">
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
            ref={tilesViewRef}
            notes={notes}
            currentTime={currentAudioTime}
            approachTime={engineRef.current?.getDynamicApproachTime()}
            activeLanes={activeLanes}
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
            ref={tilesViewRef}
            notes={notes}
            currentTime={currentAudioTime}
            approachTime={engineRef.current?.getDynamicApproachTime()}
            activeLanes={activeLanes}
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

        {/* 3-2-1 Kickoff Auto-Countdown Overlay */}
        {startCountdown !== null && (
          <div
            onClick={startPlayback}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center animate-fadeIn cursor-pointer"
          >
            <div className="text-7xl sm:text-9xl font-black text-amber-300 animate-ping font-mono drop-shadow-[0_0_40px_rgba(251,191,36,0.9)]">
              {startCountdown}
            </div>
            <p className="text-xs uppercase tracking-widest text-purple-200 mt-6 font-bold flex items-center gap-2">
              <span>GET READY</span>
              <span className="text-amber-400">&bull;</span>
              <span className="text-[10px] text-gray-400">TAP ANYWHERE TO SKIP</span>
            </p>
          </div>
        )}

        {/* 3-2-1 Countdown Overlay for Resume from Pause */}
        {resumeCountdown !== null && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn pointer-events-none">
            <div className="text-7xl sm:text-8xl font-black text-amber-300 animate-ping font-mono drop-shadow-[0_0_35px_rgba(251,191,36,0.9)]">
              {resumeCountdown}
            </div>
            <p className="text-xs uppercase tracking-widest text-purple-200 mt-4 font-bold">
              GET READY...
            </p>
          </div>
        )}

        {/* Pause Modal Overlay */}
        {isPaused && resumeCountdown === null && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-center items-center px-4 animate-fadeIn">
            <div className="max-w-sm w-full bg-[#12082b] border border-purple-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 inline-block">
                  Paused
                </span>
                <h3 className="text-2xl font-black text-white tracking-wide">Praise Paused</h3>
                <p className="text-xs text-purple-300">{map.songTitle}</p>
              </div>

              {/* In-Game Stats Summary */}
              <div className="grid grid-cols-2 gap-2 bg-purple-950/40 p-3 rounded-2xl border border-purple-500/20 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Score</span>
                  <span className="text-base font-black text-white">{scoreState.score.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Max Combo</span>
                  <span className="text-base font-black text-amber-400">{scoreState.maxCombo}</span>
                </div>
              </div>

              {/* Active Player Tasks */}
              <PauseTasksCard />

              {/* Actions */}
              {!showExitConfirm ? (
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleResume}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.6)] cursor-pointer transition-transform hover:scale-102 active:scale-98"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Resume Game</span>
                  </button>

                  <button
                    onClick={handleRestart}
                    className="w-full py-3 px-4 rounded-xl bg-purple-900/60 hover:bg-purple-900/80 border border-purple-500/30 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restart Song</span>
                  </button>

                  <button
                    onClick={() => setShowExitConfirm(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 text-rose-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Exit Song</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 bg-rose-950/30 border border-rose-500/30 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-center gap-2 text-rose-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Confirm Exit?</span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Your current score and progress will not be saved.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowExitConfirm(false)}
                      className="py-2 px-3 rounded-lg bg-gray-800 text-gray-300 hover:text-white text-xs font-bold uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onExit}
                      className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase cursor-pointer"
                    >
                      Yes, Exit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* In-Lane Failure Cards Overlay */}
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

            {/* Action Cards */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto w-full">
              <button
                onClick={handleRestart}
                className="h-28 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.6)] flex flex-col items-center justify-center gap-2 text-black font-black transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-8 h-8 stroke-[2.5]" />
                <span className="text-sm uppercase tracking-widest">RETRY</span>
              </button>

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
