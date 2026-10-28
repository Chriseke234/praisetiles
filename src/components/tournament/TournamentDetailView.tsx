'use client';

/**
 * TournamentDetailView — Public detail view for a specific tournament.
 * Features:
 * - Overview banner with real Unsplash cover photo & countdown timer
 * - Registration / Check-in / Withdraw action bar
 * - Tabbed navigation: Bracket, Standings, Rules & Song Pool, Participants, Admin (Organizer only)
 * - Dispute filing modal
 * - SVG icons only, no emojis
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar, Users, Music,
  CheckCircle, AlertTriangle, ArrowLeft, Loader2,
  Send,
} from 'lucide-react';
import {
  Tournament, TournamentBracket, TournamentParticipant, TournamentDispute,
} from '@/types/tournament';
import { DisputeReason } from '@/config/tournament';
import { BracketViewer } from './BracketViewer';
import { OrganizerAdminPanel } from './OrganizerAdminPanel';
import { useTournament } from '@/lib/tournament/TournamentContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { TOURNAMENT_CONFIG } from '@/config/tournament';

interface TournamentDetailViewProps {
  tournamentId: string;
  onBack: () => void;
  onOpenAuth: () => void;
}

type TabType = 'bracket' | 'standings' | 'rules' | 'participants' | 'admin';

export const TournamentDetailView: React.FC<TournamentDetailViewProps> = ({
  tournamentId,
  onBack,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const {
    registerForTournament,
    checkInForTournament,
    withdrawFromTournament,
    fileDispute,
  } = useTournament();

  const [tournament, setTournament]     = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [myParticipant, setMyParticipant] = useState<TournamentParticipant | null>(null);
  const [bracket, setBracket]           = useState<TournamentBracket | null>(null);
  const [disputes, setDisputes]         = useState<TournamentDispute[]>([]);
  const [activeTab, setActiveTab]       = useState<TabType>('bracket');
  const [isLoading, setIsLoading]       = useState(true);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeMatchId, setDisputeMatchId]     = useState('');
  const [disputeReason, setDisputeReason]       = useState<'disconnection' | 'desync' | 'conduct' | 'other'>('disconnection');
  const [disputeDescription, setDisputeDescription] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`);
      if (res.ok) {
        const json = await res.json();
        setTournament(json.tournament);
        setParticipants(json.participants ?? []);
        setMyParticipant(json.myParticipant ?? null);
      }

      const bRes = await fetch(`/api/tournaments/${tournamentId}/bracket`);
      if (bRes.ok) {
        const bJson = await bRes.json();
        setBracket(bJson.bracket ?? null);
      }

      const dRes = await fetch(`/api/tournaments/${tournamentId}/disputes`);
      if (dRes.ok) {
        const dJson = await dRes.json();
        setDisputes(dJson.disputes ?? []);
      }
    } catch {
      // Non-blocking fetch error
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  if (isLoading && !tournament) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-xs uppercase tracking-wider font-semibold">Loading Tournament Arena...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm text-gray-400">Tournament not found.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs font-bold text-white hover:border-gray-700"
        >
          &larr; Back to Tournaments
        </button>
      </div>
    );
  }

  const isOrganizer = user?.id === tournament.organizerId;
  const isRegistered = !!myParticipant && myParticipant.status !== 'withdrawn';
  const isCheckedIn = myParticipant?.status === 'checked_in';

  const handleRegister = async () => {
    if (!user) { onOpenAuth(); return; }
    setIsActionBusy(true);
    setActionError(null);
    const res = await registerForTournament(tournament.id);
    if (!res.success) {
      setActionError(res.error ?? 'Registration failed');
    } else {
      setActionSuccess('Successfully registered!');
      void loadData();
    }
    setIsActionBusy(false);
  };

  const handleCheckIn = async () => {
    if (!user) { onOpenAuth(); return; }
    setIsActionBusy(true);
    setActionError(null);
    const res = await checkInForTournament(tournament.id);
    if (!res.success) {
      setActionError(res.error ?? 'Check-in failed');
    } else {
      setActionSuccess('Checked in! Ready for bracket assignment.');
      void loadData();
    }
    setIsActionBusy(false);
  };

  const handleWithdraw = async () => {
    if (!user) return;
    setIsActionBusy(true);
    setActionError(null);
    const res = await withdrawFromTournament(tournament.id);
    if (!res.success) {
      setActionError(res.error ?? 'Withdrawal failed');
    } else {
      setActionSuccess('Withdrawn from tournament.');
      void loadData();
    }
    setIsActionBusy(false);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeMatchId || !disputeDescription.trim()) return;
    setIsActionBusy(true);
    const res = await fileDispute(tournament.id, disputeMatchId, disputeReason, disputeDescription.trim());
    if (res.success) {
      setShowDisputeModal(false);
      setDisputeDescription('');
      setActionSuccess('Dispute submitted for organizer review.');
      void loadData();
    } else {
      setActionError(res.error ?? 'Failed to file dispute');
    }
    setIsActionBusy(false);
  };

  const startDateFormatted = new Date(tournament.startAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Top Navigation */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
        <span>Back to Tournaments</span>
      </button>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gray-950 border border-gray-800 shadow-2xl">
        <div className="relative h-48 sm:h-64 w-full overflow-hidden">
          <img
            src={tournament.coverImageUrl}
            alt={tournament.title}
            className="w-full h-full object-cover object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f15] via-[#0d0f15]/60 to-transparent" />

          {/* Badges on hero */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black/60 border border-gray-700 text-amber-400 backdrop-blur-md">
              {tournament.capacity}-Player Single Elimination
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black/60 border border-gray-700 text-gray-300 backdrop-blur-md">
              {tournament.status}
            </span>
          </div>

          {/* Title & Metadata */}
          <div className="absolute bottom-4 left-4 right-4 space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
              {tournament.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
              <div className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-cyan-400" />
                <span className="capitalize">{tournament.instrument} Tiles</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Starts {startDateFormatted}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tournament.registeredCount} / {tournament.capacity} Registered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 sm:p-6 bg-gray-900/60 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-gray-400">
              Organizer: <span className="text-white font-bold">{tournament.organizerDisplayName}</span>
            </p>
            <p className="text-[11px] text-gray-500">
              Song Policy: <span className="capitalize">{tournament.songSelectionPolicy.replace('_', ' ')}</span> · Mode: <span className="capitalize">{tournament.roomMode}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isRegistered ? (
              <button
                onClick={handleRegister}
                disabled={isActionBusy || tournament.registeredCount >= tournament.capacity}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition shadow-lg glow-gold disabled:opacity-50"
              >
                {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Now'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {!isCheckedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={isActionBusy}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-black text-xs uppercase tracking-wider transition shadow-lg animate-pulse"
                  >
                    {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In Now'}
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>Checked In</span>
                  </span>
                )}

                {tournament.status !== 'in_progress' && tournament.status !== 'completed' && (
                  <button
                    onClick={handleWithdraw}
                    disabled={isActionBusy}
                    className="px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-rose-500/40 text-gray-400 hover:text-rose-400 text-xs font-semibold transition"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action alerts */}
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('bracket')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'bracket'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Bracket
        </button>

        <button
          onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'standings'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Standings
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'rules'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Rules & Songs
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'participants'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Roster ({participants.length})
        </button>

        {isOrganizer && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'admin'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            Admin Controls
          </button>
        )}
      </div>

      {/* TAB 1: BRACKET */}
      {activeTab === 'bracket' && bracket && (
        <div className="space-y-4">
          <BracketViewer bracket={bracket} onRefresh={loadData} />

          {/* Participant dispute button */}
          {isRegistered && (
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setShowDisputeModal(true)}
                className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-rose-400 text-xs font-semibold transition"
              >
                File Match Dispute
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STANDINGS */}
      {activeTab === 'standings' && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-gray-950/80 border border-gray-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Official Placements
            </h3>
            {participants.filter((p) => p.placement != null).length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Final standings will be published as elimination matches conclude.
              </p>
            ) : (
              <div className="space-y-2">
                {participants
                  .filter((p) => p.placement != null)
                  .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 font-mono font-black text-amber-400">
                          #{p.placement}
                        </span>
                        <span className="font-bold text-white">{p.displayName}</span>
                        <span className="text-[10px] text-gray-500">(@{p.username})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-800 text-gray-300">
                        {p.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RULES & SONG POOL */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gray-950/80 border border-gray-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Conduct & Scoring Rules
            </h3>
            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {tournament.rulesText ||
                '1. Strict Single-Elimination: One missed note or bad tap eliminates the player immediately.\n2. Both participants must use the exact same validated song & rhythm map version.\n3. Tie-break hierarchy: Official Score > Accuracy % > Highest Combo > Sudden Death.\n4. Disconnections are treated according to the tournament forfeit policy.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gray-950/80 border border-gray-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Approved Gospel Song Pool
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TOURNAMENT_CONFIG.APPROVED_SONG_POOL.map((song) => (
                <div
                  key={song.id}
                  className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <Music className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{song.title}</p>
                      <p className="text-[10px] text-gray-400">{song.artist}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">{song.bpm} BPM</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARTICIPANTS ROSTER */}
      {activeTab === 'participants' && (
        <div className="p-5 rounded-2xl bg-gray-950/80 border border-gray-800 space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Registered Competitors ({participants.length} / {tournament.capacity})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] font-bold text-amber-400">
                    {p.displayName[0]}
                  </div>
                  <div>
                    <span className="font-bold text-white">{p.displayName}</span>
                    <p className="text-[10px] text-gray-500">@{p.username} · {p.gemRank}</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    p.status === 'checked_in'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ORGANIZER ADMIN PANEL */}
      {activeTab === 'admin' && isOrganizer && (
        <OrganizerAdminPanel
          tournament={tournament}
          disputes={disputes}
          onRefresh={loadData}
        />
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0d0f15] border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              File Tournament Match Dispute
            </h3>
            <p className="text-xs text-gray-400">
              Disputes are logged in the official tournament audit trail and reviewed by the organizer.
            </p>

            <form onSubmit={handleSubmitDispute} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                  Match
                </label>
                <select
                  value={disputeMatchId}
                  onChange={(e) => setDisputeMatchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                >
                  <option value="">Select affected match...</option>
                  {bracket?.rounds.flatMap((r) => r.matches).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.roundName} (M{m.matchIndexInRound})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                  Reason
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value as DisputeReason)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                >
                  {TOURNAMENT_CONFIG.DISPUTES.REASONS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                  Description of Issue
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Provide precise details of the technical or conduct issue..."
                  required
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-xs text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionBusy}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-black text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isActionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Submit Dispute</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
