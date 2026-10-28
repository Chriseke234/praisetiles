'use client';

/**
 * ChatContext — Room text chat & predefined quick reactions.
 *
 * Enforces:
 * - Max 280 characters length check
 * - 1.5s client-side rate limit
 * - SVG icons only for quick reactions (no emojis)
 * - Broadcast & Postgres changes integration
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { RoomChatMessage, QuickReactionId } from '@/types/social';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SOCIAL_CONFIG } from '@/config/social';

interface ChatMessageDbRow {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: RoomChatMessage['messageType'];
  created_at: string;
  p?: {
    display_name?: string;
    avatar_url?: string | null;
  } | null;
}

interface ChatContextType {
  messages: RoomChatMessage[];
  sendMessage: (content: string) => Promise<boolean>;
  sendReaction: (reactionId: QuickReactionId) => Promise<boolean>;
  canSendMessage: boolean;
  cooldownSeconds: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{
  roomId: string;
  children: React.ReactNode;
}> = ({ roomId, children }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const lastSendTimeRef = useRef<number>(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch initial messages & subscribe to changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    // Fetch last messages
    supabase
      .from('room_messages')
      .select(`
        id, room_id, user_id, content, message_type, created_at,
        p:user_id (display_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(SOCIAL_CONFIG.CHAT.MAX_MESSAGES_PER_ROOM)
      .then(({ data }) => {
        if (data) {
          const formatted: RoomChatMessage[] = (data as unknown as ChatMessageDbRow[]).map((m) => ({
            id:          m.id,
            roomId:      m.room_id,
            userId:      m.user_id,
            displayName: m.p?.display_name ?? 'Player',
            avatarUrl:   m.p?.avatar_url ?? null,
            content:     m.content,
            messageType: m.message_type,
            createdAt:   m.created_at,
          }));
          setMessages(formatted);
        }
      });

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newRow = payload.new as unknown as ChatMessageDbRow;
          // Format and append
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;
            const msg: RoomChatMessage = {
              id:          newRow.id,
              roomId:      newRow.room_id,
              userId:      newRow.user_id,
              displayName: newRow.user_id === user?.id ? (profile?.displayName ?? 'You') : 'Player',
              avatarUrl:   null,
              content:     newRow.content,
              messageType: newRow.message_type,
              createdAt:   newRow.created_at,
            };
            return [...prev, msg].slice(-SOCIAL_CONFIG.CHAT.MAX_MESSAGES_PER_ROOM);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, profile?.displayName]);

  // ---------------------------------------------------------------------------
  // Rate-limiting helper
  // ---------------------------------------------------------------------------
  const applyCooldown = useCallback(() => {
    setCanSendMessage(false);
    setCooldownSeconds(2);
    lastSendTimeRef.current = Date.now();

    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastSendTimeRef.current;
      const rem = Math.max(0, Math.ceil((SOCIAL_CONFIG.CHAT.RATE_LIMIT_MS - elapsed) / 1000));
      setCooldownSeconds(rem);
      if (rem <= 0) {
        setCanSendMessage(true);
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      }
    }, 200);
  }, []);

  // ---------------------------------------------------------------------------
  // Send chat message
  // ---------------------------------------------------------------------------
  const sendMessage = async (content: string): Promise<boolean> => {
    const text = content.trim();
    if (!text || text.length > SOCIAL_CONFIG.CHAT.MAX_MESSAGE_LENGTH) return false;
    if (!canSendMessage || !user) return false;

    applyCooldown();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;

    const { error } = await supabase.from('room_messages').insert({
      room_id:      roomId,
      user_id:      user.id,
      content:      text,
      message_type: 'chat',
    });

    return !error;
  };

  // ---------------------------------------------------------------------------
  // Send quick reaction
  // ---------------------------------------------------------------------------
  const sendReaction = async (reactionId: QuickReactionId): Promise<boolean> => {
    if (!canSendMessage || !user) return false;

    const reaction = SOCIAL_CONFIG.QUICK_REACTIONS.find((r) => r.id === reactionId);
    if (!reaction) return false;

    applyCooldown();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;

    const { error } = await supabase.from('room_messages').insert({
      room_id:      roomId,
      user_id:      user.id,
      content:      reaction.label,
      message_type: 'reaction',
    });

    return !error;
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        sendMessage,
        sendReaction,
        canSendMessage,
        cooldownSeconds,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
};
