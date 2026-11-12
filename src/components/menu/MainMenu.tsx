'use client';

import React, { useRef } from 'react';
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
  Music,
  Compass,
  Radio,
  Clock,
  Heart,
  Share2,
  Headphones,
  Gamepad2,
  BookOpen,
  Info,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocial } from '@/lib/social/SocialContext';
import { useTournament } from '@/lib/tournament/TournamentContext';
import { getGemTier } from '@/config/progression';
import dynamic from 'next/dynamic';
import { BrandLogo } from '@/components/common/BrandLogo';
import { PraiseMascot } from '@/components/common/PraiseMascot';
import { MultiplayerModal } from '@/components/multiplayer/MultiplayerModal';
import { QuickPlayModal } from '@/components/multiplayer/QuickPlayModal';
import { NotificationDrawer } from '@/components/social/NotificationDrawer';
import { useRouter } from 'next/navigation';

/** Inline YouTube logo SVG — lucide-react does not export a Youtube icon in this version. */
const YoutubeSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M21.593 7.203a2.506 2.506 0 0 0-1.762-1.766C18.265 5.007 12 5 12 5s-6.264-.007-7.831.404a2.56 2.56 0 0 0-1.766 1.778c-.413 1.566-.417 4.814-.417 4.814s-.004 3.264.413 4.814c.23.857.905 1.534 1.762 1.766 1.582.43 7.83.437 7.83.437s6.265.007 7.831-.403a2.515 2.515 0 0 0 1.767-1.763c.414-1.565.417-4.812.417-4.812s.02-3.265-.413-4.826zM9.996 15.005l.005-6 5.207 3.005-5.212 2.995z" />
  </svg>
);

// Lazy-loaded heavyweight modal components for bundle splitting
const PublicRoomBrowser = dynamic(() => import('@/components/multiplayer/PublicRoomBrowser').then(m => m.PublicRoomBrowser), { ssr: false });
const FriendsModal = dynamic(() => import('@/components/social/FriendsModal').then(m => m.FriendsModal), { ssr: false });
const LeaderboardModal = dynamic(() => import('@/components/social/LeaderboardModal').then(m => m.LeaderboardModal), { ssr: false });
const TournamentHub = dynamic(() => import('@/components/tournament/TournamentHub').then(m => m.TournamentHub), { ssr: false });
const AudioEvaluationTool = dynamic(() => import('@/components/dev/AudioEvaluationTool').then(m => m.AudioEvaluationTool), { ssr: false });
const TermsOfServiceModal = dynamic(() => import('@/components/legal/TermsOfServiceModal').then(m => m.TermsOfServiceModal), { ssr: false });
const PrivacyPolicyModal = dynamic(() => import('@/components/legal/PrivacyPolicyModal').then(m => m.PrivacyPolicyModal), { ssr: false });
const ChallengePanel = dynamic(() => import('@/components/progression/ChallengePanel').then(m => m.ChallengePanel), { ssr: false });

