'use client';

/**
 * TournamentCard — Visual tournament card.
 * Displays:
 * - Real Unsplash gospel worship cover banner
 * - Instrument & mode badges
 * - Capacity meter & registered player count
 * - Status indicator & countdown timer
 * - SVG icons only, no emojis
 */

import React from 'react';
import {
  Calendar, Music, Flame, ChevronRight,
} from 'lucide-react';
import { Tournament } from '@/types/tournament';

interface TournamentCardProps {
  tournament: Tournament;
  onSelect: (tournament: Tournament) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onSelect }) => {
  const isRegistrationOpen = tournament.status === 'registration_open' || tournament.status === 'published';
  const isCheckInOpen = tournament.status === 'check_in';
  const isInProgress = tournament.status === 'in_progress' || tournament.status === 'bracket_ready';
  const isCompleted = tournament.status === 'completed';
  const isCancelled = tournament.status === 'cancelled';

  const statusLabel =
    isCancelled ? 'Cancelled' :
    isCompleted ? 'Completed' :
    isInProgress ? 'In Progress' :
    isCheckInOpen ? 'Check-In Open' :
    isRegistrationOpen ? 'Registration Open' : tournament.status;

  const statusColor =
    isCancelled ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
    isCompleted ? 'bg-gray-800 text-gray-300 border-gray-700' :
    isInProgress ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse' :
    isCheckInOpen ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  const fillPercentage = Math.min(100, Math.round((tournament.registeredCount / tournament.capacity) * 100));

  const startDateFormatted = new Date(tournament.startAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onSelect(tournament)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0d0f15] border border-gray-800 hover:border-amber-500/50 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-amber-500/5 hover:scale-[1.01]"
    >
      {/* Cover Image Banner */}
      <div className="relative h-36 w-full overflow-hidden bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tournament.coverImageUrl}
          alt={tournament.title}
          className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-70"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f15] via-[#0d0f15]/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
            {statusLabel}
          </span>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-950/80 border border-gray-800 text-gray-300 backdrop-blur-sm">
            {tournament.capacity} Players
          </span>
        </div>

        {/* Instrument & Mode floating pill */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/70 border border-gray-700/80 text-[10px] font-bold text-gray-200 backdrop-blur-md">
            <Music className="w-3 h-3 text-cyan-400" />
            <span className="capitalize">{tournament.instrument}</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/70 border border-gray-700/80 text-[10px] font-bold text-amber-400 backdrop-blur-md">
            <Flame className="w-3 h-3" />
            <span className="capitalize">{tournament.roomMode}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col justify-between flex-1 gap-3">
        <div>
          <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition line-clamp-1">
            {tournament.title}
          </h3>
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
            {tournament.description || 'Single-elimination gospel rhythm tournament. Strict failure rules apply.'}
          </p>
        </div>

        {/* Scheduled Start & Organizer */}
        <div className="space-y-2 pt-2 border-t border-gray-800/60">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{startDateFormatted}</span>
            </div>
            <span className="text-[11px] text-gray-500 truncate max-w-[120px]">
              By {tournament.organizerDisplayName}
            </span>
          </div>

          {/* Capacity Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Roster</span>
              <span className="font-bold text-white">
                {tournament.registeredCount} / {tournament.capacity}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${fillPercentage}%` }}
                className={`h-full rounded-full transition-all duration-300 ${
                  fillPercentage >= 100
                    ? 'bg-rose-500'
                    : fillPercentage >= 75
                    ? 'bg-amber-400'
                    : 'bg-cyan-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-0.5 transition">
          <span>View Tournament</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
