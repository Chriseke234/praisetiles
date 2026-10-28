'use client';

/**
 * TournamentHub — Central tournament discovery & competition hub.
 * Features:
 * - Category tabs: Upcoming, Registration Open, Check-In, In Progress, Completed, My Tournaments
 * - Filter bar: Instrument, event type, search
 * - Season overview pill
 * - Create Tournament trigger (for organizers)
 * - Detail view transition
 * - SVG icons only, no emojis
 */

import React, { useState } from 'react';
import {
  Trophy, Search, Plus, Loader2,
  X, RefreshCw,
} from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { TournamentCard } from './TournamentCard';
import { TournamentDetailView } from './TournamentDetailView';
import { TournamentWizardModal } from './TournamentWizardModal';
import { useTournament } from '@/lib/tournament/TournamentContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { InstrumentType } from '@/types/game';

interface TournamentHubProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

type HubCategory =
  | 'all'
  | 'registration_open'
  | 'check_in'
  | 'in_progress'
  | 'completed'
  | 'my_tournaments';

export const TournamentHub: React.FC<TournamentHubProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const {
    tournaments,
    activeSeason,
    isLoading,
    refreshTournaments,
  } = useTournament();

  const [activeCategory, setActiveCategory]     = useState<HubCategory>('all');
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | 'all'>('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showWizard, setShowWizard]             = useState(false);

  if (!isOpen) return null;

  const filteredTournaments = tournaments.filter((t) => {
    // Category match
    if (activeCategory === 'registration_open') {
      if (t.status !== 'registration_open' && t.status !== 'published') return false;
    } else if (activeCategory === 'check_in') {
      if (t.status !== 'check_in') return false;
    } else if (activeCategory === 'in_progress') {
      if (t.status !== 'in_progress' && t.status !== 'bracket_ready') return false;
    } else if (activeCategory === 'completed') {
      if (t.status !== 'completed') return false;
    } else if (activeCategory === 'my_tournaments') {
      if (t.organizerId !== user?.id) return false;
    }

    // Instrument match
    if (instrumentFilter !== 'all' && t.instrument !== instrumentFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-6xl max-h-[94vh] bg-[#090a0f] border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-gray-100">
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center glow-gold shadow-lg">
              <Trophy className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white uppercase tracking-wider">
                  Tournament Arena
                </h1>
                {activeSeason && (
                  <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    {activeSeason.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">Official single-elimination gospel rhythm tournaments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!user) onOpenAuth();
                else setShowWizard(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Host Event</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
              aria-label="Close Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {selectedTournament ? (
            <TournamentDetailView
              tournamentId={selectedTournament.id}
              onBack={() => setSelectedTournament(null)}
              onOpenAuth={onOpenAuth}
            />
          ) : (
            <>
              {/* Category Navigation Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800/80">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {[
                    { id: 'all', label: 'All Events' },
                    { id: 'registration_open', label: 'Registration Open' },
                    { id: 'check_in', label: 'Check-In' },
                    { id: 'in_progress', label: 'Live In-Progress' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'my_tournaments', label: 'My Hosted Events' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveCategory(tab.id as HubCategory)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        activeCategory === tab.id
                          ? 'bg-amber-500 text-black shadow'
                          : 'bg-gray-900/70 border border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => refreshTournaments()}
                  className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
                  title="Refresh Tournaments"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search query input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tournaments by name..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400 transition"
                  />
                </div>

                {/* Instrument filter */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-xs text-gray-500 font-semibold mr-1">Instrument:</span>
                  {(['all', 'piano', 'guitar'] as const).map((inst) => (
                    <button
                      key={inst}
                      onClick={() => setInstrumentFilter(inst)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                        instrumentFilter === inst
                          ? 'bg-gray-800 border border-amber-500/50 text-amber-300'
                          : 'bg-gray-950 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tournament Grid */}
              {isLoading && tournaments.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-xs uppercase tracking-wider font-semibold">Scanning Active Brackets...</p>
                </div>
              ) : filteredTournaments.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <Trophy className="w-10 h-10 mx-auto text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-300">No Tournaments Found</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    There are no scheduled events matching your current filters. Be the first to host an approved praise championship!
                  </p>
                  <button
                    onClick={() => {
                      if (!user) onOpenAuth();
                      else setShowWizard(true);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
                  >
                    Host a Tournament
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTournaments.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onSelect={(tourney) => setSelectedTournament(tourney)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Creation Wizard Modal */}
      <TournamentWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          void refreshTournaments();
        }}
      />
    </div>
  );
};
