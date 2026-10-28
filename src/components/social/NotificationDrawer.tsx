'use client';

/**
 * NotificationDrawer — In-App Notification Center.
 * Displays real-time tournament alerts, match assignments, dispute updates, and unlocked achievements.
 * SVG icons only, no emojis.
 */

import React from 'react';
import {
  Bell, X, Award, Flame, Trophy, Calendar, ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { InAppNotification } from '@/types/tournament';
import { useTournament } from '@/lib/tournament/TournamentContext';
import { useRouter } from 'next/navigation';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { notifications, markNotificationRead, unreadNotificationCount } = useTournament();

  if (!isOpen) return null;

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    if (notif.linkUrl) {
      onClose();
      router.push(notif.linkUrl);
    }
  };

  const getIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'achievement':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'match':
        return <Flame className="w-4 h-4 text-cyan-400" />;
      case 'registration':
      case 'checkin':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'dispute':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <Trophy className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm h-full bg-[#0d0f15] border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80 bg-gray-950/70">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Notifications
            </h3>
            {unreadNotificationCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {unreadNotificationCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadNotificationCount > 0 && (
              <button
                onClick={() => markNotificationRead(undefined, true)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded-lg hover:bg-gray-900 transition"
              >
                Mark all read
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-gray-500 space-y-2">
              <Bell className="w-8 h-8 mx-auto text-gray-600 opacity-50" />
              <p className="text-xs">No notifications yet.</p>
              <p className="text-[10px] text-gray-600">
                Tournament updates, match calls, and achievements will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                  notif.isRead
                    ? 'bg-gray-950/40 border-gray-800/60 opacity-80 hover:opacity-100 hover:border-gray-700'
                    : 'bg-gray-900/80 border-amber-500/30 hover:border-amber-500/60 shadow-md'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                    <span className="text-[9px] text-gray-500 shrink-0">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-300 mt-0.5 leading-snug line-clamp-2">
                    {notif.message}
                  </p>

                  {notif.linkUrl && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <span>View details</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