interface MainMenuProps {
  onSelectInstrument: (instrument: InstrumentType, isPractice?: boolean) => void;
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
  const [showChallenges, setShowChallenges]             = React.useState(false);
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
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 bg-[#0b0816] text-gray-100 overflow-x-hidden">
      {/* Real Unsplash Worship Atmosphere Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-screen pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop')`,
        }}
      />

      {/* Atmospheric ambient lighting gradient overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[650px] h-[380px] bg-gradient-to-b from-purple-600/15 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

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

            {/* Challenges Hub Trigger */}
            <button
              onClick={() => setShowChallenges(true)}
              title="Daily & Weekly Challenges"
              className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-amber-500/40 text-gray-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="hidden lg:inline">Challenges</span>
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
      <main className="relative z-10 w-full max-w-6xl xl:max-w-7xl flex flex-col items-center justify-center my-auto py-8 sm:py-12 text-center space-y-16">
        {!showInstrumentSelect ? (
          <div className="w-full flex flex-col items-center gap-12 sm:gap-16">
            {/* HERO SECTION: Mascoted Desktop-First Banner */}
            <section className="relative w-full rounded-3xl bg-gradient-to-b from-[#130f24]/90 via-[#0e0c1a]/95 to-[#08070d] border border-purple-500/20 p-6 sm:p-10 lg:p-12 overflow-hidden shadow-2xl">
              {/* Subtle dotted halftone overlay */}
              <div className="absolute inset-0 bg-halftone-dots opacity-40 pointer-events-none" />

              {/* Ambient Radial Color Washes */}
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
                {/* Left Column: Headlines & Call to Actions */}
                <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Premier Gospel Rhythm Gaming Arena</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
                    YOUR MUSIC.<br />
                    <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
                      YOUR RHYTHM.
                    </span><br />
                    YOUR ARENA.
                  </h1>

                  <p className="text-sm sm:text-base text-gray-300 max-w-xl leading-relaxed">
                    Experience gospel music like never before. Play, compete and discover a growing world of gospel rhythm.
                  </p>

                  {/* Primary & Secondary CTAs */}
                  <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                    <button
                      onClick={() => setShowInstrumentSelect(true)}
                      className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm sm:text-base transition-all duration-200 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5"
                    >
                      <Play className="w-5 h-5 fill-black stroke-black" />
                      <span>ENTER THE ARENA</span>
                    </button>

                    <a
                      href="#featured-music"
                      className="px-6 py-3.5 rounded-2xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white font-bold text-sm sm:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 backdrop-blur-md shadow-md"
                    >
                      <Compass className="w-4 h-4 text-purple-400" />
                      <span>EXPLORE MUSIC</span>
                    </a>
                  </div>

                  {/* Quick Feature Badges */}
                  <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Zero latency 4-lane engine</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Direct touch & mouse tiles</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Realtime 4-player lobbies</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Aria Mascot & Visual Feature Card */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                  <div className="relative flex flex-col items-center">
                    <PraiseMascot
                      pose="welcoming"
                      size="xl"
                      showSpeechBubble
                      speechText="Welcome! Ready to play the rhythm?"
                      className="animate-brand-entrance"
                    />

                    {/* Featured Track Floating Capsule */}
                    <div className="mt-4 px-4 py-2.5 rounded-2xl bg-[#171426]/90 border border-purple-500/30 backdrop-blur-md shadow-lg flex items-center gap-3 max-w-xs">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-amber-500/40">
                        <img
                          src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=120&auto=format&fit=crop"
                          alt="Amazing Grace"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Featured Hymn</span>
                        <p className="text-xs font-bold text-white truncate">Amazing Grace (Praise Anthem)</p>
                        <p className="text-[10px] text-gray-400">120 BPM &bull; Piano &amp; Guitar</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION A: GAME MODES */}
            <section className="w-full space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-gray-800/80 pb-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    <Gamepad2 className="w-6 h-6 text-amber-400" />
                    <span>Select Game Mode</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    Choose your rhythm discipline and start your praise session.
                  </p>
                </div>
                <span className="text-xs font-mono text-purple-400">4 Lanes &bull; High Precision</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Solo Piano */}
                <button
                  onClick={() => onSelectInstrument('piano')}
                  className="group relative p-6 rounded-3xl bg-gradient-to-b from-[#131024] to-[#0c0a17] border border-cyan-500/30 hover:border-cyan-400 transition-all duration-200 hover:shadow-xl hover:shadow-cyan-500/15 hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
                        <Music className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">
                        Piano
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mt-4 group-hover:text-cyan-300 transition flex items-center gap-1.5">
                      Solo Piano
                      <ChevronRight className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      Follow the rhythm. Master every note.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-cyan-400 font-bold">Falling Keys</span>
                    <span className="text-gray-400 group-hover:text-white transition">Play Piano &rarr;</span>
                  </div>
                </button>

                {/* 2. Solo Guitar */}
                <button
                  onClick={() => onSelectInstrument('guitar')}
                  className="group relative p-6 rounded-3xl bg-gradient-to-b from-[#181124] to-[#0c0a17] border border-amber-500/30 hover:border-amber-400 transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/15 hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                        <Radio className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                        Guitar
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mt-4 group-hover:text-amber-300 transition flex items-center gap-1.5">
                      Solo Guitar
                      <ChevronRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      Feel the rhythm. Play every sequence.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-bold">Arcade Fretboard</span>
                    <span className="text-gray-400 group-hover:text-white transition">Play Guitar &rarr;</span>
                  </div>
                </button>

                {/* 3. Practice Mode */}
                <button
                  onClick={() => onSelectInstrument('piano', true)}
                  className="group relative p-6 rounded-3xl bg-gradient-to-b from-[#131224] to-[#0c0a17] border border-emerald-500/30 hover:border-emerald-400 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/15 hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                        <BookOpen className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                        Practice
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mt-4 group-hover:text-emerald-300 transition flex items-center gap-1.5">
                      Practice Mode
                      <ChevronRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      Learn the music at your own pace.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold">Safe Rehearsal</span>
                    <span className="text-gray-400 group-hover:text-white transition">Practice &rarr;</span>
                  </div>
                </button>

                {/* 4. Multiplayer Arena */}
                <button
                  onClick={() => setShowMultiplayerModal(true)}
                  className="group relative p-6 rounded-3xl bg-gradient-to-b from-[#1d0e2e] to-[#0c0a17] border border-purple-500/40 hover:border-purple-300 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md">
                        <Users className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                        Realtime
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mt-4 group-hover:text-purple-300 transition flex items-center gap-1.5">
                      Multiplayer
                      <ChevronRight className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                      Challenge friends and compete together.
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-purple-300 font-bold">Up to 4 Players</span>
                    <span className="text-gray-400 group-hover:text-white transition">Enter Lobby &rarr;</span>
                  </div>
                </button>
              </div>
            </section>

            {/* SECTION B: MUSIC STREAMING & PRAISE STUDIO */}
            <section id="featured-music" className="w-full space-y-6 text-left scroll-mt-24">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-gray-800/80 pb-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    <Headphones className="w-6 h-6 text-purple-400" />
                    <span>Praise Music Studio</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    Stream millions of worship songs, synchronize YouTube gospel videos, or upload your personal audio files.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Global Streaming Enabled
                </span>
              </div>

              {/* Music Studio Showcase Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Search & Stream Previews */}
                <div className="group rounded-3xl bg-[#110e1f] border border-gray-800 hover:border-purple-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                        Online Search &amp; Stream
                      </span>
                      <h3 className="text-lg font-black text-white mt-1 group-hover:text-purple-300 transition">
                        Streaming Music Search
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Instant discovery across global gospel artists: Maverick City, Kirk Franklin, Elevation, CeCe Winans, and more. Audition previews and play instantly.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowInstrumentSelect(true)}
                    className="mt-6 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Tracks</span>
                  </button>
                </div>

