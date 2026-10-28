'use client';

import React, { useState, useEffect } from 'react';
import { InstrumentType, RhythmMap, RunResult } from '@/types/game';
import { GameAudioPlayer } from '@/lib/audio/player';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { SocialProvider } from '@/lib/social/SocialContext';
import { MainMenu } from '@/components/menu/MainMenu';
import { AudioUploadModal } from '@/components/setup/AudioUploadModal';
import { RhythmMapPreview } from '@/components/setup/RhythmMapPreview';
import { GameContainer } from '@/components/gameplay/GameContainer';
import { ResultScreen } from '@/components/gameplay/ResultScreen';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { TransferGuestModal } from '@/components/auth/TransferGuestModal';

type AppView = 'MENU' | 'UPLOAD' | 'PREVIEW' | 'PLAYING' | 'RESULT';

function PraiseTilesGame() {
  const [view, setView] = useState<AppView>('MENU');
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [rhythmMap, setRhythmMap] = useState<RhythmMap | null>(null);
  const [songTitle, setSongTitle] = useState<string>('Praise Anthem');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const { recordMatch } = useAuth();

  // Audio player singleton using state initializer
  const [audioPlayer] = useState(() => new GameAudioPlayer());

  // Sync volume changes
  useEffect(() => {
    audioPlayer.setVolume(volume);
  }, [volume, audioPlayer]);

  // Handle Instrument selection from Menu
  const handleSelectInstrument = (chosen: InstrumentType) => {
    setInstrument(chosen);
    if (audioBuffer && rhythmMap) {
      setView('PREVIEW');
    } else {
      setView('UPLOAD');
    }
  };

  // Handle successful audio load and analysis
  const handleAudioReady = (buffer: AudioBuffer, map: RhythmMap, title: string) => {
    setAudioBuffer(buffer);
    setRhythmMap(map);
    setSongTitle(title);
    setView('PREVIEW');
  };

  // Start gameplay
  const handleStartGame = () => {
    if (audioBuffer && rhythmMap) {
      setView('PLAYING');
    }
  };

  // Handle run finished (either completed or failed)
  const handleRunFinished = async (result: RunResult) => {
    setRunResult(result);
    setView('RESULT');

    // Asynchronously record match to persistence pipeline
    if (rhythmMap) {
      try {
        const submission = await recordMatch(
          result,
          songTitle,
          rhythmMap.audioFingerprint
        );
        setXpEarned(submission.xpEarned);
      } catch {
        // Non-blocking
      }
    }
  };

  // Instant retry reusing existing audio buffer and rhythm map
  const handleRetry = () => {
    if (audioBuffer && rhythmMap) {
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
    if (audioBuffer && rhythmMap) {
      setView('PREVIEW');
    } else {
      setView('UPLOAD');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090a0f] text-gray-100 flex flex-col justify-center">
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
        <GameContainer
          map={rhythmMap}
          instrument={instrument}
          audioPlayer={audioPlayer}
          volume={volume}
          onVolumeChange={setVolume}
          reducedMotion={reducedMotion}
          onRunFinished={handleRunFinished}
          onExit={() => setView('MENU')}
        />
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
  return (
    <AuthProvider>
      <SocialProvider>
        <PraiseTilesGame />
      </SocialProvider>
    </AuthProvider>
  );
}
