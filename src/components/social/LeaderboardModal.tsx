'use client';

/**
 * LeaderboardModal — Competitive leaderboards for PraiseTiles.
 * 5 tabs:
 * 1. Global Ranked (overall Elo)
 * 2. Weekly Ranked
 * 3. Piano Tiles Ranked
 * 4. Guitar Tiles Ranked
 * 5. Friends Ranked
 * SVG icons only, no emojis.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Trophy, X, Flame, Music, Users, Loader2,
  Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { LeaderboardEntry } from '@/types/social';
import { LeaderboardTabId, SOCIAL_CONFIG } from '@/config/social';
import { useAuth } from '@/lib/auth/AuthContext';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardTabId>('global');
  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const sb = getSupabaseBrowserClient();
      let jwt = '';
      if (sb) {
        const { data } = await sb.auth.getSession();
        jwt = data.session?.access_token ?? '';
      }

      const headers: Record<string, string> = {};
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

      const res = await fetch(`/api/leaderboards?tab=${activeTab}&page=${page}`, { headers });
      if (!res.ok) {
        if (activeTab === 'friends' && res.status === 401) {
          setError('Sign in to view your friends leaderboard');
          setEntries([]);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to load leaderboard data');
      }

      const json = await res.json();
      setEntries(json.entries ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      void fetchLeaderboard();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, fetchLeaderboard]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(total / SOCIAL_CONFIG.LEADERBOARDS.PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#0d0f15] border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Ranked Leaderboards
              </h2>
              <p className="text-[11px] text-gray-400">Competitive ratings &amp; rankings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab Strip */}
        <div className="flex items-center px-6 border-b border-gray-800/80 bg-gray-950/40 overflow-x-auto text-xs font-bold scrollbar-none">
          {SOCIAL_CONFIG.LEADERBOARDS.TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`py-3 px-3.5 border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.id === 'global' && <Trophy className="w-3.5 h-3.5" />}
              {tab.id === 'weekly' && <Calendar className="w-3.5 h-3.5" />}
              {tab.id === 'piano' && <Music className="w-3.5 h-3.5" />}
              {tab.id === 'guitar' && <Flame className="w-3.5 h-3.5" />}
              {tab.id === 'friends' && <Users className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2">
          {error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-xs text-rose-400">{error}</p>
              {activeTab === 'friends' && !user && (
                <button
                  onClick={() => { onClose(); onOpenAuth(); }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
                >
                  Sign In Now
                </button>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500 text-xs">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p>Fetching rankings…</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs italic">
              No ranked matches recorded for this leaderboard yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Header row */}
              <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <span className="col-span-1">#</span>
                <span className="col-span-6">Player</span>
                <span className="col-span-3 text-right">Rating</span>
                <span className="col-span-2 text-right">Win %</span>
              </div>

              {entries.map((entry) => {
                const isTop3 = entry.position <= 3;
                const posColor =
                  entry.position === 1 ? 'text-amber-400' :
                  entry.position === 2 ? 'text-gray-300' :
                  entry.position === 3 ? 'text-amber-600' : 'text-gray-500';

                return (
                  <div
                    key={entry.userId}
                    className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl border transition ${
                      isTop3
                        ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                        : 'bg-gray-900/40 border-gray-800/80 hover:border-gray-700'
                    }`}
                  >
                    <span className={`col-span-1 text-xs font-black ${posColor}`}>
                      {entry.position}
                    </span>

                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {entry.displayName[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {entry.displayName}
                          </span>
                          {entry.provisional && (
                            <span className="text-[9px] font-medium text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded">
                              Prov
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{entry.gemRank}</p>
                      </div>
                    </div>

                    <div className="col-span-3 text-right">
                      <span className="text-xs font-bold text-amber-300 tabular-nums">
                        {entry.rating}
                      </span>
                      <p className="text-[9px] text-gray-500">{entry.rankedWins}W · {entry.rankedMatchesPlayed}M</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="text-xs font-bold text-cyan-400 tabular-nums">
                        {entry.winRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {totalPages > 1 && (
          <footer className="flex items-center justify-between px-6 py-3 border-t border-gray-800/80 bg-gray-950/60 text-xs text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
