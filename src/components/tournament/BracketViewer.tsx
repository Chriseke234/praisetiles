'use client';

/**
 * BracketViewer — Interactive, responsive Single-Elimination Tournament Bracket.
 * Supports 4, 8, and 16-player brackets.
 * Displays match cards, participant seeds, scores, winner highlights,
 * and direct match room join flow.
 */

import React from 'react';
import {
  Trophy, Play, Check, Clock,
} from 'lucide-react';
import { TournamentBracket } from '@/types/tournament';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface BracketViewerProps {
  bracket: TournamentBracket;
  onRefresh?: () => void;
}

export const BracketViewer: React.FC<BracketViewerProps> = ({ bracket }) => {
  const { user } = useAuth();
  const router = useRouter();

  if (!bracket.rounds || bracket.rounds.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 space-y-2">
        <Clock className="w-8 h-8 mx-auto text-gray-600 animate-pulse" />
        <p className="text-sm font-semibold">Bracket has not been generated yet.</p>
        <p className="text-xs text-gray-400">
          The bracket will be finalized automatically once check-in closes.
        </p>
      </div>
    );
  }

  const handleJoinMatchRoom = (inviteCode: string) => {
    router.push(`/room/${inviteCode}`);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Champion Banner if resolved */}
      {bracket.champion && (
        <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border border-amber-500/40 flex items-center justify-between shadow-xl glow-gold">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black shadow">
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Tournament Champion
              </p>
              <h3 className="text-lg font-black text-white">
                {bracket.champion.displayName}
              </h3>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500 text-black font-black text-xs uppercase tracking-wider">
            1st Place
          </span>
        </div>
      )}

      {/* Bracket Columns Scroll Container */}
      <div className="w-full overflow-x-auto pb-6 scrollbar-thin">
        <div className="flex items-stretch gap-6 sm:gap-8 min-w-[720px] lg:min-w-full justify-between">
          {bracket.rounds.map((round) => (
            <div key={round.roundIndex} className="flex-1 flex flex-col min-w-[220px]">
              {/* Round Header */}
              <div className="text-center pb-3 border-b border-gray-800/80 mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  {round.roundName}
                </span>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {round.matches.length} {round.matches.length === 1 ? 'Match' : 'Matches'}
                </p>
              </div>

              {/* Match Nodes */}
              <div className="flex flex-col justify-around flex-1 gap-4">
                {round.matches.map((match) => {
                  const isUserInMatch =
                    user &&
                    (match.participant1?.userId === user.id || match.participant2?.userId === user.id);

                  const isP1Winner =
                    match.winnerParticipantId &&
                    match.participant1?.id === match.winnerParticipantId;
                  const isP2Winner =
                    match.winnerParticipantId &&
                    match.participant2?.id === match.winnerParticipantId;

                  const canJoin =
                    (match.status === 'ready' || match.status === 'playing') &&
                    match.roomInviteCode &&
                    isUserInMatch;

                  return (
                    <div
                      key={match.id}
                      className={`relative flex flex-col justify-between p-3 rounded-2xl bg-gray-900/70 border transition shadow-lg ${
                        isUserInMatch
                          ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
                          : match.status === 'completed'
                          ? 'border-gray-800'
                          : 'border-gray-800/90'
                      }`}
                    >
                      {/* Match Status Bar */}
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2 pb-1.5 border-b border-gray-800/50">
                        <span className="font-semibold text-gray-400 truncate">
                          M{match.matchIndexInRound} · {match.roundName}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            match.status === 'completed'
                              ? 'text-gray-400 bg-gray-800'
                              : match.status === 'ready'
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 animate-pulse'
                              : match.status === 'disputed'
                              ? 'text-rose-400 bg-rose-500/10 border border-rose-500/30'
                              : 'text-gray-500 bg-gray-950'
                          }`}
                        >
                          {match.status}
                        </span>
                      </div>

                      {/* Participant 1 Slot */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl text-xs transition mb-1 ${
                          isP1Winner
                            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                            : match.participant1
                            ? 'bg-gray-950/60 text-gray-200 border border-gray-800/40'
                            : 'bg-gray-950/30 text-gray-500 border border-dashed border-gray-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {match.participant1?.seed && (
                            <span className="text-[10px] font-mono text-gray-500">
                              #{match.participant1.seed}
                            </span>
                          )}
                          <span className="font-bold truncate">
                            {match.participant1?.displayName ?? 'TBD'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-right shrink-0">
                          {match.status === 'completed' && match.score1 != null && (
                            <span className="font-mono text-[11px] font-bold">
                              {match.score1.toLocaleString()}
                            </span>
                          )}
                          {isP1Winner && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Participant 2 Slot */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl text-xs transition ${
                          isP2Winner
                            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                            : match.participant2
                            ? 'bg-gray-950/60 text-gray-200 border border-gray-800/40'
                            : 'bg-gray-950/30 text-gray-500 border border-dashed border-gray-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {match.participant2?.seed && (
                            <span className="text-[10px] font-mono text-gray-500">
                              #{match.participant2.seed}
                            </span>
                          )}
                          <span className="font-bold truncate">
                            {match.participant2?.displayName ?? 'TBD'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-right shrink-0">
                          {match.status === 'completed' && match.score2 != null && (
                            <span className="font-mono text-[11px] font-bold">
                              {match.score2.toLocaleString()}
                            </span>
                          )}
                          {isP2Winner && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Join Room CTA for active match participant */}
                      {canJoin && (
                        <button
                          onClick={() => handleJoinMatchRoom(match.roomInviteCode!)}
                          className="mt-2 w-full py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition"
                        >
                          <Play className="w-3 h-3 fill-black" />
                          <span>Enter Match Room</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
