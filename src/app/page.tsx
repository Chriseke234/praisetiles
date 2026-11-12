'use client';

import React, { useState, useEffect } from 'react';
import { InstrumentType, RhythmMap, RunResult, PlayableAudioClock } from '@/types/game';
import { GameAudioPlayer } from '@/lib/audio/player';
import { YouTubeAudioPlayer } from '@/lib/audio/youtubePlayer';
import { useAuth } from '@/lib/auth/AuthContext';
import { MainMenu } from '@/components/menu/MainMenu';
import { AudioUploadModal } from '@/components/setup/AudioUploadModal';
import { RhythmMapPreview } from '@/components/setup/RhythmMapPreview';
import { GameContainer } from '@/components/gameplay/GameContainer';
import { PracticeGameContainer } from '@/components/gameplay/PracticeGameContainer';
import { ResultScreen } from '@/components/gameplay/ResultScreen';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { TransferGuestModal } from '@/components/auth/TransferGuestModal';
import { ArenaLoadingScreen } from '@/components/loading/ArenaLoadingScreen';

type AppView = 'MENU' | 'UPLOAD' | 'PREVIEW' | 'PLAYING' | 'RESULT';

function PraiseTilesGame() {
  const [view, setView] = useState<AppView>('MENU');
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [rhythmMap, setRhythmMap] = useState<RhythmMap | null>(null);
  const [songTitle, setSongTitle] = useState<string>('Praise Anthem');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isPractice, setIsPractice] = useState<boolean>(false);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isPreparingPerformance, setIsPreparingPerformance] = useState<boolean>(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const { recordMatch } = useAuth();

  // Audio player singleton using state initializer
  const [audioPlayer] = useState(() => new GameAudioPlayer());
  const [activeAudioPlayer, setActiveAudioPlayer] = useState<PlayableAudioClock>(audioPlayer);

  // Sync volume changes
  useEffect(() => {
    activeAudioPlayer.setVolume(volume);
  }, [volume, activeAudioPlayer]);

  // Handle Instrument selection from Menu
  const handleSelectInstrument = (chosen: InstrumentType, practiceMode?: boolean) => {
    setInstrument(chosen);
    setIsPractice(Boolean(practiceMode));
    if (rhythmMap) {
      setView('PREVIEW');
    } else {
      setView('UPLOAD');
    }
  };

  // Handle successful audio load and analysis
  const handleAudioReady = (buffer: AudioBuffer, map: RhythmMap, title: string) => {
    setActiveAudioPlayer(audioPlayer);
    setAudioBuffer(buffer);
    setRhythmMap(map);
    setSongTitle(title);
    setView('PREVIEW');
  };

  // Handle Quick Play (smooth transition with loading feedback)
  const handleQuickPlay = (buffer: AudioBuffer, map: RhythmMap, title: string) => {
    setActiveAudioPlayer(audioPlayer);
    setAudioBuffer(buffer);
    setRhythmMap(map);
    setSongTitle(title);
    setIsPreparingPerformance(true);
    setTimeout(() => {
      setIsPreparingPerformance(false);
      setView('PLAYING');
    }, 600);
  };

  // Handle YouTube Music setup
  const handleYouTubeReady = (ytPlayer: YouTubeAudioPlayer, map: RhythmMap, title: string) => {
    setActiveAudioPlayer(ytPlayer);
    setAudioBuffer(null);
    setRhythmMap(map);
    setSongTitle(title);
    setView('PREVIEW');
  };

  // Handle Quick Play for YouTube Music
  const handleQuickPlayYouTube = (ytPlayer: YouTubeAudioPlayer, map: RhythmMap, title: string) => {
    setActiveAudioPlayer(ytPlayer);
    setAudioBuffer(null);
    setRhythmMap(map);
    setSongTitle(title);
    setIsPreparingPerformance(true);
    setTimeout(() => {
      setIsPreparingPerformance(false);
      setView('PLAYING');
    }, 600);
  };

  // Start gameplay with smooth arena loading transition
  const handleStartGame = () => {
    if (rhythmMap) {
      setIsPreparingPerformance(true);
      setTimeout(() => {
        setIsPreparingPerformance(false);
        setView('PLAYING');
      }, 600);
    }
  };

  // Handle run finished (either completed or failed)
  const handleRunFinished = async (result: RunResult) => {
    const finalResult = { ...result, isPractice };
    setRunResult(finalResult);
    setView('RESULT');

    // Practice mode does NOT record to competitive rankings or tournaments
    if (rhythmMap && !isPractice) {
      try {
        const submission = await recordMatch(
          finalResult,
          songTitle,
          rhythmMap.audioFingerprint
        );
        setXpEarned(submission.xpEarned);
      } catch {
        // Non-blocking
      }
    } else {
      setXpEarned(0);
    }
  };

  // Instant retry reusing existing audio buffer/stream and rhythm map
  const handleRetry = () => {
    if (rhythmMap) {
      setView('PLAYING');
    } else {
      setView('UPLOAD');
    }
  };

  // Change instrument while preserving loaded audio and map
  const handleChangeInstrument = (newInstrument?: InstrumentType) => {
    if (newInstrument) {
      setInstrument(newInstrument);
    } else {
      setInstrument((prev) => (prev === 'piano' ? 'guitar' : 'piano'));
    }
    if (rhythmMap) {
      setView('PREVIEW');
    } else {
      setView('UPLOAD');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#090a0f] text-gray-100 flex flex-col justify-center">
      {view === 'MENU' && (
        <MainMenu
          onSelectInstrument={handleSelectInstrument}
          volume={volume}
          onVolumeChange={setVolume}
          reducedMotion={reducedMotion}
          onToggleReducedMotion={() => setReducedMotion((prev) => !prev)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {view === 'UPLOAD' && (
        <AudioUploadModal
          instrument={instrument}
          audioPlayer={audioPlayer}
          onAudioReady={handleAudioReady}
          onYouTubeReady={handleYouTubeReady}
          onQuickPlay={handleQuickPlay}
          onQuickPlayYouTube={handleQuickPlayYouTube}
          onBack={() => setView('MENU')}
        />
      )}

      {view === 'PREVIEW' && rhythmMap && (
        <RhythmMapPreview
          map={rhythmMap}
          instrument={instrument}
          onChangeInstrument={setInstrument}
          onStartGame={handleStartGame}
          onReset={() => {
            setAudioBuffer(null);
            setRhythmMap(null);
            setView('UPLOAD');
          }}
        />
      )}

      {view === 'PLAYING' && rhythmMap && (
        isPractice ? (
          <PracticeGameContainer
            map={rhythmMap}
            instrument={instrument}
            audioPlayer={activeAudioPlayer}
            volume={volume}
            onVolumeChange={setVolume}
            reducedMotion={reducedMotion}
            onPracticeFinished={handleRunFinished}
            onExit={() => setView('MENU')}
          />
        ) : (
          <GameContainer
            map={rhythmMap}
            instrument={instrument}
            audioPlayer={activeAudioPlayer}
            volume={volume}
            onVolumeChange={setVolume}
            reducedMotion={reducedMotion}
            onRunFinished={handleRunFinished}
            onExit={() => setView('MENU')}
          />
        )
      )}

      {view === 'RESULT' && runResult && (
        <ResultScreen
          result={runResult}
          songTitle={songTitle}
          xpEarned={xpEarned}
          onRetry={handleRetry}
          onChangeInstrument={() => handleChangeInstrument()}
          onMainMenu={() => setView('MENU')}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Full-screen Performance Prep Overlay */}
      {isPreparingPerformance && (
        <ArenaLoadingScreen
          title={songTitle}
          subtitle="Preparing your performance..."
          mode={instrument}
          statusText="Entering Gospel Rhythm Arena..."
          substatusText="Synchronizing 4-lane engine"
          mascotPose="listening"
          reducedMotion={reducedMotion}
        />
      )}

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenAuth={() => {
          setIsProfileModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      <TransferGuestModal />
    </div>
  );
}

export default function PraiseTilesApp() {
  return <PraiseTilesGame />;
}
