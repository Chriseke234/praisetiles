'use client';

/**
 * RoomContext — Phase 3 Multiplayer Room State Management
 *
 * Manages:
 *  - Full room state fetched from Supabase
 *  - Supabase Realtime channel (Postgres Changes + Presence + Broadcast)
 *  - Actions: create room, join room, leave room, nominate, vote,
 *             upload audio, submit map, toggle ready, finalize match
 *
 * DESIGN NOTES:
 *  - Service-role key is NEVER used here (browser code)
 *  - All privileged mutations go through SECURITY DEFINER RPCs or server API routes
 *  - Score events are broadcast every ~2s, not per-tap
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  RoomState,
  RoomStatus,
  RoomParticipant,
  Nomination,
  Vote,
  RoomMatch,
  MatchParticipant,
  OpponentSnapshot,
  ScoreUpdatePayload,
  PlayerEliminatedPayload,
  MatchStartPayload,
  HostChangedPayload,
  FinalizeMatchRequest,
} from '@/types/room';
import { InstrumentType, RhythmMap, ScoreState } from '@/types/game';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface RoomContextType {
  /** Full room state, null when not in a room. */
  roomState: RoomState | null;
  /** Ephemeral opponent snapshots (not persisted). */
  opponents: OpponentSnapshot[];
  /** Whether an async operation is in progress. */
  isLoading: boolean;
  /** Last error message, cleared on next action. */
  error: string | null;

  // -- Actions --
  createRoom:    (instrument: InstrumentType) => Promise<{ inviteCode: string } | null>;
  joinRoom:      (inviteCode: string)         => Promise<boolean>;
  leaveRoom:     ()                           => Promise<void>;
  nominate:      (songTitle: string, artist?: string) => Promise<boolean>;
  vote:          (nominationId: string)       => Promise<boolean>;
  setReady:      (ready: boolean)             => Promise<boolean>;
  submitMap:     (map: RhythmMap, checksum: string) => Promise<{ matchId: string; scheduledStartAt: string } | null>;
  broadcastScore:(scoreState: ScoreState, notesHit: number, total: number) => void;
  broadcastEliminated: (payload: PlayerEliminatedPayload) => void;
  finalizeMatch: (req: FinalizeMatchRequest) => Promise<{ placement: number } | null>;
  clearError:    ()                           => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

