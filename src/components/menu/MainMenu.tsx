'use client';

import React from 'react';
import { InstrumentType } from '@/types/game';
import { Volume2, VolumeX, Music, Flame, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { getGemTier } from '@/config/progression';

interface MainMenuProps {
  onSelectInstrument: (instrument: InstrumentType) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSelectInstrument,
  volume,
  onVolumeChange,
  reducedMotion,
  onToggleReducedMotion,
  onOpenProfile,
  onOpenAuth,
}) => {
  const [showInstrumentSelect, setShowInstrumentSelect] = React.useState(false);
  const { user, profile, progress } = useAuth();

  const currentRank = progress?.gemRank || 'Quartz';
  const tier = getGemTier(currentRank);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 bg-[#090a0f] text-gray-100 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between border-b border-gray-800/80 pb-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center glow-gold">
            <Music className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400 bg-clip-text text-transparent">
              PRAISETILES
            </h1>
            <p className="text-[10px] sm:text-xs tracking-widest uppercase text-gray-400 font-semibold">
              Gospel Rhythm Arena
            </p>
          </div>
        </div>

        {/* User profile, Guest status & Quick controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Authenticated Profile or Guest Pill */}
          {user && profile ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/50 transition glow-gold"
            >
              <div
                style={{ backgroundColor: tier.colorHex }}
                className="w-5 h-5 rounded-lg flex items-center justify-center text-black font-black text-[10px]"
              >
                {tier.gemRank[0]}
              </div>
              <span className="text-xs font-bold text-white max-w-[100px] truncate">
                {profile.displayName}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-xs text-amber-300 font-medium hover:border-amber-500/40 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Guest</span>
              </button>
              <button
                onClick={onOpenAuth}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Sound Controls */}
          <div className="flex items-center gap-2 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-xl">
            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
              aria-label={volume > 0 ? 'Mute Audio' : 'Unmute Audio'}
              className="text-gray-400 hover:text-amber-400 transition"
            >
              {volume > 0 ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label="Master Volume"
              className="w-14 sm:w-16 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Reduced Motion Toggle */}
          <button
            onClick={onToggleReducedMotion}
            title={reducedMotion ? 'Enable Motion Effects' : 'Reduce Motion Effects'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-gray-900/90 border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {reducedMotion ? 'Motion: Off' : 'Motion: On'}
          </button>
        </div>
      </header>

      {/* Main Hero & Menu */}
      <main className="relative z-10 w-full max-w-xl flex flex-col items-center justify-center my-auto py-8 text-center">
        {!showInstrumentSelect ? (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                Browser-First Praise Rhythm
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                Play the Rhythm of Praise
              </h2>
              <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto">
                Upload your gospel tracks or play the demo praise hymn. Master strict-timing 4-lane rhythm in Piano or Guitar modes.
              </p>
            </div>

            {/* Menu Choices: Solo Leveling & Multiplayer */}
            <div className="w-full flex flex-col gap-4 mt-2">
              {/* Solo Leveling (Active) */}
              <button
                onClick={() => setShowInstrumentSelect(true)}
                className="group relative w-full p-5 rounded-2xl bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-cyan-600/20 border border-amber-500/40 hover:border-amber-400 transition-all duration-200 text-left glow-gold hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-black shadow-lg">
                      <Flame className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white group-hover:text-amber-300 transition">
                          Solo Leveling
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black uppercase">
                          Ready
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Test your skill. One missed note or bad tap ends the run.
                      </p>
                    </div>
                  </div>
                  <div className="text-amber-400 font-semibold text-sm group-hover:translate-x-1 transition">
                    &rarr;
                  </div>
                </div>
              </button>

              {/* Multiplayer (Coming Soon as specified in GDD) */}
              <div
                aria-disabled="true"
                className="w-full p-5 rounded-2xl bg-gray-900/40 border border-gray-800/80 text-left opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400">
                      <Users className="w-6 h-6 stroke-[2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-gray-300">
                          Multiplayer
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-cyan-400 border border-cyan-500/30 uppercase">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Shared room battles, song voting, and real-time community tournaments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Instrument Selection */
          <div className="w-full flex flex-col items-center gap-6 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Choose Your Instrument
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Both instruments use the exact same 4-lane timing and scoring engine.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Piano Tiles */}
              <button
                onClick={() => onSelectInstrument('piano')}
                className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-gray-900 to-gray-950 border border-cyan-500/30 hover:border-cyan-400 hover:glow-cyan transition duration-200"
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  {/* Piano Icon SVG */}
                  <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="4" x2="7" y2="13" />
                    <line x1="11" y1="4" x2="11" y2="13" />
                    <line x1="15" y1="4" x2="15" y2="13" />
                    <line x1="9" y1="4" x2="9" y2="11" strokeWidth="3" />
                    <line x1="13" y1="4" x2="13" y2="11" strokeWidth="3" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">
                  Piano Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Falling neon keys, crisp contrast, and geometric hit-zone flow.
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-cyan-400 group-hover:underline">
                  Select Piano &rarr;
                </span>
              </button>

              {/* Guitar Tiles */}
              <button
                onClick={() => onSelectInstrument('guitar')}
                className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-gray-900 to-gray-950 border border-amber-500/30 hover:border-amber-400 hover:glow-gold transition duration-200"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  {/* Guitar Icon SVG */}
                  <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 6l4 4" />
                    <path d="M12 8l4 4" />
                    <circle cx="8" cy="16" r="5" />
                    <line x1="12" y1="12" x2="20" y2="4" />
                    <circle cx="8" cy="16" r="2" fill="currentColor" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300">
                  Guitar Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Arcade fretboard perspective, steel string guides, and neon fret glows.
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-amber-400 group-hover:underline">
                  Select Guitar &rarr;
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowInstrumentSelect(false)}
              className="text-xs text-gray-400 hover:text-white transition mt-2"
            >
              &larr; Back to Main Menu
            </button>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-4xl text-center border-t border-gray-900 pt-4 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>PraiseTiles &copy; 2026. Browser-first gospel rhythm platform.</p>
        <p className="text-gray-400">
          Touch or Keyboard: <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-amber-300 font-mono text-[10px]">D</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-amber-300 font-mono text-[10px]">F</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-[10px]">J</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-[10px]">K</kbd>
        </p>
      </footer>
    </div>
  );
};
