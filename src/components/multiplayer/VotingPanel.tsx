'use client';

/**
 * VotingPanel — Players vote on nominated songs.
 * One vote per player per round; change vote anytime before timer ends.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Music } from 'lucide-react';
import { Nomination, Vote, VoteTally } from '@/types/room';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';

interface VotingPanelProps {
  nominations:   Nomination[];
  votes:         Vote[];
  currentUserId: string;
  votingStartedAt?: string | null; // ISO 8601
  onVote:        (nominationId: string) => Promise<boolean>;
  disabled?:     boolean;
}

function buildTally(nominations: Nomination[], votes: Vote[]): VoteTally[] {
  const tally: Record<string, VoteTally> = {};
  for (const n of nominations) {
    tally[n.id] = {
      nominationId: n.id,
      songTitle:    n.songTitle,
      artist:       n.artist ?? null,
      nominatedBy:  n.displayName,
      voteCount:    0,
    };
  }
  for (const v of votes) {
    if (tally[v.nominationId]) tally[v.nominationId].voteCount++;
  }
  return Object.values(tally).sort((a, b) => b.voteCount - a.voteCount);
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
  nominations,
  votes,
  currentUserId,
  votingStartedAt,
  onVote,
  disabled = false,
}) => {
  const [voting, setVoting]      = useState(false);
  const [timeLeft, setTimeLeft]  = useState<number | null>(null);

  const myVote   = votes.find((v) => v.userId === currentUserId);
  const tallies  = buildTally(nominations, votes);

  // Countdown timer
  useEffect(() => {
    if (!votingStartedAt) return;
    const endMs = new Date(votingStartedAt).getTime() + MULTIPLAYER_CONFIG.VOTING.DURATION_MS;
    const tick = () => {
      const remaining = Math.max(0, endMs - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [votingStartedAt]);

  const handleVote = async (nominationId: string) => {
    if (voting || disabled) return;
    setVoting(true);
    await onVote(nominationId);
    setVoting(false);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-white">Vote for a Song</h3>
        {timeLeft !== null && (
          <span className={`ml-auto text-xs font-bold tabular-nums
            ${timeLeft <= 10 ? 'text-rose-400' : 'text-amber-400'}`}>
            {timeLeft}s
          </span>
        )}
      </div>

      <div className="space-y-2">
        {tallies.map((t) => {
          const isSelected = myVote?.nominationId === t.nominationId;
          const totalVotes = votes.length;
          const pct = totalVotes > 0 ? Math.round((t.voteCount / totalVotes) * 100) : 0;

          return (
            <button
              key={t.nominationId}
              onClick={() => handleVote(t.nominationId)}
              disabled={voting || disabled}
              aria-pressed={isSelected}
              className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl border transition
                ${isSelected
                  ? 'border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/40'
                  : 'border-gray-700 bg-gray-900/40 hover:border-amber-500/50 hover:bg-amber-500/5'
                }
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Vote indicator */}
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                {isSelected ? (
                  <CheckCircle className="w-5 h-5 text-amber-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                )}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{t.songTitle}</p>
                <p className="text-xs text-gray-400 truncate">
                  {t.artist ? `${t.artist} · ` : ''}by {t.nominatedBy}
                </p>
                {/* Vote bar */}
                <div className="mt-1.5 h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Vote count */}
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-bold text-white">{t.voteCount}</span>
                <p className="text-[10px] text-gray-500">{pct}%</p>
              </div>
            </button>
          );
        })}

        {tallies.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-6 italic">
            No nominations to vote on yet.
          </p>
        )}
      </div>

      {myVote && (
        <p className="text-xs text-amber-400/70 text-center">
          Your vote is recorded — you can change it before time runs out.
        </p>
      )}
    </div>
  );
};
