'use client';

import React from 'react';
import { InstrumentType } from '@/types/game';
import {
  Volume2,
  VolumeX,
  Flame,
  Users,
  Sparkles,
  ShieldCheck,
  Trophy,
  X,
  Award,
  Bell,
  Activity,
  Menu,
  Play,
  ChevronRight,
  Sliders,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocial } from '@/lib/social/SocialContext';
import { useTournament } from '@/lib/tournament/TournamentContext';
import { getGemTier } from '@/config/progression';
import dynamic from 'next/dynamic';
import { BrandLogo } from '@/components/common/BrandLogo';
import { MultiplayerModal } from '@/components/multiplayer/MultiplayerModal';
import { QuickPlayModal } from '@/components/multiplayer/QuickPlayModal';
import { NotificationDrawer } from '@/components/social/NotificationDrawer';
import { useRouter } from 'next/navigation';

// Lazy-loaded heavyweight modal components for bundle splitting
const PublicRoomBrowser = dynamic(() => import('@/components/multiplayer/PublicRoomBrowser').then(m => m.PublicRoomBrowser), { ssr: false });
const FriendsModal = dynamic(() => import('@/components/social/FriendsModal').then(m => m.FriendsModal), { ssr: false });
const LeaderboardModal = dynamic(() => import('@/components/social/LeaderboardModal').then(m => m.LeaderboardModal), { ssr: false });
const TournamentHub = dynamic(() => import('@/components/tournament/TournamentHub').then(m => m.TournamentHub), { ssr: false });
const AudioEvaluationTool = dynamic(() => import('@/components/dev/AudioEvaluationTool').then(m => m.AudioEvaluationTool), { ssr: false });
const TermsOfServiceModal = dynamic(() => import('@/components/legal/TermsOfServiceModal').then(m => m.TermsOfServiceModal), { ssr: false });
const PrivacyPolicyModal = dynamic(() => import('@/components/legal/PrivacyPolicyModal').then(m => m.PrivacyPolicyModal), { ssr: false });

