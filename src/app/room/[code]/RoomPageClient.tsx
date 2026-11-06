'use client';

/**
 * RoomPageClient — Client wrapper that:
 * 1. Provides RoomProvider
 * 2. Joins the room from URL param
 * 3. Renders RoomLobby
 */

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomProvider, useRoom } from '@/lib/multiplayer/RoomContext';
import { ChatProvider } from '@/lib/multiplayer/ChatContext';
import { RoomLobby } from '@/components/multiplayer/RoomLobby';
import { useAuth } from '@/lib/auth/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

interface RoomPageClientProps {
  inviteCode: string;
}

function RoomJoiner({ inviteCode }: RoomPageClientProps) {
  const router  = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { joinRoom, roomState, isLoading, error } = useRoom();
  const joinAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Redirect to home with a ?room= param so MainMenu can prompt sign-in
      router.replace(`/?room=${inviteCode}`);
      return;
    }
    if (joinAttempted.current) return;
    joinAttempted.current = true;
    joinRoom(inviteCode);
  }, [user, authLoading, inviteCode, joinRoom, router]);

  if (authLoading || (isLoading && !roomState)) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
          <p className="text-sm text-gray-400">Joining room {inviteCode}…</p>
        </div>
      </div>
    );
  }

  if (error && !roomState) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-gray-900 border border-rose-500/40 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Could not join room</h2>
          <p className="text-sm text-rose-300">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Room Unavailable</h2>
          <p className="text-sm text-gray-400">
            Could not retrieve room details for <span className="font-mono text-amber-300">{inviteCode}</span>.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => {
                joinAttempted.current = false;
                joinRoom(inviteCode);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
            >
              Retry
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm transition"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider roomId={roomState.id}>
      <RoomLobby
        inviteCode={inviteCode}
        onLeave={() => router.push('/')}
      />
    </ChatProvider>
  );
}

export function RoomPageClient({ inviteCode }: RoomPageClientProps) {
  return (
    <RoomProvider>
      <RoomJoiner inviteCode={inviteCode} />
    </RoomProvider>
  );
}