// ---------------------------------------------------------------------------
// Helper to build a blank room state skeleton
// ---------------------------------------------------------------------------
function buildBlankRoomState(partial: Partial<RoomState>): RoomState {
  return {
    id:                '',
    inviteCode:        '',
    hostId:            '',
    status:            'waiting',
    instrument:        'piano',
    maxParticipants:   MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS,
    songTitle:         null,
    songFingerprint:   null,
    mapVersion:        null,
    mapChecksum:       null,
    scheduledStartAt:  null,
    audioStoragePath:  null,
    audioExpiresAt:    null,
    expiresAt:         null,
    createdAt:         '',
    updatedAt:         '',
    participants:      [],
    nominations:       [],
    votes:             [],
    currentMatch:      null,
    matchResults:      [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomState, setRoomState]   = useState<RoomState | null>(null);
  const [opponents, setOpponents]   = useState<OpponentSnapshot[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const channelRef   = useRef<RealtimeChannel | null>(null);
  const roomIdRef    = useRef<string | null>(null);
  const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch full room state from DB
  // ---------------------------------------------------------------------------
  const fetchRoomState = useCallback(async (roomId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const [roomRes, partRes, nomRes, voteRes, matchRes] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_participants').select('*, profiles(display_name, avatar_url, player_progress(gem_rank))').eq('room_id', roomId),
      supabase.from('nominations').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      supabase.from('votes').select('*').eq('room_id', roomId),
      supabase.from('room_matches').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1),
    ]);

    if (roomRes.error || !roomRes.data) return;

    const r = roomRes.data;

    // Map participants
    const participants: RoomParticipant[] = (partRes.data ?? []).map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prof = (p as any).profiles;
      return {
        userId:      p.user_id,
        displayName: prof?.display_name ?? 'Player',
        avatarUrl:   prof?.avatar_url ?? null,
        gemRank:     prof?.player_progress?.gem_rank ?? 'Quartz',
        isHost:      p.is_host,
        isReady:     p.is_ready,
        isConnected: p.is_connected,
        joinedAt:    p.joined_at,
      };
    });

    // Map nominations
    const nominations: Nomination[] = (nomRes.data ?? []).map((n) => ({
      id:          n.id,
      roomId:      n.room_id,
      userId:      n.user_id,
      displayName: participants.find((p) => p.userId === n.user_id)?.displayName ?? 'Player',
      songTitle:   n.song_title,
      artist:      n.artist ?? null,
      createdAt:   n.created_at,
    }));

    // Map votes
    const votes: Vote[] = (voteRes.data ?? []).map((v) => ({
      id:           v.id,
      roomId:       v.room_id,
      nominationId: v.nomination_id,
      userId:       v.user_id,
      createdAt:    v.created_at,
    }));

    // Map current match
    let currentMatch: RoomMatch | null = null;
    let matchResults: MatchParticipant[] = [];
    if (matchRes.data && matchRes.data.length > 0) {
      const m = matchRes.data[0];
      currentMatch = {
        id:               m.id,
        roomId:           m.room_id,
        mapJson:          m.map_json as RhythmMap,
        mapChecksum:      m.map_checksum,
        songTitle:        m.song_title,
        songFingerprint:  m.song_fingerprint,
        instrument:       m.instrument as InstrumentType,
        scheduledStartAt: m.scheduled_start_at,
        completedAt:      m.completed_at,
        status:           m.status,
        isCasual:         m.is_casual,
        createdAt:        m.created_at,
      };

      // Fetch match participants
      const { data: mpData } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', m.id);

      matchResults = (mpData ?? []).map((mp) => ({
        matchId:       mp.match_id,
        userId:        mp.user_id,
        displayName:   participants.find((p) => p.userId === mp.user_id)?.displayName ?? 'Player',
        score:         mp.score,
        accuracy:      Number(mp.accuracy),
        highestCombo:  mp.highest_combo,
        completed:     mp.completed,
        eliminatedAt:  mp.eliminated_at,
        placement:     mp.placement,
        failureReason: mp.failure_reason,
        submittedAt:   mp.submitted_at,
      }));
    }

    setRoomState(buildBlankRoomState({
      id:               r.id,
      inviteCode:       r.invite_code,
      hostId:           r.host_id,
      status:           r.status as RoomStatus,
      instrument:       r.instrument as InstrumentType,
      maxParticipants:  r.max_participants,
      songTitle:        r.song_title,
      songFingerprint:  r.song_fingerprint,
      mapVersion:       r.map_version,
      mapChecksum:      r.map_checksum,
      scheduledStartAt: r.scheduled_start_at,
      audioStoragePath: r.audio_storage_path,
      audioExpiresAt:   r.audio_expires_at,
      expiresAt:        r.expires_at,
      createdAt:        r.created_at,
      updatedAt:        r.updated_at,
      participants,
      nominations,
      votes,
      currentMatch,
      matchResults,
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Subscribe to Realtime changes for a room
  // ---------------------------------------------------------------------------
  const subscribeToRoom = useCallback((roomId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = MULTIPLAYER_CONFIG.REALTIME.CHANNEL_TEMPLATE.replace('{roomId}', roomId);

    const channel = supabase.channel(channelName, {
      config: { presence: { key: roomId } },
    });

    // -- Postgres Changes --
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => { fetchRoomState(roomId); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => { fetchRoomState(roomId); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nominations', filter: `room_id=eq.${roomId}` },
        () => { fetchRoomState(roomId); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        () => { fetchRoomState(roomId); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_matches', filter: `room_id=eq.${roomId}` },
        () => { fetchRoomState(roomId); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants' },
        () => { fetchRoomState(roomId); }
      );

    // -- Broadcast: score_update from opponents --
    channel.on('broadcast', { event: MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.SCORE_UPDATE },
      ({ payload }: { payload: ScoreUpdatePayload }) => {
        setOpponents((prev) => {
          const existing = prev.find((o) => o.userId === payload.userId);
          const updated: OpponentSnapshot = {
            userId:        payload.userId,
            displayName:   existing?.displayName ?? 'Player',
            score:         payload.score,
            combo:         payload.combo,
            accuracy:      payload.accuracy,
            isEliminated:  existing?.isEliminated ?? false,
            lastUpdatedAt: payload.timestamp,
          };
          return prev.some((o) => o.userId === payload.userId)
            ? prev.map((o) => o.userId === payload.userId ? updated : o)
            : [...prev, updated];
        });
      }
    );

    // -- Broadcast: player_eliminated --
    channel.on('broadcast', { event: MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.PLAYER_ELIMINATED },
      ({ payload }: { payload: PlayerEliminatedPayload }) => {
        setOpponents((prev) =>
          prev.map((o) =>
            o.userId === payload.userId
              ? { ...o, isEliminated: true, score: payload.score, accuracy: payload.accuracy }
              : o
          )
        );
        // Also refetch so matchResults get placement
        fetchRoomState(roomId);
      }
    );

    // -- Broadcast: match_end --
    channel.on('broadcast', { event: MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.MATCH_END },
      () => { fetchRoomState(roomId); }
    );

    // -- Broadcast: host_changed --
    channel.on('broadcast', { event: MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.HOST_CHANGED },
      ({ payload }: { payload: HostChangedPayload }) => {
        setRoomState((prev) => prev ? { ...prev, hostId: payload.newHostId } : prev);
      }
    );

    // -- Broadcast: match_start (for sync) --
    channel.on('broadcast', { event: MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.MATCH_START },
      ({ payload }: { payload: MatchStartPayload }) => {
        setRoomState((prev) => {
          if (!prev) return prev;
          return { ...prev, scheduledStartAt: payload.scheduledStartAt, status: 'countdown' };
        });
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Track presence
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            channel.track({ userId: data.user.id, online_at: new Date().toISOString() });
          }
        });
      }
    });

    channelRef.current = channel;
  }, [fetchRoomState]);

  // ---------------------------------------------------------------------------
  // Unsubscribe + cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      const supabase = getSupabaseBrowserClient();
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Helper: get current user's JWT
  // ---------------------------------------------------------------------------
  const getJwt = async (): Promise<string | null> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // ---------------------------------------------------------------------------
  // ACTION: Create Room
  // ---------------------------------------------------------------------------
  const createRoom = async (instrument: InstrumentType) => {
    setIsLoading(true);
    setError(null);
    try {
      const jwt = await getJwt();
      if (!jwt) { setError('Sign in to create a room'); return null; }

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ instrument }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to create room'); return null; }

      roomIdRef.current = json.roomId;
      await fetchRoomState(json.roomId);
      subscribeToRoom(json.roomId);

      return { inviteCode: json.inviteCode };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTION: Join Room
  // ---------------------------------------------------------------------------
  const joinRoom = async (inviteCode: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const jwt = await getJwt();
      if (!jwt) { setError('Sign in to join a room'); return false; }

      const res = await fetch(`/api/rooms/${inviteCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to join room'); return false; }

      roomIdRef.current = json.roomId;
      await fetchRoomState(json.roomId);
      subscribeToRoom(json.roomId);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTION: Leave Room
  // ---------------------------------------------------------------------------
  const leaveRoom = async () => {
    const supabase = getSupabaseBrowserClient();
    const rId = roomIdRef.current;
    if (!supabase || !rId) return;

    await supabase.rpc('leave_room', { p_room_id: rId });

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (scoreTimerRef.current) {
      clearInterval(scoreTimerRef.current);
      scoreTimerRef.current = null;
    }
    roomIdRef.current = null;
    setRoomState(null);
    setOpponents([]);
  };

  // ---------------------------------------------------------------------------
  // ACTION: Nominate
  // ---------------------------------------------------------------------------
  const nominate = async (songTitle: string, artist?: string) => {
    const supabase = getSupabaseBrowserClient();
    const rId = roomIdRef.current;
    if (!supabase || !rId) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error: err } = await supabase.from('nominations').insert({
      room_id:    rId,
      user_id:    user.id,
      song_title: songTitle.trim(),
      artist:     artist?.trim() || null,
    });

    if (err) { setError(err.message); return false; }
    return true;
  };

  // ---------------------------------------------------------------------------
  // ACTION: Vote
  // ---------------------------------------------------------------------------
  const vote = async (nominationId: string) => {
    const supabase = getSupabaseBrowserClient();
    const rId = roomIdRef.current;
    if (!supabase || !rId) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error: err } = await supabase.from('votes').upsert({
      room_id:       rId,
      nomination_id: nominationId,
      user_id:       user.id,
    }, { onConflict: 'room_id,user_id' });

    if (err) { setError(err.message); return false; }
    return true;
  };

  // ---------------------------------------------------------------------------
  // ACTION: Set ready
  // ---------------------------------------------------------------------------
  const setReady = async (ready: boolean) => {
    const supabase = getSupabaseBrowserClient();
    const rId = roomIdRef.current;
    if (!supabase || !rId) return false;

    const { error: err } = await supabase.rpc('set_player_ready', {
      p_room_id: rId,
      p_ready:   ready,
    });

    if (err) { setError(err.message); return false; }
    return true;
  };

  // ---------------------------------------------------------------------------
  // ACTION: Submit map (host only)
  // ---------------------------------------------------------------------------
  const submitMap = async (map: RhythmMap, checksum: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const jwt = await getJwt();
      if (!jwt || !roomState) return null;

      const res = await fetch(`/api/rooms/${roomState.inviteCode}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          mapJson:         map,
          checksum,
          songTitle:       map.songTitle,
          songFingerprint: map.audioFingerprint,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to submit map'); return null; }

      // Broadcast match_start to all participants
      if (channelRef.current) {
        const startPayload: MatchStartPayload = {
          matchId:          json.matchId,
          scheduledStartAt: json.scheduledStartAt,
          mapChecksum:      checksum,
        };
        channelRef.current.send({
          type:    'broadcast',
          event:   MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.MATCH_START,
          payload: startPayload,
        });
      }

      return { matchId: json.matchId, scheduledStartAt: json.scheduledStartAt };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACTION: Broadcast score (~2s intervals — not per-tap)
  // ---------------------------------------------------------------------------
  const broadcastScore = useCallback((scoreState: ScoreState, notesHit: number, total: number) => {
    if (!channelRef.current) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user || !channelRef.current) return;
      const payload: ScoreUpdatePayload = {
        userId:           data.user.id,
        score:            scoreState.score,
        combo:            scoreState.combo,
        accuracy:         scoreState.runAccuracy,
        notesHit,
        totalEncountered: total,
        timestamp:        performance.now(),
      };
      channelRef.current.send({
        type:    'broadcast',
        event:   MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.SCORE_UPDATE,
        payload,
      });
    });
  }, []);

  // ---------------------------------------------------------------------------
  // ACTION: Broadcast elimination
  // ---------------------------------------------------------------------------
  const broadcastEliminated = useCallback((payload: PlayerEliminatedPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type:    'broadcast',
      event:   MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.PLAYER_ELIMINATED,
      payload,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // ACTION: Finalize match (each player's run end)
  // ---------------------------------------------------------------------------
  const finalizeMatch = async (req: FinalizeMatchRequest) => {
    setError(null);
    try {
      const jwt = await getJwt();
      if (!jwt || !roomState) return null;

      const res = await fetch(`/api/rooms/${roomState.inviteCode}/match/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(req),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to submit result'); return null; }

      // Broadcast match_end if match completed
      if (json.matchStatus === 'completed' && channelRef.current) {
        channelRef.current.send({
          type:    'broadcast',
          event:   MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS.MATCH_END,
          payload: { matchId: req.matchId, completedAt: new Date().toISOString() },
        });
      }

      await fetchRoomState(roomIdRef.current!);
      return { placement: json.placement };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    }
  };

  const clearError = () => setError(null);

  return (
    <RoomContext.Provider value={{
      roomState,
      opponents,
      isLoading,
      error,
      createRoom,
      joinRoom,
      leaveRoom,
      nominate,
      vote,
      setReady,
      submitMap,
      broadcastScore,
      broadcastEliminated,
      finalizeMatch,
      clearError,
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
};
