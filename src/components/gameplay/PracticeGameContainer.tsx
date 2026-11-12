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
import { AtmosphericBackground } from './AtmosphericBackground';
import { GameplayEffectsOverlay } from './GameplayEffectsOverlay';
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
  audioPlayer: GameAudioPlayer;
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
  const [isWaitingForStart, setIsWaitingForStart] = useState(true);
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
      const saved = localStorage.getItem('praisetiles_calibration_ms');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    }
    return 0;
  });
  const [showCalibration, setShowCalibration] = useState(false);

  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeLanesTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const judgementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sustainBonusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Instantiate engine with Practice Mode enabled (No failure termination)
  const initEngine = useCallback(() => {
    const timeouts = activeLanesTimeoutRef.current;
    const engine = new GameEngine(map, instrument, {
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

        setNotes((prevNotes) =>
          prevNotes.map((n) =>
            n.id === noteId ? ({ ...n, hit: true, grade, hitTimestamp: Date.now() } as Note) : n
          )
        );
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
  }, [map, instrument, audioPlayer, onPracticeFinished, calibrationMs]);

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
      timeouts.forEach(clearTimeout);
    };
  }, [initEngine, audioPlayer]);

  const handleStartGame = useCallback(async () => {
    if (!isWaitingForStart) return;
    setIsWaitingForStart(false);

    if (engineRef.current) {
      await audioPlayer.ensureContext();
      engineRef.current.start();
      await audioPlayer.play(0, () => {
        engineRef.current?.handleCompletion();
      });
    }
  }, [isWaitingForStart, audioPlayer]);

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
    setResumeCountdown(null);
    setIsPaused(false);
    setIsWaitingForStart(true);
    setScoreState(createInitialScoreState());
    setCurrentAudioTime(0);
    setNotes(map.notes.map((n) => ({ ...n, hit: false, grade: null })));
    setLatestJudgement(null);
    setTimingFeedback(null);
    setSustainBonus(null);
    initEngine();
  }, [map, initEngine]);

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
      if (isPaused || resumeCountdown !== null) return;
      if (isWaitingForStart) {
        handleStartGame();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleDirectTileDown(noteId, lane);
      }
    },
    [isPaused, resumeCountdown, isWaitingForStart, handleStartGame]
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
      if (isWaitingForStart) {
        handleStartGame();
        return;
      }
      if (engineRef.current) {
        engineRef.current.handleLaneInput(lane);
      }
    },
    [isPaused, resumeCountdown, isWaitingForStart, handleStartGame]
  );

  // Animation Loop
  useEffect(() => {
    const loop = () => {
      if (engineRef.current && !isWaitingForStart && !isPaused) {
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
  }, [audioPlayer, isWaitingForStart, isPaused]);

  return (
    <div className="relative w-full h-screen flex flex-col justify-between bg-[#061214] text-white overflow-hidden select-none">
      <AtmosphericBackground />

      <GameplayEffectsOverlay
        latestJudgement={latestJudgement}
        combo={scoreState.combo}
        currentPerfectStreak={scoreState.currentPerfectStreak ?? 0}
        sustainBonusAwarded={sustainBonus}
        reducedMotion={reducedMotion}
      />

      {/* Top Practice HUD */}
      <header className="relative z-30 w-full max-w-lg mx-auto pt-3 px-4 flex flex-col items-center">
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

        {/* 3-2-1 Countdown */}
        {resumeCountdown !== null && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn pointer-events-none">
            <div className="text-7xl sm:text-8xl font-black text-emerald-300 animate-ping font-mono">
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