interface MainMenuProps {
  onSelectInstrument: (instrument: InstrumentType) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSelectInstrument,
  volume,
  onVolumeChange,
  reducedMotion,
  onToggleReducedMotion,
  onOpenProfile,
  onOpenAuth,
}) => {
  const router = useRouter();
  const [showInstrumentSelect, setShowInstrumentSelect] = React.useState(false);
  const [showMultiplayerModal, setShowMultiplayerModal] = React.useState(false);
  const [showQuickPlayModal, setShowQuickPlayModal]     = React.useState(false);
  const [showPublicRoomsModal, setShowPublicRoomsModal] = React.useState(false);
  const [showFriendsModal, setShowFriendsModal]         = React.useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = React.useState(false);
  const [showTournamentsHub, setShowTournamentsHub]     = React.useState(false);
  const [showNotifications, setShowNotifications]       = React.useState(false);
  const [showAudioEval, setShowAudioEval]               = React.useState(false);
  const [showTermsModal, setShowTermsModal]             = React.useState(false);
  const [showPrivacyModal, setShowPrivacyModal]         = React.useState(false);

  // Mobile Slide-Out Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen]         = React.useState(false);

  const { user, profile, progress } = useAuth();
  const { invitations, respondInvitation } = useSocial();
  const { unreadNotificationCount } = useTournament();

  const currentRank = progress?.gemRank || 'Quartz';
  const tier = getGemTier(currentRank);
  const pendingInvite = invitations[0];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 bg-[#090a0f] text-gray-100 overflow-x-hidden">
      {/* Real Unsplash Worship Atmosphere Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-screen pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop')`,
        }}
      />

      {/* Atmospheric ambient lighting gradient overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-20 w-full max-w-5xl lg:max-w-6xl flex items-center justify-between border-b border-gray-800/80 pb-4 gap-2 sm:gap-4">
        {/* Stylized Gospel Brand Logo */}
        <BrandLogo size="md" className="animate-brand-entrance" />

        {/* Desktop / Tablet Navbar Controls (>= md: 768px) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* Game Hubs: Tournaments, Ranks, Social, Notifications */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tournaments Hub Trigger */}
            <button
              onClick={() => setShowTournamentsHub(true)}
              title="Championship Tournaments"
              className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/40 text-gray-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden lg:inline">Tournaments</span>
            </button>

            {/* Leaderboard Modal Trigger */}
            <button
              onClick={() => setShowLeaderboardModal(true)}
              title="Ranked Leaderboards"
              className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/40 text-gray-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden lg:inline">Ranks</span>
            </button>

            {/* Friends & Social Hub Trigger */}
            <button
              onClick={() => setShowFriendsModal(true)}
              title="Social & Friends"
              className="relative px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="hidden lg:inline">Social</span>
              {invitations.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#090a0f] animate-pulse" />
              )}
            </button>

            {/* In-App Notifications Trigger */}
            <button
              onClick={() => setShowNotifications(true)}
              title="Notifications"
              className="relative p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/40 text-gray-400 hover:text-white transition shrink-0"
            >
              <Bell className="w-4 h-4 text-gray-300" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#090a0f] animate-pulse" />
              )}
            </button>
          </div>

          {/* Authenticated Profile or Guest Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            {user && profile ? (
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/50 transition shrink-0 whitespace-nowrap"
              >
                <div
                  style={{ backgroundColor: tier.colorHex }}
                  className="w-5 h-5 rounded-lg flex items-center justify-center text-black font-black text-[10px] shrink-0"
                >
                  {tier.gemRank[0]}
                </div>
                <span className="text-xs font-bold text-white max-w-[100px] truncate">
                  {profile.displayName}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-xs text-amber-300 font-medium hover:border-amber-500/40 transition shrink-0 whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Guest</span>
                </button>
                <button
                  onClick={onOpenAuth}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-md shadow-amber-500/20 shrink-0 whitespace-nowrap"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* System Utility Controls: Audio & Motion */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sound Controls */}
            <div className="flex items-center gap-2 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-xl shrink-0">
              <button
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
                aria-label={volume > 0 ? 'Mute Audio' : 'Unmute Audio'}
                className="text-gray-400 hover:text-amber-400 transition shrink-0"
              >
                {volume > 0 ? (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                aria-label="Master Volume"
                className="w-14 sm:w-16 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 shrink-0"
              />
            </div>

            {/* Reduced Motion Toggle */}
            <button
              onClick={onToggleReducedMotion}
              title={reducedMotion ? 'Enable Motion Effects' : 'Reduce Motion Effects'}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition shrink-0 whitespace-nowrap ${
                reducedMotion
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-gray-900/90 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {reducedMotion ? 'Motion: Off' : 'Motion: On'}
            </button>
          </div>
        </div>

        {/* Mobile Header Controls (< md: 768px) */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {/* Mobile Notifications Bell */}
          <button
            onClick={() => setShowNotifications(true)}
            aria-label="Notifications"
            className="relative p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white transition"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#090a0f] animate-pulse" />
            )}
          </button>

          {/* Mobile Quick Profile / Sign In */}
          {user && profile ? (
            <button
              onClick={onOpenProfile}
              aria-label="Profile"
              className="p-1.5 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center"
            >
              <div
                style={{ backgroundColor: tier.colorHex }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-black font-black text-xs"
              >
                {tier.gemRank[0]}
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold whitespace-nowrap"
            >
              Sign In
            </button>
          )}

          {/* Mobile Hamburger Drawer Trigger */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open Navigation Drawer"
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-amber-400 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer & Backdrop Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop with Blur */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
          />

          {/* Slide-out Drawer Panel */}
          <aside className="relative z-50 w-[290px] max-w-[85vw] h-full bg-[#0c0e17] border-l border-gray-800/90 p-5 flex flex-col justify-between overflow-y-auto shadow-2xl animate-fadeIn">
            {/* Drawer Top Header */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
                <BrandLogo size="sm" showSubtitle={false} />
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close Navigation Drawer"
                  className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* User Standing / Guest Profile Card */}
              {user && profile ? (
                <div
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onOpenProfile();
                  }}
                  className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: tier.colorHex }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-black text-sm shadow-md"
                    >
                      {tier.gemRank[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white truncate max-w-[130px]">
                        {profile.displayName}
                      </p>
                      <span className="text-[11px] font-semibold text-amber-400">
                        {tier.gemRank} &bull; Lvl {progress?.level || 1}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Guest Session</p>
                      <p className="text-[10px] text-gray-400">Local progress only</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenAuth();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Navigation Game Hubs */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-1">
                  Arena Hubs
                </p>

                {/* Tournaments */}
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowTournamentsHub(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 hover:border-amber-500/40 text-gray-200 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Tournaments</span>
                      <span className="text-[10px] text-gray-400 block">Single-Elimination Brackets</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* Ranks & Leaderboard */}
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowLeaderboardModal(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 hover:border-amber-500/40 text-gray-200 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Leaderboards</span>
                      <span className="text-[10px] text-gray-400 block">Competitive Seasons & Ranks</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* Social & Friends */}
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowFriendsModal(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 hover:border-cyan-500/40 text-gray-200 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Social & Friends</span>
                      <span className="text-[10px] text-gray-400 block">
                        {invitations.length > 0 ? `${invitations.length} Pending Invites` : 'Lobby & Direct Challenges'}
                      </span>
                    </div>
                  </div>
                  {invitations.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px]">
                      {invitations.length}
                    </span>
                  )}
                </button>

                {/* Notifications */}
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowNotifications(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 hover:border-amber-500/40 text-gray-200 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-gray-300 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Notifications</span>
                      <span className="text-[10px] text-gray-400 block">Match alerts & results</span>
                    </div>
                  </div>
                  {unreadNotificationCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px]">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Quick System Settings in Drawer */}
              <div className="flex flex-col gap-3 pt-2 border-t border-gray-800/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-1">
                  Quick Settings
                </p>

                {/* Volume Slider */}
                <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
                    aria-label="Toggle Mute"
                    className="text-gray-400 hover:text-amber-400 transition"
                  >
                    {volume > 0 ? (
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    aria-label="Master Volume"
                    className="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[11px] font-mono text-gray-400 w-8 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>

                {/* Motion Effects Toggle */}
                <button
                  onClick={onToggleReducedMotion}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                    reducedMotion
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-gray-900/80 border-gray-800/80 text-gray-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-gray-400" />
                    Reduced Motion
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-800 text-amber-400">
                    {reducedMotion ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Footer Links */}
            <div className="pt-4 border-t border-gray-800/80 flex flex-col gap-2 text-[11px] text-gray-400">
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setShowAudioEval(true);
                }}
                className="text-left text-gray-500 hover:text-cyan-400 transition flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Audio Engine Diagnostics</span>
              </button>
              <div className="flex items-center gap-3 text-gray-500 text-[10px] pt-1">
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowTermsModal(true);
                  }}
                  className="hover:text-amber-400 transition"
                >
                  Terms
                </button>
                <span>&bull;</span>
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setShowPrivacyModal(true);
                  }}
                  className="hover:text-amber-400 transition"
                >
                  Privacy
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* In-app Pending Room Invitation Banner */}
      {pendingInvite && (
        <aside
          aria-label="Room Invitation"
          className="relative z-20 w-full max-w-xl mx-auto mt-4 px-4 py-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-white flex items-center justify-between gap-3 shadow-lg backdrop-blur-sm animate-fadeIn"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <p className="text-xs text-gray-200 truncate">
              <strong className="text-cyan-300">{pendingInvite.senderDisplayName}</strong> invited you to play{' '}
              <span className="capitalize text-amber-300">{pendingInvite.instrument}</span> in room{' '}
              <span className="font-mono text-cyan-200 font-bold">{pendingInvite.inviteCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                respondInvitation(pendingInvite.id, 'accept');
                router.push(`/room/${pendingInvite.inviteCode}`);
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition shadow"
            >
              Join
            </button>
            <button
              onClick={() => respondInvitation(pendingInvite.id, 'decline')}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-rose-400 transition"
              title="Decline Invitation"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Hero & Rhythm Portal Content */}
      <main className="relative z-10 w-full max-w-5xl lg:max-w-6xl flex flex-col items-center justify-center my-auto py-6 sm:py-8 text-center">
        {!showInstrumentSelect ? (
          <div className="w-full flex flex-col items-center gap-6 sm:gap-8">
            {/* Hero Section */}
            <div className="space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Browser-First Gospel Rhythm Gaming</span>
              </div>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                Play the Rhythm of Praise
              </h2>
              <p className="text-sm sm:text-base text-gray-400 max-w-lg mx-auto">
                Upload your gospel worship tracks or play the demo praise hymn. Master strict-timing 4-lane rhythm across Piano and Guitar modes.
              </p>

              {/* Primary Call to Action */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setShowInstrumentSelect(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-sm sm:text-base transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5"
                >
                  <Play className="w-4 h-4 fill-black stroke-black" />
                  <span>Start Praise Session</span>
                </button>
                <button
                  onClick={() => setShowMultiplayerModal(true)}
                  className="px-5 py-3 rounded-2xl bg-gray-900/90 border border-gray-800 hover:border-cyan-500/50 text-gray-200 hover:text-cyan-400 font-bold text-sm sm:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Multiplayer Arena</span>
                </button>
              </div>
            </div>

            {/* 2-Column Responsive Game Mode Portal Grid */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* Card 1: Solo Leveling */}
              <button
                onClick={() => setShowInstrumentSelect(true)}
                className="group relative p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/10 hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/30 shrink-0 group-hover:scale-105 transition">
                    <Flame className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    Strict Mode
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition flex items-center gap-2">
                    Solo Leveling
                    <ChevronRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Test your timing across 3 Star stages. One missed note or bad tap ends the run immediately.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="text-amber-400 font-semibold">100 Pts / Perfect Hit</span>
                  <span className="text-gray-500">Progressive Density &bull; Star 1–3</span>
                </div>
              </button>

              {/* Card 2: Multiplayer & Quick Play */}
              <button
                onClick={() => setShowMultiplayerModal(true)}
                className="group relative p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-cyan-500/30 hover:border-cyan-400/80 transition-all duration-200 hover:shadow-xl hover:shadow-cyan-500/10 hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-black shadow-md shadow-cyan-500/30 shrink-0 group-hover:scale-105 transition">
                    <Users className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wide">
                    Live Arena
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition flex items-center gap-2">
                    Multiplayer Battles
                    <ChevronRight className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Synchronized rhythm matches for up to 4 players. Join public lobbies, invite friends, or hop into Quick Play.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="text-cyan-400 font-semibold">Realtime Clock Sync</span>
                  <span className="text-gray-500">Shared Authoritative Map</span>
                </div>
              </button>

              {/* Card 3: Championship Tournaments */}
              <button
                onClick={() => setShowTournamentsHub(true)}
                className="group relative p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/10 hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-black shadow-md shadow-amber-500/30 shrink-0 group-hover:scale-105 transition">
                    <Award className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    Ranked
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition flex items-center gap-2">
                    Championship Tournaments
                    <ChevronRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Single-elimination championship brackets (4, 8 & 16 players). Check in, climb placements, and win seasonal trophies.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="text-amber-400 font-semibold">Single Elimination</span>
                  <span className="text-gray-500">Seasonal Trophies & Ranks</span>
                </div>
              </button>

              {/* Card 4: Player Progress & Quick Stats */}
              <div
                onClick={onOpenProfile}
                className="group relative p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-gray-900/90 via-gray-900/60 to-gray-950 border border-gray-800 hover:border-gray-700 transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    style={{ backgroundColor: tier.colorHex }}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-black font-black text-lg shadow-md shrink-0 group-hover:scale-105 transition"
                  >
                    {tier.gemRank[0]}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-300 border border-gray-700 uppercase tracking-wide">
                    {user ? 'Authenticated' : 'Guest'}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition flex items-center gap-2">
                    {user && profile ? profile.displayName : 'Guest Rhythm Journey'}
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
                    Current Gem Rank: <strong className="text-white">{tier.gemRank}</strong> &bull; Level {progress?.level || 1}. Track your stats, accuracy, and highest streaks.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="text-gray-300 font-semibold">{progress?.xp ? `${progress.xp.toLocaleString()} XP` : '0 XP'}</span>
                  <span className="text-amber-400 font-semibold">{user ? 'View Full Profile &rarr;' : 'Sign In to Save &rarr;'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Instrument Selection View */
          <div className="w-full flex flex-col items-center gap-6 animate-fadeIn">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Choose Your Instrument
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Both instruments use the exact same 4-lane timing and scoring engine.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Piano Tiles */}
              <button
                onClick={() => onSelectInstrument('piano')}
                className="group relative flex flex-col items-center text-center p-6 rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-cyan-500/30 hover:border-cyan-400 transition duration-200 hover:shadow-xl hover:shadow-cyan-500/10 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="4" x2="7" y2="13" />
                    <line x1="11" y1="4" x2="11" y2="13" />
                    <line x1="15" y1="4" x2="15" y2="13" />
                    <line x1="9" y1="4" x2="9" y2="11" strokeWidth="3" />
                    <line x1="13" y1="4" x2="13" y2="11" strokeWidth="3" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">
                  Piano Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Falling neon keys, crisp contrast, and geometric hit-zone flow.
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-cyan-400 group-hover:underline">
                  Select Piano &rarr;
                </span>
              </button>

              {/* Guitar Tiles */}
              <button
                onClick={() => onSelectInstrument('guitar')}
                className="group relative flex flex-col items-center text-center p-6 rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-amber-500/30 hover:border-amber-400 transition duration-200 hover:shadow-xl hover:shadow-amber-500/10 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 6l4 4" />
                    <path d="M12 8l4 4" />
                    <circle cx="8" cy="16" r="5" />
                    <line x1="12" y1="12" x2="20" y2="4" />
                    <circle cx="8" cy="16" r="2" fill="currentColor" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-300">
                  Guitar Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Arcade fretboard perspective, steel string guides, and neon fret glows.
                </p>
                <span className="mt-4 inline-block text-xs font-semibold text-amber-400 group-hover:underline">
                  Select Guitar &rarr;
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowInstrumentSelect(false)}
              className="text-xs text-gray-400 hover:text-white transition mt-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700"
            >
              &larr; Back to Main Menu
            </button>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-5xl lg:max-w-6xl text-center border-t border-gray-900 pt-4 text-xs text-gray-500 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>PraiseTiles &copy; 2026. Browser-first gospel rhythm platform.</p>
          <div className="flex items-center gap-3">
            <p className="text-gray-400">
              Touch or Keyboard: <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-amber-300 font-mono text-[10px]">D</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-amber-300 font-mono text-[10px]">F</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-[10px]">J</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-[10px]">K</kbd>
            </p>
            <button
              type="button"
              onClick={() => setShowAudioEval(true)}
              className="text-[11px] text-gray-500 hover:text-cyan-400 transition flex items-center gap-1"
              title="Audio Intelligence Diagnostics"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Audio Diagnostics</span>
            </button>
          </div>
        </div>

        {/* Legal & Health Status Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-400 pt-1">
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="hover:text-amber-400 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
          >
            Terms of Service
          </button>
          <span>&bull;</span>
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="hover:text-amber-400 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
          >
            Privacy Policy & Audio Retention
          </button>
          <span>&bull;</span>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span>System Health (v7.0.0)</span>
          </a>
        </div>
      </footer>

      {/* Multiplayer Main Modal */}
      <MultiplayerModal
        isOpen={showMultiplayerModal}
        onClose={() => setShowMultiplayerModal(false)}
        onOpenAuth={onOpenAuth}
        onOpenQuickPlay={() => {
          setShowMultiplayerModal(false);
          setShowQuickPlayModal(true);
        }}
        onOpenPublicLobbies={() => {
          setShowMultiplayerModal(false);
          setShowPublicRoomsModal(true);
        }}
      />

      {/* Quick Play Matchmaking Modal */}
      <QuickPlayModal
        isOpen={showQuickPlayModal}
        onClose={() => setShowQuickPlayModal(false)}
        onOpenAuth={onOpenAuth}
      />

      {/* Public Rooms Browser Modal */}
      <PublicRoomBrowser
        isOpen={showPublicRoomsModal}
        onClose={() => setShowPublicRoomsModal(false)}
        onCreatePublicRoom={() => {
          setShowPublicRoomsModal(false);
          setShowMultiplayerModal(true);
        }}
        onOpenAuth={onOpenAuth}
      />

      {/* Friends & Social Hub Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        onOpenAuth={onOpenAuth}
      />

      {/* Competitive Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        onOpenAuth={onOpenAuth}
      />

      {/* Tournament Hub Modal */}
      <TournamentHub
        isOpen={showTournamentsHub}
        onClose={() => setShowTournamentsHub(false)}
        onOpenAuth={onOpenAuth}
      />

      {/* In-App Notification Drawer */}
      <NotificationDrawer
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Internal Audio Evaluation & Diagnostics Tool */}
      <AudioEvaluationTool
        isOpen={showAudioEval}
        onClose={() => setShowAudioEval(false)}
      />

      {/* Production Legal & Compliance Modals */}
      <TermsOfServiceModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};
