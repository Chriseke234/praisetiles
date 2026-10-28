'use client';

/**
 * SocialContext — Phase 4 Social, Quick Play & Presence State Management
 *
 * Provides:
 * - Realtime presence tracking (online, in_lobby, in_match)
 * - Friends list, incoming & outgoing friend requests
 * - In-app room invitations notifications
 * - Quick Play queue state management
 * - Block & Report actions
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Friendship,
  RoomInvitation,
  UserBlock,
  QueueStatus,
  RoomMode,
} from '@/types/social';
import { InstrumentType } from '@/types/game';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SOCIAL_CONFIG } from '@/config/social';

interface SocialContextType {
  friends: Friendship[];
  invitations: RoomInvitation[];
  blocks: UserBlock[];
  queueStatus: QueueStatus | 'idle';
  matchedInviteCode: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  refreshSocialData: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  acceptFriendRequest: (friendshipId: string) => Promise<boolean>;
  rejectFriendRequest: (friendshipId: string) => Promise<boolean>;
  removeFriend: (targetUserId: string) => Promise<boolean>;
  blockUser: (targetUserId: string) => Promise<boolean>;
  unblockUser: (targetUserId: string) => Promise<boolean>;
  sendRoomInvitation: (receiverId: string, roomId: string, inviteCode: string) => Promise<boolean>;
  respondInvitation: (invitationId: string, action: 'accept' | 'decline') => Promise<string | null>;
  startQuickPlay: (mode: RoomMode, instrument: InstrumentType) => Promise<boolean>;
  cancelQuickPlay: () => Promise<boolean>;
  clearError: () => void;
}

const SocialContext = createContext<SocialContextType | null>(null);

export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [friends, setFriends]                     = useState<Friendship[]>([]);
  const [invitations, setInvitations]             = useState<RoomInvitation[]>([]);
  const [blocks, setBlocks]                       = useState<UserBlock[]>([]);
  const [queueStatus, setQueueStatus]             = useState<QueueStatus | 'idle'>('idle');
  const [matchedInviteCode, setMatchedInviteCode] = useState<string | null>(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getJwt = useCallback(async (): Promise<string | null> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Friends, Invitations, Blocks
  // ---------------------------------------------------------------------------
  const refreshSocialData = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setInvitations([]);
      setBlocks([]);
      return;
    }

    const jwt = await getJwt();
    if (!jwt) return;

    try {
      const [friendsRes, invitesRes, blocksRes] = await Promise.all([
        fetch('/api/social/friends', { headers: { Authorization: `Bearer ${jwt}` } }),
        fetch('/api/social/invite', { headers: { Authorization: `Bearer ${jwt}` } }),
        fetch('/api/social/block', { headers: { Authorization: `Bearer ${jwt}` } }),
      ]);

      if (friendsRes.ok) {
        const json = await friendsRes.json();
        setFriends(json.friendships ?? []);
      }
      if (invitesRes.ok) {
        const json = await invitesRes.json();
        setInvitations(json.invitations ?? []);
      }
      if (blocksRes.ok) {
        const json = await blocksRes.json();
        setBlocks(json.blocks ?? []);
      }
    } catch {
      // Non-blocking fetch error
    }
  }, [user, getJwt]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshSocialData();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshSocialData]);

  // ---------------------------------------------------------------------------
  // Quick Play Queue polling & heartbeat
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (queueStatus !== 'queued') {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    heartbeatRef.current = setInterval(async () => {
      const jwt = await getJwt();
      if (!jwt) return;

      try {
        const res = await fetch('/api/matchmaking/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ action: 'status' }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.status === 'matched') {
            setQueueStatus('matched');
            setMatchedInviteCode(json.matchedInviteCode ?? null);
          } else if (json.status === 'not_queued' || json.status === 'cancelled') {
            setQueueStatus('idle');
          }
        }
      } catch {
        // Non-blocking status check error
      }
    }, SOCIAL_CONFIG.MATCHMAKING.HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [queueStatus, getJwt]);

  // ---------------------------------------------------------------------------
  // Social Actions
  // ---------------------------------------------------------------------------
  const sendFriendRequest = async (targetUserId: string) => {
    const jwt = await getJwt();
    if (!jwt) return { success: false, error: 'Sign in required' };

    try {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'request', targetUserId }),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error };
      await refreshSocialData();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Error' };
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'accept', friendshipId }),
      });
      if (res.ok) {
        await refreshSocialData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'reject', friendshipId }),
      });
      if (res.ok) {
        await refreshSocialData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const removeFriend = async (targetUserId: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'remove', targetUserId }),
      });
      if (res.ok) {
        await refreshSocialData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const blockUser = async (targetUserId: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'block', targetUserId }),
      });
      if (res.ok) {
        await refreshSocialData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const unblockUser = async (targetUserId: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'unblock', targetUserId }),
      });
      if (res.ok) {
        await refreshSocialData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const sendRoomInvitation = async (receiverId: string, roomId: string, inviteCode: string) => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      const res = await fetch('/api/social/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'send', receiverId, roomId, inviteCode }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const respondInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    const jwt = await getJwt();
    if (!jwt) return null;

    try {
      const res = await fetch('/api/social/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action, invitationId }),
      });
      if (res.ok) {
        const inv = invitations.find((i) => i.id === invitationId);
        await refreshSocialData();
        return action === 'accept' ? (inv?.inviteCode ?? null) : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Quick Play Actions
  // ---------------------------------------------------------------------------
  const startQuickPlay = async (mode: RoomMode, instrument: InstrumentType) => {
    setIsLoading(true);
    setError(null);
    const jwt = await getJwt();
    if (!jwt) {
      setError('Please sign in to join Quick Play queues');
      setIsLoading(false);
      return false;
    }

    try {
      const res = await fetch('/api/matchmaking/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ action: 'queue', mode, instrument }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Queue entry failed');
        setIsLoading(false);
        return false;
      }

      if (json.status === 'matched') {
        setQueueStatus('matched');
        setMatchedInviteCode(json.matchedInviteCode);
      } else {
        setQueueStatus('queued');
      }
      setIsLoading(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Matchmaking error');
      setIsLoading(false);
      return false;
    }
  };

  const cancelQuickPlay = async () => {
    const jwt = await getJwt();
    if (!jwt) return false;

    try {
      await fetch('/api/matchmaking/queue', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setQueueStatus('idle');
      setMatchedInviteCode(null);
      return true;
    } catch {
      return false;
    }
  };

  const clearError = () => setError(null);

  return (
    <SocialContext.Provider
      value={{
        friends,
        invitations,
        blocks,
        queueStatus,
        matchedInviteCode,
        isLoading,
        error,
        refreshSocialData,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        blockUser,
        unblockUser,
        sendRoomInvitation,
        respondInvitation,
        startQuickPlay,
        cancelQuickPlay,
        clearError,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = () => {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within a SocialProvider');
  return ctx;
};
