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
import { AtmosphericBackground } from './AtmosphericBackground';
import { GameplayEffectsOverlay } from './GameplayEffectsOverlay';
import { PauseTasksCard } from './PauseTasksCard';
import { safeLocalStorage } from '@/lib/storage/safeStorage';
import {
  Volume2,
  VolumeX,
  Sliders,
  RotateCcw,
  Pause,
  Play,
  LogOut,
  Sparkles,
  Award,
} from 'lucide-react';

interface PracticeGameContainerProps {
  map: RhythmMap;
  instrument: InstrumentType;
  audioPlayer: PlayableAudioClock;
  volume: number;
  onVolumeChange: (vol: number) => void;
  reducedMotion: boolean;
  onPracticeFinished: (result: RunResult) => void;
  onExit: () => void;
}

export const PracticeGameContainer: React.FC<PracticeGameContainerProps> = ({
  map,
  instrument,
  audioPlayer,
  volume,
  onVolumeChange,
  reducedMotion,
  onPracticeFinished,
  onExit,
}) => {
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
  const [isAudioMutedByPolicy, setIsAudioMutedByPolicy] = useState<boolean>(false);

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

  // Timing offset feedback for practice coaching
  const [timingFeedback, setTimingFeedback] = useState<string | null>(null);

  // Pause & Resume
  const [isPaused, setIsPaused] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);

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
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Monotonic clock bridge so tiles begin falling on frame 1 even while WebAudio/YouTube buffers
  const kickoffPerfTimeRef = useRef<number | null>(null);
  const kickoffOffsetRef = useRef<number>(initialStartTime);
  const audioClockLeadRef = useRef<number>(0);

  // Pre-warm audio context / YouTube IFrame on mount
  useEffect(() => {
    if (typeof audioPlayer.ensureContext === 'function') {
      void audioPlayer.ensureContext().catch(() => {});
    }
  }, [audioPlayer]);

  // Instantiate engine with Practice Mode enabled (No failure termination)
  const initEngine = useCallback(() => {
    const timeouts = activeLanesTimeoutRef.current;
    const engine = new GameEngine(preparedMap, instrument, {
      onScoreUpdate: (state) => setScoreState(state),
      onNoteJudged: (noteId, grade, lane) => {
        setLatestJudgement({ grade, lane, key: Date.now() });

        // Timing coach tip
        if (grade === 'PERFECT') {
          setTimingFeedback('Exact Hit! Keep this tempo');
        } else if (grade === 'GREAT') {
          setTimingFeedback('Good timing, slight offset');
        } else if (grade === 'GOOD') {
          setTimingFeedback('Close! Aim for the hit line');
        } else if (grade === 'MISS') {
          setTimingFeedback('Note missed - keep going, no game over');
        }

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
      onRunFailed: () => {
        // Practice Mode never triggers failure!
      },
      onRunCompleted: (result) => {
        audioPlayer.stop();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        onPracticeFinished({ ...result, isPractice: true });
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

    engine.setPracticeMode(true);
    engine.setCalibrationOffset(calibrationMs / 1000);
    engineRef.current = engine;
    return engine;
  }, [preparedMap, instrument, audioPlayer, onPracticeFinished, calibrationMs]);

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

  // Ensure audio hardware volume is synchronized
  useEffect(() => {
    audioPlayer.setVolume(volume);
  }, [volume, audioPlayer]);

  // Audio Context Resumption Helper on any user interaction
  const ensureAudioPlaying = useCallback(() => {
    if (typeof audioPlayer.resumeContext === 'function') {
      void audioPlayer.resumeContext().then((running) => {
        if (running) setIsAudioMutedByPolicy(false);
      });
    } else if (typeof audioPlayer.ensureContext === 'function') {
      void audioPlayer.ensureContext();
    }
  }, [audioPlayer]);

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

    audioPlayer.setVolume(volume);

    void audioPlayer.play(initialStartTime, () => {
      engineRef.current?.handleCompletion();
    }).then(() => {
      if (typeof audioPlayer.isContextSuspended === 'function' && audioPlayer.isContextSuspended()) {
        setIsAudioMutedByPolicy(true);
      } else {
        setIsAudioMutedByPolicy(false);
      }
    }).catch((err) => {
      console.warn('[Practice Audio Playback Error]', err);
      setIsAudioMutedByPolicy(true);
    });
  }, [initialStartTime, audioPlayer, volume]);

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

  const handlePause = useCallback(() => {
    if (isWaitingForStart || isPaused) return;
    setIsPaused(true);
    if (engineRef.current) {
      engineRef.current.pause();
    }
    audioPlayer.pause();
  }, [isWaitingForStart, isPaused, audioPlayer]);

  const handleResume = useCallback(() => {
    if (!isPaused || resumeCountdown !== null) return;
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
    setScoreState(createInitialScoreState());
    setCurrentAudioTime(initialStartTime);
    setNotes(preparedMap.notes.map((n) => ({ ...n, hit: false, grade: null })));
    setLatestJudgement(null);
    setTimingFeedback(null);
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

  // Tab switch auto-pause
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isWaitingForStart && !isPaused) {
        handlePause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isWaitingForStart, isPaused, handlePause]);

  // Direct touch/mouse handlers
  const handleTilePointerDown = useCallback(
    (noteId: string, lane: number) => {
      ensureAudioPlaying();
      if (isPaused || resumeCountdown !== null) return;
      if (startCountdown !== null) {
        startPlayback();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleDirectTileDown(noteId, lane);
      }
    },
    [isPaused, resumeCountdown, startCountdown, startPlayback, ensureAudioPlaying]
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
      ensureAudioPlaying();
      if (isPaused || resumeCountdown !== null) return;
      if (startCountdown !== null) {
        startPlayback();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleLaneInput(lane);
      }
    },
    [isPaused, resumeCountdown, startCountdown, startPlayback, ensureAudioPlaying]
  );

  // High-precision 60-120fps animation loop:
  // Drives tile GPU transforms directly via tilesViewRef (zero per-frame React re-renders).
  useEffect(() => {
    const loop = (nowMs: number) => {
      if (engineRef.current && hasStartedRef.current && !isPaused) {
        const audioTime = audioPlayer.getCurrentTime();
        let time = audioTime;

        if (kickoffPerfTimeRef.current !== null) {
          const elapsedSinceKickoff = (performance.now() - kickoffPerfTimeRef.current) / 1000;
          const bridgedTime = kickoffOffsetRef.current + elapsedSinceKickoff;
          if (audioTime > kickoffOffsetRef.current + 0.01) {
            audioClockLeadRef.current = Math.max(0, bridgedTime - audioTime);
            kickoffPerfTimeRef.current = null;
            time = audioTime + audioClockLeadRef.current;
          } else {
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
  }, [audioPlayer, isPaused]);

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
        engineRef.current?.handlePointerCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startCountdown, isPaused, startPlayback, handleResume, handlePause, handleLanePointerDown]);

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] flex flex-col justify-between bg-[#061214] text-white overflow-hidden select-none">
      <AtmosphericBackground />

      <GameplayEffectsOverlay
        latestJudgement={latestJudgement}
        combo={scoreState.combo}
        currentPerfectStreak={scoreState.currentPerfectStreak ?? 0}
        sustainBonusAwarded={sustainBonus}
        reducedMotion={reducedMotion}
      />

      {/* Top Practice HUD */}
      <header className="relative z-30 w-full max-w-lg mx-auto pt-3 safe-pt px-4 flex flex-col items-center">
        <div className="w-full flex items-center justify-between">
          <button
            onClick={handlePause}
            disabled={isWaitingForStart || isPaused}
            aria-label="Pause Practice"
            className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-gray-300 hover:text-white hover:border-emerald-400/50 transition backdrop-blur-sm cursor-pointer disabled:opacity-40"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>

          {/* Mode Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Practice Mode (No Fail)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              aria-label="Restart Track"
              className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-gray-300 hover:text-white transition backdrop-blur-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
              aria-label="Toggle Volume"
              className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-gray-300 hover:text-white transition backdrop-blur-sm cursor-pointer"
            >
              {volume > 0 ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
          </div>
        </div>

        {/* Practice Coaching Prompt Bar */}
        <div className="mt-2 text-center">
          <p className="text-xs font-mono font-medium text-emerald-200">
            {timingFeedback ?? 'Tap tiles to practise timing. Misses will never stop the song.'}
          </p>
        </div>

        {/* Centered Score */}
        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1 font-mono">
          {scoreState.score.toLocaleString()}
        </div>
      </header>

      {/* Main Arena */}
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
            onPointerLeaveArea={() => engineRef.current?.handlePointerCancel()}
            reducedMotion={reducedMotion}
            isWaitingForStart={isWaitingForStart}
            onStartGame={handleStartGame}
            songTitle={map.songTitle}
            artist="Practice Session"
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
            onPointerLeaveArea={() => engineRef.current?.handlePointerCancel()}
            reducedMotion={reducedMotion}
            isWaitingForStart={isWaitingForStart}
            onStartGame={handleStartGame}
            songTitle={map.songTitle}
            artist="Practice Session"
          />
        )}

        {/* Floating Tap-to-Unmute Banner if Browser Suspended Audio Autoplay */}
        {isAudioMutedByPolicy && startCountdown === null && !isPaused && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <button
              onClick={ensureAudioPlaying}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-xs font-black shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition"
            >
              <Volume2 className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>TAP TO ENABLE SOUND</span>
            </button>
          </div>
        )}

        {/* 3-2-1 Kickoff Auto-Countdown Overlay */}
        {startCountdown !== null && (
          <div
            onClick={startPlayback}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center animate-fadeIn cursor-pointer"
          >
            <div className="text-7xl sm:text-9xl font-black text-emerald-300 animate-ping font-mono drop-shadow-[0_0_40px_rgba(52,211,153,0.9)]">
              {startCountdown}
            </div>
            <p className="text-xs uppercase tracking-widest text-emerald-200 mt-6 font-bold flex items-center gap-2">
              <span>GET READY</span>
              <span className="text-emerald-400">&bull;</span>
              <span className="text-[10px] text-gray-400">TAP ANYWHERE TO SKIP</span>
            </p>
          </div>
        )}

        {/* 3-2-1 Countdown Overlay for Resume from Pause */}
        {resumeCountdown !== null && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn pointer-events-none">
            <div className="text-7xl sm:text-8xl font-black text-emerald-300 animate-ping font-mono drop-shadow-[0_0_35px_rgba(52,211,153,0.9)]">
              {resumeCountdown}
            </div>
            <p className="text-xs uppercase tracking-widest text-emerald-200 mt-4 font-bold">
              GET READY...
            </p>
          </div>
        )}

        {/* Practice Pause Modal */}
        {isPaused && resumeCountdown === null && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-center items-center px-4 animate-fadeIn">
            <div className="max-w-sm w-full bg-[#0a1e20] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 inline-block">
                  Practice Paused
                </span>
                <h3 className="text-2xl font-black text-white tracking-wide">Take a Breath</h3>
                <p className="text-xs text-emerald-300">{map.songTitle}</p>
              </div>

              {/* Active Player Tasks */}
              <PauseTasksCard />

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleResume}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.6)] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Resume Practice</span>
                </button>

                <button
                  onClick={handleRestart}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart Track</span>
                </button>

                <button
                  onClick={onExit}
                  className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 text-rose-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Practice</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
