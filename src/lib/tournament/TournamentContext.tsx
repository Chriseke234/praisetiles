'use client';

/**
 * TournamentContext — Client state management for Tournaments, Seasons,
 * In-App Notifications, Registration, Check-in and Disputes.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Tournament, Season, InAppNotification } from '@/types/tournament';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface TournamentContextType {
  tournaments: Tournament[];
  activeSeason: Season | null;
  notifications: InAppNotification[];
  unreadNotificationCount: number;
  isLoading: boolean;
  refreshTournaments: (filters?: Record<string, string>) => Promise<void>;
  refreshSeason: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id?: string, markAll?: boolean) => Promise<void>;
  registerForTournament: (tournamentId: string) => Promise<{ success: boolean; error?: string }>;
  checkInForTournament: (tournamentId: string) => Promise<{ success: boolean; error?: string }>;
  withdrawFromTournament: (tournamentId: string) => Promise<{ success: boolean; error?: string }>;
  fileDispute: (tournamentId: string, matchId: string, reason: string, description: string) => Promise<{ success: boolean; error?: string }>;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [tournaments, setTournaments]     = useState<Tournament[]>([]);
  const [activeSeason, setActiveSeason]   = useState<Season | null>(null);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading]         = useState(false);

  const getJwt = useCallback(async (): Promise<string | null> => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Tournaments
  // ---------------------------------------------------------------------------
  const refreshTournaments = useCallback(async (filters?: Record<string, string>) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(filters ?? {});
      const res = await fetch(`/api/tournaments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTournaments(json.tournaments ?? []);
      }
    } catch {
      // Non-blocking fetch error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Season
  // ---------------------------------------------------------------------------
  const refreshSeason = useCallback(async () => {
    try {
      const res = await fetch('/api/seasons');
      if (res.ok) {
        const json = await res.json();
        setActiveSeason(json.season ?? null);
      }
    } catch {
      // Non-blocking fetch error
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Notifications
  // ---------------------------------------------------------------------------
  const refreshNotifications = useCallback(async () => {
    const jwt = await getJwt();
    if (!jwt) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications ?? []);
      }
    } catch {
      // Non-blocking fetch error
    }
  }, [getJwt]);

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshTournaments();
      void refreshSeason();
      if (user) {
        void refreshNotifications();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [user, refreshTournaments, refreshSeason, refreshNotifications]);

  // ---------------------------------------------------------------------------
  // Mark Notification Read
  // ---------------------------------------------------------------------------
  const markNotificationRead = useCallback(async (id?: string, markAll = false) => {
    const jwt = await getJwt();
    if (!jwt) return;

    setNotifications((prev) =>
      prev.map((n) => {
        if (markAll || n.id === id) return { ...n, isRead: true };
        return n;
      })
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ notificationId: id, markAllRead: markAll }),
      });
    } catch {
      // Ignore background network error
    }
  }, [getJwt]);

  // ---------------------------------------------------------------------------
  // Registration Action
  // ---------------------------------------------------------------------------
  const registerForTournament = useCallback(async (tournamentId: string) => {
    const jwt = await getJwt();
    if (!jwt) return { success: false, error: 'Sign in required' };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error ?? 'Registration failed' };

      await refreshTournaments();
      await refreshNotifications();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [getJwt, refreshTournaments, refreshNotifications]);

  // ---------------------------------------------------------------------------
  // Check-In Action
  // ---------------------------------------------------------------------------
  const checkInForTournament = useCallback(async (tournamentId: string) => {
    const jwt = await getJwt();
    if (!jwt) return { success: false, error: 'Sign in required' };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error ?? 'Check-in failed' };

      await refreshTournaments();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [getJwt, refreshTournaments]);

  // ---------------------------------------------------------------------------
  // Withdraw Action
  // ---------------------------------------------------------------------------
  const withdrawFromTournament = useCallback(async (tournamentId: string) => {
    const jwt = await getJwt();
    if (!jwt) return { success: false, error: 'Sign in required' };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error ?? 'Withdrawal failed' };

      await refreshTournaments();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [getJwt, refreshTournaments]);

  // ---------------------------------------------------------------------------
  // Dispute Action
  // ---------------------------------------------------------------------------
  const fileDispute = useCallback(async (tournamentId: string, matchId: string, reason: string, description: string) => {
    const jwt = await getJwt();
    if (!jwt) return { success: false, error: 'Sign in required' };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/disputes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ matchId, reason, description }),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error ?? 'Filing dispute failed' };

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, [getJwt]);

  const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        activeSeason,
        notifications,
        unreadNotificationCount,
        isLoading,
        refreshTournaments,
        refreshSeason,
        refreshNotifications,
        markNotificationRead,
        registerForTournament,
        checkInForTournament,
        withdrawFromTournament,
        fileDispute,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = (): TournamentContextType => {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
};
