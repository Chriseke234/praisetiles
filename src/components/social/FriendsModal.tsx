'use client';

/**
 * FriendsModal — Friends, Requests, Followers, Blocking & Player Discovery.
 * Full social hub with tabbed navigation:
 * - Friends (mutual)
 * - Requests (incoming & outgoing)
 * - Add Friend (search player directory)
 * - Blocked Users
 * SVG icons only, no emojis.
 */

import React, { useState } from 'react';
import {
  Users, UserPlus, Check, X, ShieldAlert, Search, Loader2,
  Trash2, UserCheck, Shield, Send,
} from 'lucide-react';
import { useSocial } from '@/lib/social/SocialContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  activeRoomId?: string;
  activeRoomInviteCode?: string;
}

interface SearchProfileResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  player_progress?: { gem_rank: string }[];
}

type TabType = 'friends' | 'requests' | 'search' | 'blocked';

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  activeRoomId,
  activeRoomInviteCode,
}) => {
  const { user } = useAuth();
  const {
    friends,
    blocks,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    sendRoomInvitation,
  } = useSocial();

  const [activeTab, setActiveTab]         = useState<TabType>('friends');
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfileResult[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-sm bg-[#0d0f15] border border-gray-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-base font-bold text-white">Sign In to Connect</h2>
          <p className="text-xs text-gray-400">
            Create an account to add friends, track rankings, and invite teammates to praise battles.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => { onClose(); onOpenAuth(); }}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter requests
  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const incomingRequests = friends.filter((f) => f.status === 'pending' && !f.isRequester);
  const outgoingRequests = friends.filter((f) => f.status === 'pending' && f.isRequester);

  // Search players in directory
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, player_progress(gem_rank)')
        .ilike('username', `%${q}%`)
        .neq('id', user.id)
        .limit(10);
      setSearchResults(data ?? []);
    }
    setIsSearching(false);
  };

  const handleSendInvite = async (friendId: string) => {
    if (!activeRoomId || !activeRoomInviteCode) return;
    const ok = await sendRoomInvitation(friendId, activeRoomId, activeRoomInviteCode);
    if (ok) {
      setActionSuccess('Invitation sent!');
      setTimeout(() => setActionSuccess(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-xl max-h-[85vh] bg-[#0d0f15] border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">Social Hub</h2>
              <p className="text-[11px] text-gray-400">Friends, followers &amp; community</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex items-center px-6 border-b border-gray-800/80 bg-gray-950/30 text-xs">
          <button
            onClick={() => setActiveTab('friends')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'friends'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Friends ({acceptedFriends.length})
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Requests
            {incomingRequests.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Friend
          </button>

          <button
            onClick={() => setActiveTab('blocked')}
            className={`py-3 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'blocked'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Blocked
          </button>
        </nav>

        {/* Feedback message banner */}
        {actionSuccess && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: FRIENDS */}
          {activeTab === 'friends' && (
            <div className="space-y-2.5">
              {acceptedFriends.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-2">
                  <Users className="w-10 h-10 mx-auto text-gray-700" />
                  <p className="text-xs font-semibold">No friends added yet</p>
                  <p className="text-[11px] text-gray-600">
                    Use the &ldquo;Add Friend&rdquo; tab to search for other praise rhythm players.
                  </p>
                </div>
              ) : (
                acceptedFriends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-gray-900/40 border border-gray-800 hover:border-gray-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-xs font-black text-amber-400">
                        {f.friendDisplayName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">{f.friendDisplayName}</span>
                          <span className="text-[10px] text-gray-500">@{f.friendUsername}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {f.friendGemRank} · Elo ~{f.friendCompetitiveRating}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeRoomId && (
                        <button
                          onClick={() => handleSendInvite(f.friendId)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition"
                          title="Invite to your room"
                        >
                          <Send className="w-3 h-3" />
                          <span>Invite</span>
                        </button>
                      )}
                      <button
                        onClick={() => removeFriend(f.friendId)}
                        className="p-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-rose-400 transition"
                        title="Remove friend"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => blockUser(f.friendId)}
                        className="p-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-rose-400 transition"
                        title="Block player"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {/* Incoming */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Incoming Requests ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-2">No incoming requests</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-gray-900/40 border border-gray-800"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{r.friendDisplayName}</p>
                          <p className="text-[10px] text-gray-500">@{r.friendUsername}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => acceptFriendRequest(r.id)}
                            className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition"
                            title="Accept"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => rejectFriendRequest(r.id)}
                            className="p-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-rose-400 transition"
                            title="Decline"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Outgoing Requests ({outgoingRequests.length})
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-2">No pending outgoing requests</p>
                ) : (
                  <div className="space-y-2">
                    {outgoingRequests.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-gray-900/40 border border-gray-800"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{r.friendDisplayName}</p>
                          <p className="text-[10px] text-gray-500">Waiting for response…</p>
                        </div>
                        <button
                          onClick={() => rejectFriendRequest(r.id)}
                          className="px-2.5 py-1 rounded-xl bg-gray-800 text-gray-400 hover:text-rose-400 text-[10px] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SEARCH & ADD */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter username to search…"
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition flex items-center gap-1.5"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </form>

              <div className="space-y-2">
                {searchResults.map((p) => {
                  const alreadyFriend = acceptedFriends.some((f) => f.friendId === p.id);
                  const isPending = friends.some((f) => f.friendId === p.id && f.status === 'pending');

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-gray-900/40 border border-gray-800"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{p.display_name}</p>
                        <p className="text-[10px] text-gray-500">@{p.username}</p>
                      </div>
                      {alreadyFriend ? (
                        <span className="text-[11px] text-emerald-400 font-bold">Friends</span>
                      ) : isPending ? (
                        <span className="text-[11px] text-amber-400 font-medium">Pending</span>
                      ) : (
                        <button
                          onClick={() => sendFriendRequest(p.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BLOCKED */}
          {activeTab === 'blocked' && (
            <div className="space-y-2">
              {blocks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-10 italic">No blocked players</p>
              ) : (
                blocks.map((b) => (
                  <div
                    key={b.blockedId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-gray-900/40 border border-gray-800"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{b.blockedDisplayName}</p>
                      <p className="text-[10px] text-gray-500">@{b.blockedUsername}</p>
                    </div>
                    <button
                      onClick={() => unblockUser(b.blockedId)}
                      className="px-3 py-1 rounded-xl bg-gray-800 text-gray-300 hover:text-white text-xs font-medium transition"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
