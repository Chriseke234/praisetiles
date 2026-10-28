'use client';

/**
 * RoomChat — Lightweight in-room chat and predefined quick reactions.
 * Enforces:
 * - 280-char message limit
 * - 1.5s rate-limit cooldown
 * - Predefined quick reactions using SVG icons (no emojis)
 * - Safe text rendering (no raw HTML injection)
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  Send, MessageSquare, Zap, Flame, Sparkles, Music, Heart,
  ShieldCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useChat } from '@/lib/multiplayer/ChatContext';
import { SOCIAL_CONFIG, QuickReactionId } from '@/config/social';

export const RoomChat: React.FC = () => {
  const { messages, sendMessage, sendReaction, canSendMessage, cooldownSeconds } = useChat();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canSendMessage) return;
    const ok = await sendMessage(input);
    if (ok) setInput('');
  };

  const handleReaction = async (reactionId: QuickReactionId) => {
    if (!canSendMessage) return;
    await sendReaction(reactionId);
  };

  return (
    <div className="w-full rounded-2xl bg-gray-900/40 border border-gray-800/80 overflow-hidden flex flex-col">
      {/* Header toggle */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between px-4 py-2.5 bg-gray-950/60 border-b border-gray-800/60 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Room Chat</span>
          <span className="text-[10px] text-gray-500">({messages.length})</span>
        </div>
        <button className="text-gray-400 hover:text-white transition">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Quick reactions strip */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-800/60 bg-gray-950/30 overflow-x-auto scrollbar-none">
            {SOCIAL_CONFIG.QUICK_REACTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => handleReaction(r.id)}
                disabled={!canSendMessage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-amber-500/40 text-[11px] font-semibold text-gray-300 hover:text-white transition disabled:opacity-40 whitespace-nowrap"
              >
                {r.id === 'amen' && <Flame className="w-3 h-3 text-amber-400" />}
                {r.id === 'praise' && <Sparkles className="w-3 h-3 text-cyan-400" />}
                {r.id === 'hallelujah' && <Music className="w-3 h-3 text-amber-300" />}
                {r.id === 'fire' && <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />}
                {r.id === 'heart' && <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />}
                {r.id === 'blessed' && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {/* Message log */}
          <div className="h-44 overflow-y-auto p-3 space-y-2 text-xs">
            {messages.length === 0 ? (
              <p className="text-[11px] text-gray-500 text-center py-8 italic">
                Send a praise or shoutout to your lobby!
              </p>
            ) : (
              messages.map((m) => {
                const isReaction = m.messageType === 'reaction';

                return (
                  <div key={m.id} className="flex items-start gap-1.5 leading-snug">
                    <span className="font-bold text-cyan-300 truncate max-w-[100px]">
                      {m.displayName}:
                    </span>
                    <span
                      className={`break-words flex-1 ${
                        isReaction
                          ? 'font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded'
                          : 'text-gray-200'
                      }`}
                    >
                      {m.content}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input form */}
          <form onSubmit={handleSend} className="p-2 border-t border-gray-800/80 bg-gray-950/60 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, SOCIAL_CONFIG.CHAT.MAX_MESSAGE_LENGTH))}
              placeholder={canSendMessage ? 'Praise message…' : `Slow down (${cooldownSeconds}s)`}
              disabled={!canSendMessage}
              maxLength={SOCIAL_CONFIG.CHAT.MAX_MESSAGE_LENGTH}
              className="flex-1 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSendMessage || !input.trim()}
              className="p-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
