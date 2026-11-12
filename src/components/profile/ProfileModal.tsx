'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useKeyBindings } from '@/hooks/useKeyBindings';
import {
  X,
  User,
  LogOut,
  Award,
  Zap,
  Music,
  CheckCircle2,
  Circle,
  Sparkles,
  Shield,
  Trash2,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Loader2,
  Keyboard,
  RotateCcw,
  Piano,
  Guitar,
} from 'lucide-react';
import {
  evaluateRankPromotion,
  getGemTier,
} from '@/config/progression';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user, profile, progress, stats, guestMatches, isGuest, signOut, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'piano' | 'guitar' | 'history' | 'settings'>('overview');
  const [compRating, setCompRating] = useState<number>(1000);
  const [compWins, setCompWins] = useState<number>(0);
  const [compMatches, setCompMatches] = useState<number>(0);
  const [isProvisional, setIsProvisional] = useState<boolean>(true);

  // Settings & Privacy State
  const [displayNameInput, setDisplayNameInput] = useState<string>('');
  const [isPublicSetting, setIsPublicSetting] = useState<boolean>(true);
  const [preferredInstrument, setPreferredInstrument] = useState<'piano' | 'guitar'>('piano');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  // Configurable key bindings (GDD Open Decision #4)
  const { keys: keyBindings, setKey: setKeyBinding, resetToDefaults: resetKeyBindings, isCustom: hasCustomKeys } = useKeyBindings();
  const [rebindingLane, setRebindingLane] = useState<number | null>(null);

  React.useEffect(() => {
    if (profile) {
      const timer = setTimeout(() => {
        setDisplayNameInput(profile.displayName || '');
        setIsPublicSetting(profile.isPublic ?? true);
        setPreferredInstrument(profile.preferredInstrument ?? 'piano');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  React.useEffect(() => {
    if (user && isOpen) {
      import('@/lib/supabase/client').then(({ getSupabaseBrowserClient }) => {
        const sb = getSupabaseBrowserClient();
        if (sb) {
          sb.from('competitive_ratings')
            .select('rating, ranked_wins, ranked_matches_played, provisional')
            .eq('user_id', user.id)
            .eq('season_id', 'season-1')
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setCompRating(data.rating ?? 1000);
                setCompWins(data.ranked_wins ?? 0);
                setCompMatches(data.ranked_matches_played ?? 0);
                setIsProvisional(data.provisional ?? true);
              }
            });
        }
      });
    }
  }, [user, isOpen]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    setSettingsMessage(null);

    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const sb = getSupabaseBrowserClient();
      const session = (await sb?.auth.getSession())?.data.session;
      const token = session?.access_token;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          displayName: displayNameInput,
          isPublic: isPublicSetting,
          preferredInstrument,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSettingsMessage({ text: 'Profile settings saved successfully!', isError: false });
      await refreshUserData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating settings';
      setSettingsMessage({ text: msg, isError: true });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);

    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const sb = getSupabaseBrowserClient();
      const session = (await sb?.auth.getSession())?.data.session;
      const token = session?.access_token;

      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      await signOut();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting account';
      setSettingsMessage({ text: msg, isError: true });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (!isOpen) return null;

  const currentRank = progress?.gemRank || 'Quartz';
  const currentTier = getGemTier(currentRank);
  const currentXp = progress?.xp || 0;
  const currentLevel = progress?.level || 1;
  const qualifyingCount = progress?.qualifyingCompletedSongs || 0;

  const promotionEval = evaluateRankPromotion(currentRank, currentXp, qualifyingCount);

  // Stats calculation (use registered stats or aggregate guest matches)
  const totalAttempts = stats
    ? stats.totalAttempts
    : guestMatches.length;

  const completedSongs = stats
    ? stats.completedSongs
    : guestMatches.filter((m) => m.completed).length;

  const bestScore = stats
    ? stats.bestScore
    : guestMatches.filter((m) => m.completed).reduce((max, m) => Math.max(max, m.score), 0);

  const bestAccuracy = stats
    ? stats.bestAccuracy
    : guestMatches.filter((m) => m.completed).reduce((max, m) => Math.max(max, m.accuracy), 0);

  const highestCombo = stats
    ? stats.highestCombo
    : guestMatches.reduce((max, m) => Math.max(max, m.highestCombo), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
          {/* Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border border-gray-800 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {/* Avatar Circle */}
            <div className="relative">
              <div
                style={{ borderColor: currentTier.colorHex }}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl border-2 bg-gray-950 flex items-center justify-center shadow-lg"
              >
                <User className="w-8 h-8 text-gray-300" />
              </div>
              <span
                style={{ backgroundColor: currentTier.colorHex }}
                className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black text-black uppercase"
              >
                Lv.{currentLevel}
              </span>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white truncate">
                  {profile?.displayName || (isGuest ? 'Guest Praiser' : 'Praise Player')}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {isGuest ? 'Guest' : `@${profile?.username}`}
                </span>
              </div>

              {/* Gem Rank Title */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <span
                  style={{ color: currentTier.colorHex }}
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {currentTier.gemRank} &bull; {currentTier.title}
                </span>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                  <span>{currentXp.toLocaleString()} Total XP</span>
                  {promotionEval.nextRank ? (
                    <span>Next Rank: {promotionEval.nextRank} ({promotionEval.requiredXp} XP)</span>
                  ) : (
                    <span className="text-purple-400">Max Rank Cleared</span>
                  )}
                </div>
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(100, promotionEval.progressPercent)}%`,
                      backgroundColor: currentTier.colorHex,
                    }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Competitive Rating Card */}
          <div className="p-3.5 rounded-2xl bg-gray-900/60 border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Competitive Rating</span>
                  {isProvisional && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded">
                      Provisional
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">
                  {compWins} Wins · {compMatches} Matches · Season 1
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-amber-300 tabular-nums">{compRating}</span>
              <p className="text-[9px] uppercase font-bold text-gray-500">Elo</p>
            </div>
          </div>

          {/* 3-Factor Promotion Checklist Card (if not Diamond) */}
          {promotionEval.nextRank && (
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Promotion to {promotionEval.nextRank} Requirements
                </h4>
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {promotionEval.progressPercent}% Ready
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* 1. XP Requirement */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-950/60">
                  <div className="flex items-center gap-2">
                    {currentXp >= promotionEval.requiredXp ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-gray-300">XP Threshold</span>
                  </div>
                  <span className="font-mono text-gray-400">
                    {currentXp} / {promotionEval.requiredXp} XP
                  </span>
                </div>

                {/* 2. Accuracy Requirement */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-950/60">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-gray-300">Minimum Qualifying Accuracy</span>
                  </div>
                  <span className="font-mono text-cyan-400">
                    &ge; {promotionEval.requiredAccuracy.toFixed(1)}%
                  </span>
                </div>

                {/* 3. Completed Songs Count */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-950/60">
                  <div className="flex items-center gap-2">
                    {qualifyingCount >= promotionEval.requiredQualifying ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-gray-300">Qualifying Completed Songs</span>
                  </div>
                  <span className="font-mono text-gray-400">
                    {qualifyingCount} / {promotionEval.requiredQualifying} songs
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="grid grid-cols-5 p-1 bg-gray-900 rounded-xl">
            {(['overview', 'piano', 'guitar', 'history', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 text-[11px] font-bold rounded-lg capitalize transition ${
                  activeTab === tab
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview & Personal Records */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Total Attempts</span>
                  <p className="text-xl font-extrabold text-white mt-1 font-mono">{totalAttempts}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Completed</span>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{completedSongs}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Best Score</span>
                  <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{bestScore.toLocaleString()}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Best Accuracy</span>
                  <p className="text-xl font-extrabold text-cyan-400 mt-1 font-mono">{bestAccuracy.toFixed(1)}%</p>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Max Combo</span>
                  <p className="text-xl font-extrabold text-rose-400 mt-1 font-mono flex items-center gap-1">
                    <Zap className="w-4 h-4 fill-rose-400" />
                    {highestCombo}x
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[10px] uppercase text-purple-400 font-bold">Perfect Streak</span>
                  <p className="text-xl font-extrabold text-pink-300 mt-1 font-mono flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    {stats?.highestPerfectStreak ?? 0}x
                  </p>
                </div>
              </div>

              {/* Achievement Badges Showcase */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    Praise Achievement Badges
                  </h4>
                  <span className="text-[10px] text-gray-500 font-mono">8 Milestones</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'first_performance', name: 'First Performance', desc: 'Complete 1 song' },
                    { id: 'rhythm_keeper', name: 'Rhythm Keeper', desc: '90%+ accuracy' },
                    { id: 'perfect_touch', name: 'Perfect Touch', desc: '50 Perfect hits' },
                    { id: 'combo_master', name: 'Combo Master', desc: '75+ combo' },
                    { id: 'worship_warrior', name: 'Worship Warrior', desc: 'Complete 10 songs' },
                    { id: 'instrument_explorer', name: 'Explorer', desc: 'Piano & Guitar' },
                    { id: 'sustain_master', name: 'Sustain Master', desc: '20 sustained notes' },
                    { id: 'perfect_streak', name: 'Perfect Streak', desc: '25x Perfects' },
                  ].map((b) => {
                    const isUnlocked = completedSongs >= 1 && (
                      b.id === 'first_performance' ||
                      (b.id === 'rhythm_keeper' && bestAccuracy >= 90) ||
                      (b.id === 'combo_master' && highestCombo >= 75) ||
                      (b.id === 'worship_warrior' && completedSongs >= 10) ||
                      (b.id === 'perfect_streak' && (stats?.highestPerfectStreak ?? 0) >= 25)
                    );

                    return (
                      <div
                        key={b.id}
                        className={`p-2 rounded-xl border text-center transition ${
                          isUnlocked
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                            : 'bg-gray-950/40 border-gray-800/80 text-gray-600 opacity-60'
                        }`}
                        title={b.desc}
                      >
                        <Award className={`w-5 h-5 mx-auto mb-1 ${isUnlocked ? 'text-amber-400' : 'text-gray-600'}`} />
                        <span className="text-[10px] font-bold block truncate">{b.name}</span>
                        <span className="text-[8px] block opacity-75">{isUnlocked ? 'Unlocked' : 'Locked'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Piano Tiles Stats */}
          {activeTab === 'piano' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gray-900/60 border border-cyan-500/20">
                <span className="text-[10px] uppercase text-cyan-400 font-bold">Piano Attempts</span>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {stats ? stats.pianoAttempts : guestMatches.filter((m) => m.instrument === 'piano').length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/60 border border-cyan-500/20">
                <span className="text-[10px] uppercase text-cyan-400 font-bold">Piano Completed</span>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {stats ? stats.pianoCompleted : guestMatches.filter((m) => m.instrument === 'piano' && m.completed).length}
                </p>
              </div>
              <div className="col-span-2 p-4 rounded-xl bg-gray-900/60 border border-cyan-500/20">
                <span className="text-[10px] uppercase text-cyan-400 font-bold">Piano Best Score</span>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">
                  {(stats ? stats.pianoBestScore : 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Guitar Tiles Stats */}
          {activeTab === 'guitar' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gray-900/60 border border-amber-500/20">
                <span className="text-[10px] uppercase text-amber-400 font-bold">Guitar Attempts</span>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {stats ? stats.guitarAttempts : guestMatches.filter((m) => m.instrument === 'guitar').length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900/60 border border-amber-500/20">
                <span className="text-[10px] uppercase text-amber-400 font-bold">Guitar Completed</span>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {stats ? stats.guitarCompleted : guestMatches.filter((m) => m.instrument === 'guitar' && m.completed).length}
                </p>
              </div>
              <div className="col-span-2 p-4 rounded-xl bg-gray-900/60 border border-amber-500/20">
                <span className="text-[10px] uppercase text-amber-400 font-bold">Guitar Best Score</span>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">
                  {(stats ? stats.guitarBestScore : 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Tab 4: Match History */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {guestMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No matches recorded yet. Play a praise session to view your history!
                </div>
              ) : (
                guestMatches.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase ${
                          m.instrument === 'piano'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {m.instrument === 'piano' ? 'P' : 'G'}
                      </div>
                      <div>
                        <h5 className="font-bold text-white truncate max-w-[150px] sm:max-w-xs">
                          {m.songTitle}
                        </h5>
                        <p className="text-[10px] text-gray-400">
                          {m.score.toLocaleString()} pts &bull; {m.accuracy.toFixed(1)}% Acc &bull; {m.highestCombo}x Combo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          m.completed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {m.completed ? 'Cleared' : 'Failed'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 5: Settings & Privacy */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {isGuest ? (
                /* Guest users cannot edit settings — prompt to sign in */
                <div className="text-center py-8 space-y-3">
                  <Shield className="w-10 h-10 mx-auto text-gray-600" />
                  <p className="text-sm text-gray-400">
                    Sign in to access profile settings, privacy controls, and key bindings.
                  </p>
                  <button
                    onClick={() => { onClose(); onOpenAuth(); }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
                  >
                    Sign In / Register
                  </button>
                </div>
              ) : (
                <>
                  {/* Display Name */}
                  <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-2.5">
                    <label htmlFor="settings-display-name" className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      Display Name
                    </label>
                    <input
                      id="settings-display-name"
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      maxLength={32}
                      placeholder="2–32 characters"
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 transition"
                    />
                    <p className="text-[10px] text-gray-500">
                      {displayNameInput.trim().length}/32 characters (minimum 2)
                    </p>
                  </div>

                  {/* Preferred Instrument */}
                  <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      Preferred Instrument
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPreferredInstrument('piano')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition border ${
                          preferredInstrument === 'piano'
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'bg-gray-950 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <Piano className="w-4 h-4" />
                        Piano Tiles
                      </button>
                      <button
                        onClick={() => setPreferredInstrument('guitar')}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition border ${
                          preferredInstrument === 'guitar'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-gray-950 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <Guitar className="w-4 h-4" />
                        Guitar Tiles
                      </button>
                    </div>
                  </div>

                  {/* Profile Visibility */}
                  <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {isPublicSetting ? (
                          <Eye className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-rose-400" />
                        )}
                        <div>
                          <span className="text-xs font-bold text-white">Profile Visibility</span>
                          <p className="text-[10px] text-gray-500">
                            {isPublicSetting ? 'Your profile is visible on leaderboards and to other players.' : 'Your profile is hidden from leaderboards and search results.'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsPublicSetting((prev) => !prev)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          isPublicSetting ? 'bg-emerald-500' : 'bg-gray-700'
                        }`}
                        role="switch"
                        aria-checked={isPublicSetting}
                        aria-label="Toggle profile visibility"
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            isPublicSetting ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Save Settings Button */}
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings || displayNameInput.trim().length < 2}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-500 text-black text-xs font-bold uppercase tracking-wider transition"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSavingSettings ? 'Saving...' : 'Save Profile Settings'}
                  </button>

                  {/* Settings Status Message */}
                  {settingsMessage && (
                    <div
                      className={`p-3 rounded-xl text-xs font-semibold text-center ${
                        settingsMessage.isError
                          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {settingsMessage.text}
                    </div>
                  )}

                  {/* Keyboard Controls */}
                  <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Key Bindings</span>
                      </div>
                      {hasCustomKeys && (
                        <button
                          onClick={resetKeyBindings}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Click a lane key, then press any key to rebind it. Keys are stored locally.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {keyBindings.map((key, lane) => (
                        <button
                          key={lane}
                          onClick={() => setRebindingLane(rebindingLane === lane ? null : lane)}
                          onKeyDown={(e) => {
                            if (rebindingLane === lane && e.key.length === 1) {
                              e.preventDefault();
                              setKeyBinding(lane, e.key);
                              setRebindingLane(null);
                            }
                          }}
                          className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold transition border ${
                            rebindingLane === lane
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                              : 'bg-gray-950 border-gray-700 text-gray-300 hover:border-gray-500'
                          }`}
                          aria-label={`Lane ${lane + 1} key binding: ${key.toUpperCase()}`}
                        >
                          <span className="text-[9px] text-gray-500 uppercase">Lane {lane + 1}</span>
                          <span className="text-lg font-black">{key.toUpperCase()}</span>
                          {rebindingLane === lane && (
                            <span className="text-[8px] text-amber-400">Press key...</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Retention & Account Deletion */}
                  <div className="p-4 rounded-2xl bg-gray-900/60 border border-rose-500/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Privacy & Data</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Your match history and competitive records are retained for tournament integrity even after account deletion.
                      Personal profile information (display name, avatar, email) is permanently scrubbed.
                      Friend relationships and follows are removed immediately.
                    </p>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete My Account
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-rose-300 font-semibold">
                            This action is permanent. Your account, profile data, and login credentials will be permanently deleted.
                            Match records are anonymized and retained for competitive integrity.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs font-bold hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white text-xs font-bold transition"
                          >
                            {isDeletingAccount ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            {isDeletingAccount ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-4 border-t border-gray-900 flex items-center justify-between">
          {isGuest ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-gray-400">Guest mode: progress is session-only</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
              >
                Sign In / Save Progress
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-[11px] text-gray-500">PraiseTiles v1.0.0</span>
              <button
                onClick={() => {
                  signOut();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-rose-400 hover:text-rose-300 text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
