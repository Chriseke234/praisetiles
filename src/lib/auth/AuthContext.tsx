'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserProfile,
  PlayerProgress,
  PlayerStats,
  MatchRecord,
  MatchSubmissionResult,
} from '@/types/auth';
import { RunResult } from '@/types/game';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  calculateMatchXp,
  calculateLevelFromXp,
} from '@/config/progression';
import { updateChallengesOnMatch, evaluateAchievements } from '@/lib/progression/challenges';
import { safeSessionStorage } from '@/lib/storage/safeStorage';

interface AuthContextType {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  progress: PlayerProgress | null;
  stats: PlayerStats | null;
  guestMatches: MatchRecord[];
  isGuest: boolean;
  isLoading: boolean;
  isSupabaseAvailable: boolean;
  pendingTransferMatches: MatchRecord[];
  recordMatch: (
    result: RunResult,
    songTitle: string,
    songFingerprint: string
  ) => Promise<MatchSubmissionResult>;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    pass: string,
    username: string,
    displayName: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  transferGuestSession: () => Promise<{ transferredCount: number; error?: string }>;
  dismissTransferPrompt: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_STORAGE_KEY = 'praisetiles_guest_matches_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Initialize guest matches lazily from safeSessionStorage (Safari safe)
  const [guestMatches, setGuestMatches] = useState<MatchRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = safeSessionStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [pendingTransferMatches, setPendingTransferMatches] = useState<MatchRecord[]>([]);

