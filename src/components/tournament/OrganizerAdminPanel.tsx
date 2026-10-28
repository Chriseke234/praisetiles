'use client';

/**
 * OrganizerAdminPanel — Control console for tournament organizers & admins.
 * Supports:
 * - Opening / closing registration
 * - Starting check-in & freezing bracket
 * - Generating single-elimination bracket
 * - Resolving disputes
 * - Cancelling tournament with recorded reason
 */

import React, { useState } from 'react';
import {
  ShieldAlert, Play, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Loader2,
} from 'lucide-react';
import { Tournament, TournamentDispute } from '@/types/tournament';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface OrganizerAdminPanelProps {
  tournament: Tournament;
  disputes: TournamentDispute[];
  onRefresh: () => void;
}

export const OrganizerAdminPanel: React.FC<OrganizerAdminPanelProps> = ({
  tournament,
  disputes,
  onRefresh,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<TournamentDispute | null>(null);
  const [disputeNotes, setDisputeNotes] = useState('');

  const getJwt = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token ?? null;
  };

  const handleAction = async (action: string) => {
    setIsLoading(true);
    setActionError(null);
    try {
      const jwt = await getJwt();
      if (!jwt) throw new Error('Authentication required');

      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          action,
          cancellationReason: action === 'cancel' ? cancelReason : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error executing action');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBracket = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const jwt = await getJwt();
      if (!jwt) throw new Error('Authentication required');

      const res = await fetch(`/api/tournaments/${tournament.id}/bracket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate bracket');
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error generating bracket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveDispute = async (status: 'upheld' | 'rejected') => {
    if (!selectedDispute) return;
    setIsLoading(true);
    try {
      const jwt = await getJwt();
      if (!jwt) throw new Error('Authentication required');

      const res = await fetch(`/api/tournaments/${tournament.id}/disputes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          status,
          resolutionNotes: disputeNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to resolve dispute');

      setSelectedDispute(null);
      setDisputeNotes('');
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error resolving dispute');
    } finally {
      setIsLoading(false);
    }
  };

  if (tournament.organizerId !== user?.id) {
    return null;
  }

  return (
    <div className="space-y-6 p-6 rounded-2xl bg-gray-950/80 border border-gray-800">
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Organizer Control Panel
            </h3>
            <p className="text-xs text-gray-400">Manage rounds, bracket, and participant disputes</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Lifecycle Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {tournament.status === 'published' && (
          <button
            onClick={() => handleAction('open_registration')}
            disabled={isLoading}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-xs font-bold transition flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Open Registration</span>
          </button>
        )}

        {(tournament.status === 'registration_open' || tournament.status === 'published') && (
          <button
            onClick={() => handleAction('start_check_in')}
            disabled={isLoading}
            className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-300 text-xs font-bold transition flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Start Check-In Phase</span>
          </button>
        )}

        {tournament.status === 'check_in' && (
          <button
            onClick={handleGenerateBracket}
            disabled={isLoading}
            className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-black" />}
            <span>Freeze & Generate Bracket</span>
          </button>
        )}

        {tournament.status === 'in_progress' && (
          <button
            onClick={() => handleAction('pause')}
            disabled={isLoading}
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Pause Tournament</span>
          </button>
        )}

        {tournament.status === 'paused' && (
          <button
            onClick={() => handleAction('resume')}
            disabled={isLoading}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Resume Tournament</span>
          </button>
        )}

        {tournament.status !== 'completed' && tournament.status !== 'cancelled' && (
          <button
            onClick={() => setShowCancelPrompt(true)}
            disabled={isLoading}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 text-xs font-bold transition flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel Tournament</span>
          </button>
        )}
      </div>

      {/* Cancellation Reason Modal Prompt */}
      {showCancelPrompt && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <h4 className="text-xs font-bold text-rose-200">Confirm Tournament Cancellation</h4>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (e.g. minimum player count not reached)..."
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none focus:border-rose-400"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCancelPrompt(false)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-300 hover:text-white"
            >
              Back
            </button>
            <button
              onClick={() => {
                setShowCancelPrompt(false);
                void handleAction('cancel');
              }}
              disabled={!cancelReason.trim()}
              className="px-3 py-1.5 rounded-lg bg-rose-500 text-xs font-bold text-black disabled:opacity-50"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      )}

      {/* Disputes Review Section */}
      <div className="pt-4 border-t border-gray-800/80 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Participant Disputes ({disputes.filter((d) => d.status === 'pending').length} Pending)
        </h4>

        {disputes.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No disputes filed for this tournament.</p>
        ) : (
          <div className="space-y-2">
            {disputes.map((disp) => (
              <div
                key={disp.id}
                className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between text-xs gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{disp.filedByDisplayName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-800 text-gray-300">
                      {disp.reason}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        disp.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : disp.status === 'upheld'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {disp.status}
                    </span>
                  </div>
                  <p className="text-gray-400 mt-1 line-clamp-1">{disp.description}</p>
                </div>

                {disp.status === 'pending' && (
                  <button
                    onClick={() => setSelectedDispute(disp)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shrink-0"
                  >
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Review Dialog */}
      {selectedDispute && (
        <div className="p-4 rounded-2xl bg-gray-900 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-300">
              Review Dispute filed by {selectedDispute.filedByDisplayName}
            </h4>
            <button
              onClick={() => setSelectedDispute(null)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-gray-300 bg-gray-950 p-3 rounded-xl border border-gray-800">
            {selectedDispute.description}
          </p>
          <input
            type="text"
            value={disputeNotes}
            onChange={(e) => setDisputeNotes(e.target.value)}
            placeholder="Official resolution rationale..."
            className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => void handleResolveDispute('rejected')}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-rose-300 hover:bg-rose-950 text-xs font-bold transition"
            >
              Reject Dispute
            </button>
            <button
              onClick={() => void handleResolveDispute('upheld')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition"
            >
              Uphold Dispute
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
