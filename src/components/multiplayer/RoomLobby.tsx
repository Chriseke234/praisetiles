'use client';

/**
 * RoomLobby — Main multiplayer room orchestrator.
 *
 * Manages the full private room lifecycle:
 *   waiting → nominating → voting → uploading → ready_check → countdown → playing → finished
 *
 * Delegates rendering to:
 *   ParticipantList, NominationPanel, VotingPanel, RoomGameContainer, MultiplayerResultScreen
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy, Check, ArrowLeft, Upload, Play, Users, Music2,
  AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { useRoom } from '@/lib/multiplayer/RoomContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { ParticipantList } from './ParticipantList';
import { NominationPanel } from './NominationPanel';
import { VotingPanel } from './VotingPanel';
import { RoomGameContainer } from './RoomGameContainer';
import { MultiplayerResultScreen } from './MultiplayerResultScreen';
import { RoomChat } from './RoomChat';
import { GameAudioPlayer } from '@/lib/audio/player';
import { validateAudioFile, decodeAudioDataCompat } from '@/lib/audio/validator';
import { generateRhythmMapFromAudio } from '@/lib/audio/analyzer';
import { generateSyntheticGospelTrack } from '@/lib/audio/synth';
import { RhythmMap, RunResult, InstrumentType } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';

/** Simple SHA-256-based hex checksum of the map JSON (browser SubtleCrypto). */
async function mapChecksum(map: RhythmMap): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(map));
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface RoomLobbyProps {
  /** Pre-joined room invite code (from URL or creation). */
  inviteCode: string;
  onLeave: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ inviteCode, onLeave }) => {
  const { roomState, isLoading, error, nominate, vote, setReady, submitMap, leaveRoom, clearError } = useRoom();
  const { user } = useAuth();

  // Audio state
  const [audioPlayer]       = useState(() => new GameAudioPlayer());
  const [volume, setVolume] = useState(0.8);
  const [reducedMotion]     = useState(false);
  const [audioBuffer, setAudioBuffer]         = useState<AudioBuffer | null>(null);
  const [hostRhythmMap, setHostRhythmMap]     = useState<RhythmMap | null>(null);
  const [uploadError, setUploadError]         = useState('');
  const [isAnalyzing, setIsAnalyzing]         = useState(false);
  const [isSubmittingMap, setIsSubmittingMap] = useState(false);

  // Match state (host local overrides)
  const [hostMatchId, setHostMatchId]                 = useState('');
  const [hostScheduledStartAt, setHostScheduledStartAt] = useState('');
  const [runResult, setRunResult]                     = useState<RunResult | null>(null);

  const [codeCopied, setCodeCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived match and map state
  const activeRhythmMap = hostRhythmMap ?? roomState?.currentMatch?.mapJson ?? null;
  const activeMatchId = hostMatchId || roomState?.currentMatch?.id || '';
  const activeScheduledStartAt = hostScheduledStartAt || roomState?.currentMatch?.scheduledStartAt || roomState?.scheduledStartAt || '';

  // Sync volume to player
  useEffect(() => { audioPlayer.setVolume(volume); }, [volume, audioPlayer]);

  // Sync buffer to audioPlayer
  useEffect(() => {
    if (audioBuffer) {
      audioPlayer.setBuffer(audioBuffer);
    }
  }, [audioBuffer, audioPlayer]);

  // Ensure non-host participants have a playable audio buffer
  useEffect(() => {
    if (!audioBuffer && activeRhythmMap) {
      let isMounted = true;
      const setupBuffer = async () => {
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const tempCtx = new AudioCtx();
            const synthBuffer = generateSyntheticGospelTrack(tempCtx);
            if (isMounted) {
              setAudioBuffer(synthBuffer);
              audioPlayer.setBuffer(synthBuffer);
            }
            await tempCtx.close().catch(() => {});
          }
        } catch {
          // Audio buffer fallback error handling
        }
      };
      setupBuffer();
      return () => { isMounted = false; };
    }
  }, [audioBuffer, activeRhythmMap, audioPlayer]);

  const currentUserId = user?.id ?? '';
  const isHost = roomState?.hostId === currentUserId;
  const status = roomState?.status ?? 'waiting';

  // -----------------------------------------------------------------------
  // Copy invite code
  // -----------------------------------------------------------------------
  const handleCopyCode = useCallback(async () => {
    const code = roomState?.inviteCode ?? inviteCode;
    try {
      await navigator.clipboard.writeText(
        `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${code}`
      );
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback: select + copy
    }
  }, [roomState?.inviteCode, inviteCode]);

  // -----------------------------------------------------------------------
  // Audio upload + analysis (host only)
  // -----------------------------------------------------------------------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsAnalyzing(true);

    // Validate file
    const validation = await validateAudioFile(file);
    if (!validation.valid) {
      setUploadError(validation.error ?? 'Invalid audio file');
      setIsAnalyzing(false);
      return;
    }

    try {
      // Decode audio with Safari-safe AudioContext and decoder
      const arrayBuf = await file.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const decoded  = await decodeAudioDataCompat(audioCtx, arrayBuf);
      audioCtx.close();

      // Generate rhythm map
      const map = await generateRhythmMapFromAudio(decoded, file.name.replace(/\.[^.]+$/, ''));
      setAudioBuffer(decoded);
      setHostRhythmMap(map);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to analyze audio');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Submit map (host only, after analysis)
  // -----------------------------------------------------------------------
  const handleSubmitMap = async () => {
    if (!activeRhythmMap || isSubmittingMap) return;
    setIsSubmittingMap(true);
    setUploadError('');

    try {
      const checksum = await mapChecksum(activeRhythmMap);
      const result = await submitMap(activeRhythmMap, checksum);
      if (result) {
        setHostMatchId(result.matchId);
        setHostScheduledStartAt(result.scheduledStartAt);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to submit map');
    } finally {
      setIsSubmittingMap(false);
    }
  };

  // -----------------------------------------------------------------------
  // Handle match finish
  // -----------------------------------------------------------------------
  const handleMatchFinished = (result: RunResult) => {
    setRunResult(result);
  };

  // -----------------------------------------------------------------------
  // Rematch (host only — resets room to nominating)
  // -----------------------------------------------------------------------
  const handleRematch = () => {
    // Reset local state; room status will be updated by host via server
    setHostRhythmMap(null);
    setAudioBuffer(null);
    setRunResult(null);
    setHostMatchId('');
    setHostScheduledStartAt('');
    // TODO: API call to reset room to 'nominating' (Phase 3 extension)
  };

  // -----------------------------------------------------------------------
  // Leave room
  // -----------------------------------------------------------------------
  const handleLeave = async () => {
    await leaveRoom();
    onLeave();
  };

  // -----------------------------------------------------------------------
  // Transition to nominating (host only)
  // -----------------------------------------------------------------------
  const handleStartNominating = async () => {
    if (!isHost || !roomState) return;
    const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    await sb.from('rooms').update({ status: 'nominating' }).eq('id', roomState.id);
  };

  // -----------------------------------------------------------------------
  // Transition to voting (host only)
  // -----------------------------------------------------------------------
  const handleStartVoting = async () => {
    if (!isHost || !roomState) return;
    const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    await sb.from('rooms').update({ status: 'voting' }).eq('id', roomState.id);
  };

  // -----------------------------------------------------------------------
  // Transition to uploading (host selects winning song)
  // -----------------------------------------------------------------------
  const handleStartUploading = async () => {
    if (!isHost || !roomState) return;
    const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    await sb.from('rooms').update({ status: 'uploading' }).eq('id', roomState.id);
  };

  // -----------------------------------------------------------------------
  // Render: playing phase
  // -----------------------------------------------------------------------
  if ((status === 'ready_check' || status === 'countdown' || status === 'playing') && activeRhythmMap && activeMatchId && activeScheduledStartAt && !runResult) {
    return (
      <RoomGameContainer
        map={activeRhythmMap}
        instrument={(roomState?.instrument ?? 'piano') as InstrumentType}
        audioPlayer={audioPlayer}
        matchId={activeMatchId}
        scheduledStartAt={activeScheduledStartAt}
        volume={volume}
        onVolumeChange={setVolume}
        reducedMotion={reducedMotion}
        onMatchFinished={handleMatchFinished}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Render: results phase
  // -----------------------------------------------------------------------
  if ((status === 'finished' || runResult) && roomState) {
    return (
      <MultiplayerResultScreen
        matchResults={roomState.matchResults}
        currentUserId={currentUserId}
        songTitle={roomState.songTitle ?? 'Untitled'}
        onRematch={handleRematch}
        onLeave={handleLeave}
        isHost={isHost}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Render: lobby / nomination / voting / uploading phases
  // -----------------------------------------------------------------------
  const code = roomState?.inviteCode ?? inviteCode;
  const participants = roomState?.participants ?? [];
  const allReady = participants.length > 1 && participants.every((p) => p.isReady);

  return (
    <div className="min-h-screen w-full bg-[#090a0f] text-gray-100 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-3xl flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </button>

        <div className="text-center">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Private Room</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{status}</p>
        </div>

        {/* Invite code */}
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700
            hover:border-cyan-500/60 transition text-sm font-bold text-cyan-400"
          title="Copy invite link"
        >
          <span className="font-mono tracking-widest">{code}</span>
          {codeCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </header>

      {/* Error banner */}
      {(error || uploadError) && (
        <div className="w-full max-w-3xl mx-auto mt-3 px-4">
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error || uploadError}</span>
            <button
              onClick={() => { clearError(); setUploadError(''); }}
              className="ml-auto text-rose-400 hover:text-white transition"
            >✕</button>
          </div>
        </div>
      )}

      <main className="w-full max-w-3xl px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Participant list + ready button */}
        <aside className="w-full lg:w-64 flex-shrink-0 space-y-4">
          {isLoading && !roomState ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading room…
            </div>
          ) : (
            <ParticipantList
              participants={participants}
              currentUserId={currentUserId}
              hostId={roomState?.hostId ?? ''}
              maxPlayers={roomState?.maxParticipants ?? MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS}
            />
          )}

          {/* Ready toggle */}
          {status !== 'waiting' && status !== 'playing' && status !== 'finished' && (
            <button
              onClick={() => {
                const me = participants.find((p) => p.userId === currentUserId);
                setReady(!me?.isReady);
              }}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition border
                ${participants.find((p) => p.userId === currentUserId)?.isReady
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-500/40'
                }`}
            >
              {participants.find((p) => p.userId === currentUserId)?.isReady ? '✓ Ready' : 'Mark Ready'}
            </button>
          )}

          {/* Instrument badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-400">
            <Music2 className="w-3.5 h-3.5 text-cyan-400" />
            {roomState?.instrument === 'piano' ? 'Piano Tiles' : 'Guitar Tiles'}
          </div>

          {/* Lobby chat & quick reactions */}
          <RoomChat />

          {/* All-ready indicator */}
          {allReady && isHost && status === 'uploading' && activeRhythmMap && (
            <div className="text-xs text-emerald-400 text-center font-semibold animate-pulse">
              All players ready — start when you are!
            </div>
          )}
        </aside>

        {/* Right: Phase panel */}
        <section className="flex-1 min-w-0 space-y-6">

          {/* WAITING */}
          {status === 'waiting' && (
            <div className="space-y-4">
              <div className="px-4 py-6 rounded-2xl bg-gray-900/60 border border-gray-800 text-center space-y-3">
                <Users className="w-10 h-10 text-cyan-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Waiting for Players</h3>
                <p className="text-sm text-gray-400">
                  Share the invite code <span className="font-mono text-cyan-400 font-bold">{code}</span>{' '}
                  with up to {(roomState?.maxParticipants ?? MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS) - 1} friends.
                </p>
                {isHost && participants.length >= 2 && (
                  <button
                    onClick={handleStartNominating}
                    className="mt-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
                  >
                    Start Nominating
                  </button>
                )}
                {isHost && participants.length < 2 && (
                  <p className="text-xs text-gray-500 italic">Need at least 2 players to start.</p>
                )}
              </div>
            </div>
          )}

          {/* NOMINATING */}
          {status === 'nominating' && (
            <div className="space-y-4">
              <NominationPanel
                nominations={roomState?.nominations ?? []}
                currentUserId={currentUserId}
                onNominate={nominate}
              />
              {isHost && (roomState?.nominations?.length ?? 0) > 0 && (
                <button
                  onClick={handleStartVoting}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
                >
                  Move to Voting
                </button>
              )}
            </div>
          )}

          {/* VOTING */}
          {status === 'voting' && (
            <div className="space-y-4">
              <VotingPanel
                nominations={roomState?.nominations ?? []}
                votes={roomState?.votes ?? []}
                currentUserId={currentUserId}
                onVote={vote}
              />
              {isHost && (roomState?.votes?.length ?? 0) > 0 && (
                <button
                  onClick={handleStartUploading}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
                >
                  Lock in Winner &amp; Upload Audio
                </button>
              )}
            </div>
          )}

          {/* UPLOADING */}
          {status === 'uploading' && (
            <div className="space-y-4">
              {isHost ? (
                <div className="px-4 py-6 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">Upload Winning Song</h3>
                  </div>
                  <p className="text-sm text-gray-400">
                    Upload the audio for{' '}
                    <span className="text-white font-semibold">
                      {roomState?.nominations?.find((n) =>
                        (roomState.votes ?? []).filter((v) => v.nominationId === n.id).length ===
                        Math.max(...((roomState.nominations ?? []).map((nom) =>
                          (roomState.votes ?? []).filter((v) => v.nominationId === nom.id).length
                        )))
                      )?.songTitle ?? 'the winning song'}
                    </span>.
                    MP3, WAV or MP4 · max {GAMEPLAY_CONFIG.UPLOAD.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.
                  </p>

                  {/* File input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.mp4,.aac,.ogg,.m4a"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload audio file"
                  />

                  {!activeRhythmMap ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAnalyzing}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed
                        border-amber-500/40 hover:border-amber-400 text-amber-400 text-sm font-semibold transition"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                      ) : (
                        <><Upload className="w-4 h-4" /> Choose audio file</>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-3 py-2.5 rounded-xl bg-emerald-900/20 border border-emerald-500/30 text-emerald-300 text-sm">
                        ✓ {activeRhythmMap.songTitle} · {activeRhythmMap.totalNotes} notes · {activeRhythmMap.duration.toFixed(0)}s
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitMap}
                          disabled={isSubmittingMap}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500
                            hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-sm transition"
                        >
                          {isSubmittingMap ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Sending to players…</>
                          ) : (
                            <><Play className="w-4 h-4" /> Start Match</>
                          )}
                        </button>
                        <button
                          onClick={() => { setHostRhythmMap(null); setAudioBuffer(null); }}
                          className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-rose-500/40
                            text-gray-300 text-sm transition"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-8 rounded-2xl bg-gray-900/60 border border-gray-800 text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-amber-400 mx-auto animate-spin" />
                  <p className="text-sm text-white font-semibold">Host is uploading the song…</p>
                  <p className="text-xs text-gray-400">You&apos;ll be notified when the match is ready.</p>
                </div>
              )}
            </div>
          )}

          {/* READY CHECK */}
          {status === 'ready_check' && (
            <div className="px-4 py-8 rounded-2xl bg-gray-900/60 border border-gray-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <Play className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Get Ready!</h3>
              <p className="text-sm text-gray-400">
                The host has submitted the map. Mark yourself ready to start.
              </p>
              {allReady && isHost && (
                <p className="text-xs text-emerald-400 font-bold animate-pulse">
                  All players ready — match will start shortly!
                </p>
              )}
            </div>
          )}

        </section>
      </main>
    </div>
  );
};