  // If Supabase is not configured, loading starts as false
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured());

  const isSupabaseAvailable = isSupabaseConfigured();

  // Fetch full user data from Supabase
  const fetchUserData = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const [profileRes, progressRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_progress').select('*').eq('user_id', userId).single(),
        supabase.from('player_stats').select('*').eq('user_id', userId).single(),
      ]);

      if (profileRes.data) {
        setProfile({
          id: profileRes.data.id,
          username: profileRes.data.username,
          displayName: profileRes.data.display_name,
          avatarUrl: profileRes.data.avatar_url,
          isPublic: profileRes.data.is_public,
          preferredInstrument: profileRes.data.preferred_instrument ?? 'piano',
          createdAt: profileRes.data.created_at,
          updatedAt: profileRes.data.updated_at,
        });
      }

      if (progressRes.data) {
        setProgress({
          userId: progressRes.data.user_id,
          xp: progressRes.data.xp,
          level: progressRes.data.level,
          gemRank: progressRes.data.gem_rank,
          qualifyingCompletedSongs: progressRes.data.qualifying_completed_songs,
          version: progressRes.data.version,
          updatedAt: progressRes.data.updated_at,
        });
      }

      if (statsRes.data) {
        setStats({
          userId: statsRes.data.user_id,
          totalAttempts: statsRes.data.total_attempts,
          completedSongs: statsRes.data.completed_songs,
          bestScore: statsRes.data.best_score,
          bestAccuracy: Number(statsRes.data.best_accuracy),
          highestCombo: statsRes.data.highest_combo,
          pianoAttempts: statsRes.data.piano_attempts,
          pianoCompleted: statsRes.data.piano_completed,
          pianoBestScore: statsRes.data.piano_best_score,
          guitarAttempts: statsRes.data.guitar_attempts,
          guitarCompleted: statsRes.data.guitar_completed,
          guitarBestScore: statsRes.data.guitar_best_score,
          updatedAt: statsRes.data.updated_at,
        });
      }
    } catch {
      // Non-blocking fetch error
    }
  }, []);

  // Initialize Auth state & Listen for auth changes
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchUserData(session.user.id).finally(() => setIsLoading(false));
      } else {
        setUser(null);
        setProfile(null);
        setProgress(null);
        setStats(null);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        await fetchUserData(session.user.id);
        // Check if there are guest matches from current session to transfer
        try {
          const stored = safeSessionStorage.getItem(GUEST_STORAGE_KEY);
          if (stored) {
            const matches: MatchRecord[] = JSON.parse(stored);
            if (matches.length > 0) {
              setPendingTransferMatches(matches);
            }
          }
        } catch {
          // ignore
        }
      } else {
        setUser(null);
        setProfile(null);
        setProgress(null);
        setStats(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Record a completed or failed match run
  const recordMatch = async (
    result: RunResult,
    songTitle: string,
    songFingerprint: string
  ): Promise<MatchSubmissionResult> => {
    const matchId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const matchRecord: MatchRecord = {
      id: matchId,
      userId: user?.id,
      instrument: result.instrument,
      songTitle,
      songFingerprint,
      score: result.score,
      accuracy: result.accuracy,
      highestCombo: result.highestCombo,
      elapsedTime: result.elapsedTime,
      completed: result.completed,
      failureReason: result.failureReason,
      rulesVersion: '1.0.0',
      createdAt: nowIso,
    };

    const xpEarned = calculateMatchXp(
      result.completed,
      result.accuracy,
      result.highestCombo,
      result.score,
      result.elapsedTime
    );

    // Progression: Update daily/weekly challenges & achievement badges
    try {
      updateChallengesOnMatch(result);
      evaluateAchievements(result, {
        totalSongsPlayed: stats?.totalAttempts,
        highestPerfectStreak: Math.max(stats?.highestPerfectStreak ?? 0, result.highestPerfectStreak ?? 0),
        totalSustainsCompleted: (stats?.totalSustainsCompleted ?? 0) + (result.completedSustainsCount ?? 0),
        playedPiano: result.instrument === 'piano' || (stats?.pianoAttempts ?? 0) > 0,
        playedGuitar: result.instrument === 'guitar' || (stats?.guitarAttempts ?? 0) > 0,
      });
    } catch {}

    // 1. If User is Authenticated and Supabase is configured:
    const supabase = getSupabaseBrowserClient();
    if (user && supabase) {
      try {
        const { data, error } = await supabase.rpc('record_match_result', {
          p_match_id: matchId,
          p_instrument: result.instrument,
          p_song_title: songTitle,
          p_song_fingerprint: songFingerprint,
          p_score: result.score,
          p_accuracy: result.accuracy,
          p_highest_combo: result.highestCombo,
          p_elapsed_time: result.elapsedTime,
          p_completed: result.completed,
          p_failure_reason: result.failureReason,
          p_rules_version: '1.0.0',
        });

        if (error) {
          throw error;
        }

        // Refresh user progression and stats
        await fetchUserData(user.id);

        return {
          status: 'success',
          matchId,
          xpEarned: data?.xp_earned ?? xpEarned,
          xp: data?.xp ?? (progress?.xp ?? 0) + xpEarned,
          level: data?.level ?? (progress?.level ?? 1),
          gemRank: data?.gem_rank ?? (progress?.gemRank ?? 'Quartz'),
          promoted: Boolean(data?.promoted),
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Database error';
        return {
          status: 'error',
          matchId,
          xpEarned,
          xp: (progress?.xp ?? 0) + xpEarned,
          level: progress?.level ?? 1,
          gemRank: progress?.gemRank ?? 'Quartz',
          promoted: false,
          error: errorMsg,
        };
      }
    }

    // 2. Guest Session: Save to temporary session storage
    const updated = [matchRecord, ...guestMatches].slice(0, 50); // keep last 50 matches
    setGuestMatches(updated);
    try {
      safeSessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // Calculate local guest progression for display
    const currentXp = (progress?.xp ?? 0) + xpEarned;
    const currentLevel = calculateLevelFromXp(currentXp);

    return {
      status: 'offline_saved',
      matchId,
      xpEarned,
      xp: currentXp,
      level: currentLevel,
      gemRank: progress?.gemRank ?? 'Quartz',
      promoted: false,
    };
  };

  // Sign In
  const signIn = async (email: string, pass: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured yet. Continuing as guest.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Sign Up
  const signUp = async (email: string, pass: string, username: string, displayName: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured yet. Continuing as guest.' };
    }

    // Normalize username
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          username: normalizedUsername,
          display_name: displayName.trim() || normalizedUsername,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Sign Out
  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setProgress(null);
    setStats(null);
  };

  // Transfer Guest Session Matches to Authenticated Account
  const transferGuestSession = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || pendingTransferMatches.length === 0) {
      setPendingTransferMatches([]);
      return { transferredCount: 0 };
    }

    let transferred = 0;
    try {
      for (const m of pendingTransferMatches) {
        await supabase.rpc('record_match_result', {
          p_match_id: m.id,
          p_instrument: m.instrument,
          p_song_title: m.songTitle,
          p_song_fingerprint: m.songFingerprint,
          p_score: m.score,
          p_accuracy: m.accuracy,
          p_highest_combo: m.highestCombo,
          p_elapsed_time: m.elapsedTime,
          p_completed: m.completed,
          p_failure_reason: m.failureReason,
          p_rules_version: m.rulesVersion,
        });
        transferred++;
      }

      // Clear guest session storage
      safeSessionStorage.removeItem(GUEST_STORAGE_KEY);
      setGuestMatches([]);
      setPendingTransferMatches([]);
      await fetchUserData(user.id);
      return { transferredCount: transferred };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      return { transferredCount: transferred, error: msg };
    }
  };

  const dismissTransferPrompt = () => {
    setPendingTransferMatches([]);
    safeSessionStorage.removeItem(GUEST_STORAGE_KEY);
    setGuestMatches([]);
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        progress,
        stats,
        guestMatches,
        isGuest: !user,
        isLoading,
        isSupabaseAvailable,
        pendingTransferMatches,
        recordMatch,
        signIn,
        signUp,
        signOut,
        transferGuestSession,
        dismissTransferPrompt,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