                {/* 2. YouTube Music Direct */}
                <div className="group rounded-3xl bg-[#110e1f] border border-gray-800 hover:border-red-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                      <YoutubeSvg className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                        YouTube IFrame Clock
                      </span>
                      <h3 className="text-lg font-black text-white mt-1 group-hover:text-red-300 transition">
                        YouTube Music Player
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Paste any YouTube or YouTube Music worship video URL. Our 60fps microsecond-interpolated clock synchronizes gameplay with the video stream.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowInstrumentSelect(true)}
                    className="mt-6 w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30"
                  >
                    <YoutubeSvg className="w-3.5 h-3.5" />
                    <span>Play YouTube</span>
                  </button>
                </div>

                {/* 3. Audio File Upload & Synth */}
                <div className="group rounded-3xl bg-[#110e1f] border border-gray-800 hover:border-amber-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Local Studio &amp; Synth
                      </span>
                      <h3 className="text-lg font-black text-white mt-1 group-hover:text-amber-300 transition">
                        Upload &amp; Demo Synth
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Upload custom MP3, WAV, or AAC audio files with browser multi-band transient detection, or synthesize an instant 120 BPM royalty-free praise hymn.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowInstrumentSelect(true)}
                    className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-black stroke-black" />
                    <span>Open Studio</span>
                  </button>
                </div>
              </div>
            </section>

            {/* SECTION C & D: COMMUNITY & COMPETITION HUB */}
            <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
              {/* Competition Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#151124] to-[#0c0a17] border border-amber-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Trophy className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                      Ranked Season 1
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mt-4">Championship Tournaments</h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                    Compete in single-elimination brackets with up to 16 players. Win seasonal trophies and advance your gem rank.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800/80 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    <span className="text-amber-400 font-bold">Weekly Prize Pools</span> &bull; 8-Player Brackets
                  </div>
                  <button
                    onClick={() => setShowTournamentsHub(true)}
                    className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>View Brackets</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Community & Progression Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#121021] to-[#0c0a17] border border-purple-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <Users className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 uppercase">
                      {user ? 'Verified Profile' : 'Guest Traveler'}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mt-4">
                    {user && profile ? profile.displayName : 'Join the PraiseTiles Community'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                    Track your personal rhythm streak, share songs with friends, and climb the global leaderboards with authentic Supabase syncing.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800/80 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    <strong className="text-white">{tier.gemRank}</strong> &bull; Level {progress?.level || 1}
                  </div>
                  <button
                    onClick={user ? onOpenProfile : onOpenAuth}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/25"
                  >
                    <span>{user ? 'My Profile' : 'Sign In / Register'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* Instrument Selection View */
          <div className="w-full flex flex-col items-center gap-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase">
                <Music className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Your Instrument</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white">
                Choose Your Rhythm Experience
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                Both instruments use the exact same 4-lane timing and scoring engine with custom tailored visuals.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Piano Tiles */}
              <button
                onClick={() => onSelectInstrument('piano')}
                className="group relative flex flex-col items-center text-center p-8 rounded-3xl bg-gradient-to-b from-[#131224] to-[#0c0a17] border border-cyan-500/40 hover:border-cyan-300 transition duration-300 hover:shadow-2xl hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center mb-5 group-hover:scale-110 transition shadow-lg">
                  <Music className="w-8 h-8 text-cyan-400 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-black text-white group-hover:text-cyan-300">
                  Piano Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Falling neon keys, high contrast geometric hit-zones, and elegant piano acoustic textures.
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-xs font-bold text-cyan-300 group-hover:bg-cyan-500 group-hover:text-black transition">
                  <span>Enter Piano Mode</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>

              {/* Guitar Tiles */}
              <button
                onClick={() => onSelectInstrument('guitar')}
                className="group relative flex flex-col items-center text-center p-8 rounded-3xl bg-gradient-to-b from-[#181124] to-[#0c0a17] border border-amber-500/40 hover:border-amber-300 transition duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mb-5 group-hover:scale-110 transition shadow-lg">
                  <Radio className="w-8 h-8 text-amber-400 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-black text-white group-hover:text-amber-300">
                  Guitar Tiles
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Arcade fretboard perspective, steel string guides, and warm overdriven acoustic guitar tone.
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300 group-hover:bg-amber-500 group-hover:text-black transition">
                  <span>Enter Guitar Mode</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowInstrumentSelect(false)}
              className="text-xs text-gray-400 hover:text-white transition px-5 py-2.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 flex items-center gap-1.5"
            >
              <span>&larr; Back to Main Menu</span>
            </button>
          </div>
        )}
      </main>

      {/* SECTION E: PREMIUM DESKTOP & MOBILE FOOTER */}
      <footer className="relative z-10 w-full max-w-6xl xl:max-w-7xl text-left border-t border-gray-900 pt-8 pb-4 text-xs text-gray-500 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand & Mission */}
          <div className="space-y-3">
            <BrandLogo size="sm" showSubtitle={false} />
            <p className="text-xs text-gray-400 leading-relaxed">
              PraiseTiles is a premier browser-based gospel rhythm gaming platform. Play worship music, climb competitive ranks, and compete with believers globally.
            </p>
            <p className="text-[11px] text-gray-600">
              &copy; 2026 PraiseTiles. All rights reserved.
            </p>
          </div>

          {/* Col 2: Game Modes */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Game Modes</h4>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li><button onClick={() => onSelectInstrument('piano')} className="hover:text-amber-400 transition">Solo Piano</button></li>
              <li><button onClick={() => onSelectInstrument('guitar')} className="hover:text-amber-400 transition">Solo Guitar</button></li>
              <li><button onClick={() => onSelectInstrument('piano')} className="hover:text-amber-400 transition">Practice Rehearsal</button></li>
              <li><button onClick={() => setShowMultiplayerModal(true)} className="hover:text-purple-400 transition">Realtime Multiplayer</button></li>
            </ul>
          </div>

          {/* Col 3: Community & Competition */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Competition</h4>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li><button onClick={() => setShowTournamentsHub(true)} className="hover:text-amber-400 transition">Tournaments &amp; Brackets</button></li>
              <li><button onClick={() => setShowLeaderboardModal(true)} className="hover:text-amber-400 transition">Global Leaderboards</button></li>
              <li><button onClick={() => setShowFriendsModal(true)} className="hover:text-cyan-400 transition">Friends &amp; Social Challenges</button></li>
              <li><button onClick={() => setShowAudioEval(true)} className="hover:text-cyan-400 transition flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-cyan-400" /> Audio Diagnostics</button></li>
            </ul>
          </div>

          {/* Col 4: Trust & Legal */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Trust &amp; Legal</h4>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li><button onClick={() => setShowTermsModal(true)} className="hover:text-amber-400 transition">Terms of Service</button></li>
              <li><button onClick={() => setShowPrivacyModal(true)} className="hover:text-amber-400 transition">Privacy &amp; Data Rights</button></li>
              <li><a href="/api/health" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Platform Status</a></li>
            </ul>
          </div>
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

      {/* Daily & Weekly Challenges Panel */}
      <ChallengePanel
        isOpen={showChallenges}
        onClose={() => setShowChallenges(false)}
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
