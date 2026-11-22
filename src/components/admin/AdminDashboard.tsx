'use client';

/**
 * AdminDashboard — Production-ready operations console for PraiseTiles (/admin).
 *
 * Modules:
 *   1. Live Overview & Real-Time Telemetry (players, active rooms, daily matches, DB health)
 *   2. Player Directory & Conduct Moderation Queue
 *   3. Tournament Brackets & Dispute Resolution Desk
 *   4. Approved Song Pool & Rhythm Map Health Auditor
 *
 * Pure Lucide SVG icons (no emojis). Fully responsive across mobile, tablet, and desktop.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Music,
  ShieldAlert,
  Activity,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Menu,
  X,
  Lock,
  Database,
  Radio,
  Eye,
  EyeOff,
  AlertTriangle,
  Sliders,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';

type AdminTab = 'overview' | 'players' | 'tournaments' | 'content';

interface OverviewPayload {
  metrics: {
    totalPlayers: number;
    activeRooms: number;
    totalMatches: number;
    matchesToday: number;
    completionRate: number;
    avgAccuracy: number;
    totalXpDistributed: number;
    openReports: number;
    openDisputes: number;
    activeTournaments: number;
  };
  rankDistribution: Record<string, number>;
  activeRoomsList: {
    id: string;
    code: string;
    status: string;
    instrument: string;
    mode: string;
    created_at: string;
  }[];
  recentMatches: {
    id: string;
    playerName: string;
    username: string;
    instrument: string;
    score: number;
    accuracy: number;
    highestCombo: number;
    completed: boolean;
    createdAt: string;
  }[];
  health: {
    status: 'healthy' | 'degraded';
    dbLatencyMs: number;
    usingServiceRole: boolean;
    checkedAt: string;
  };
}

interface PlayerRow {
  id: string;
  username: string;
  displayName: string;
  isPublic: boolean;
  preferredInstrument: string;
  createdAt: string;
  xp: number;
  level: number;
  gemRank: string;
  bestScore: number;
  songsCompleted: number;
  highestCombo: number;
  rating: number;
  rankedWins: number;
  rankedMatches: number;
}

interface ReportRow {
  id: string;
  reporterName: string;
  reportedName: string;
  reportedUsername: string;
  reason: string;
  details: string;
  createdAt: string;
}

interface TournamentRow {
  id: string;
  title: string;
  slug: string;
  instrument: string;
  capacity: number;
  status: string;
  eventType: string;
  startAt: string;
}

interface DisputeRow {
  id: string;
  tournamentTitle: string;
  matchId: string;
  filedByName: string;
  reason: string;
  description: string;
  status: 'pending' | 'upheld' | 'rejected';
  resolutionNotes: string;
  createdAt: string;
}

interface ContentPayload {
  approvedPool: {
    id: string;
    title: string;
    artist: string;
    bpm: number;
    duration: number;
  }[];
  analyzerConfig: {
    version: string;
    minDurationSec: number;
    maxDurationSec: number;
    maxLaneConcentration: number;
    maxDifficultySpike: number;
  };
  auditedMaps: {
    mapId: string;
    plays: number;
    completionRate: number;
    avgAccuracy: number;
    avgNotes: number;
    healthStatus: 'healthy' | 'review' | 'warning';
    lastPlayedAt: string;
  }[];
}

const RANK_COLORS: Record<string, string> = {
  Quartz: 'bg-slate-400',
  Jade: 'bg-emerald-400',
  Sapphire: 'bg-cyan-400',
  Ruby: 'bg-rose-400',
  Diamond: 'bg-purple-400',
};

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Live Overview', icon: LayoutDashboard },
  { id: 'players', label: 'Players & Reports', icon: Users },
  { id: 'tournaments', label: 'Tournaments & Disputes', icon: Trophy },
  { id: 'content', label: 'Songs & Map Health', icon: Music },
];

export const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth / Error state
  const [authStatus, setAuthStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data slices
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playersTotal, setPlayersTotal] = useState(0);
  const [playerPage, setPlayerPage] = useState(1);
  const [playerQuery, setPlayerQuery] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [contentData, setContentData] = useState<ContentPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return null;
    return {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) {
      setAuthStatus('unauthorized');
      setAuthError('Please sign in with a platform administrator account to access this console.');
      return;
    }

    const res = await fetch('/api/admin/overview', { headers });
    if (res.status === 401 || res.status === 403) {
      const json = await res.json().catch(() => ({}));
      setAuthStatus('unauthorized');
      setAuthError(json.error ?? 'Platform administrator privileges are required.');
      return;
    }

    if (res.ok) {
      const json: OverviewPayload = await res.json();
      setOverview(json);
      setAuthStatus('authorized');
      setAuthError(null);
    }
  }, [getAuthHeaders]);

  const fetchPlayersAndReports = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    const params = new URLSearchParams({
      page: String(playerPage),
      pageSize: '15',
      ...(playerQuery.trim() ? { q: playerQuery.trim() } : {}),
    });

    const [playersRes, reportsRes] = await Promise.all([
      fetch(`/api/admin/players?${params.toString()}`, { headers }),
      fetch('/api/admin/reports', { headers }),
    ]);

    if (playersRes.ok) {
      const json = await playersRes.json();
      setPlayers(json.players ?? []);
      setPlayersTotal(json.total ?? 0);
    }
    if (reportsRes.ok) {
      const json = await reportsRes.json();
      setReports(json.reports ?? []);
    }
  }, [getAuthHeaders, playerPage, playerQuery]);

  const fetchTournaments = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/admin/tournaments', { headers });
    if (res.ok) {
      const json = await res.json();
      setTournaments(json.tournaments ?? []);
      setDisputes(json.disputes ?? []);
    }
  }, [getAuthHeaders]);

  const fetchContent = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/admin/content', { headers });
    if (res.ok) {
      const json: ContentPayload = await res.json();
      setContentData(json);
    }
  }, [getAuthHeaders]);

  const refreshActiveTab = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchOverview();
      if (activeTab === 'players') await fetchPlayersAndReports();
      if (activeTab === 'tournaments') await fetchTournaments();
      if (activeTab === 'content') await fetchContent();
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, fetchOverview, fetchPlayersAndReports, fetchTournaments, fetchContent]);

  // Initial load + tab change loader
  useEffect(() => {
    void refreshActiveTab();
  }, [refreshActiveTab, user]);

  // Moderation Actions
  const handleTogglePlayerPublic = async (userId: string, nextPublic: boolean) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/admin/players', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ userId, isPublic: nextPublic }),
    });
    if (res.ok) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, isPublic: nextPublic } : p))
      );
      showToast(nextPublic ? 'Player profile set to public' : 'Player profile hidden from public boards');
    }
  };

  const handleDismissReport = async (reportId: string) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/admin/reports?id=${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showToast('Conduct report resolved and cleared');
      void fetchOverview();
    }
  };

  const handleTournamentStatusChange = async (tournamentId: string, status: string) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/admin/tournaments', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'update_tournament_status', tournamentId, status }),
    });
    if (res.ok) {
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournamentId ? { ...t, status } : t))
      );
      showToast(`Tournament status updated to ${status.replace('_', ' ')}`);
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: 'upheld' | 'rejected') => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/admin/tournaments', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        action: 'resolve_dispute',
        disputeId,
        resolution,
      }),
    });
    if (res.ok) {
      setDisputes((prev) =>
        prev.map((d) => (d.id === disputeId ? { ...d, status: resolution } : d))
      );
      showToast(`Dispute marked as ${resolution}`);
      void fetchOverview();
    }
  };

  // Unauthorized Gate
  if (authStatus === 'unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#07080d]">
        <div className="max-w-md w-full bg-[#10121c] border border-gray-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-rose-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight">Admin Access Restricted</h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              {authError ?? 'You need platform_admin privileges to view the PraiseTiles Operations Dashboard.'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 text-left text-[11px] text-gray-400 space-y-1">
            <p className="font-bold text-gray-300">How to grant admin access:</p>
            <p>1. Insert your user ID into <code className="text-amber-300">tournament_organizers</code> with role <code className="text-amber-300">platform_admin</code>, or</p>
            <p>2. Add your email to <code className="text-amber-300">ADMIN_EMAILS</code> in <code className="text-amber-300">.env.local</code>.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Arena</span>
            </Link>
            <button
              onClick={() => void refreshActiveTab()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Access</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalRankPlayers = Object.values(overview?.rankDistribution ?? {}).reduce(
    (sum, n) => sum + n,
    0
  );
  const totalPlayerPages = Math.max(1, Math.ceil(playersTotal / 15));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#07080d] text-gray-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0c0e17] border-r border-gray-800/80">
        <div className="p-6 border-b border-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider uppercase text-white block">
                PraiseTiles
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Admin Console
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900/70 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/80 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800/80">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Signed In</p>
            <p className="text-xs font-bold text-white truncate mt-0.5">
              {profile?.displayName ?? user?.email ?? 'Administrator'}
            </p>
          </div>
          <Link
            href="/"
            className="w-full py-2.5 px-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center gap-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Game</span>
          </Link>
        </div>
      </aside>

      {/* Mobile / Tablet Header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0c0e17]/95 backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <span className="text-sm font-black uppercase tracking-wider text-white">
            Admin Console
          </span>
        </div>
        <button
          onClick={() => void refreshActiveTab()}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-amber-400"
          aria-label="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0c0e17] border-b border-gray-800 p-3 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <Link
            href="/"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white border-t border-gray-800 mt-2 pt-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Game</span>
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Banner with Real Unsplash Atmospheric Accent */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-800/80 bg-[#0f111c] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1400&q=80"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
          />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Radio className="w-3 h-3" />
                <span>{overview?.health.status === 'degraded' ? 'Degraded' : 'System Live'}</span>
              </span>
              {overview?.health && (
                <span className="text-[11px] font-mono text-gray-400">
                  DB {overview.health.dbLatencyMs}ms
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {NAV_ITEMS.find((i) => i.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-gray-400">
              Real-time game telemetry, player moderation, tournament desk, and song map health.
            </p>
          </div>

          <button
            onClick={() => void refreshActiveTab()}
            disabled={isRefreshing}
            className="relative z-10 self-start sm:self-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toast}</span>
          </div>
        )}

        {/* TAB 1: LIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total Players"
                value={(overview?.metrics.totalPlayers ?? 0).toLocaleString()}
                subtext={`${(overview?.metrics.totalXpDistributed ?? 0).toLocaleString()} total XP`}
                icon={Users}
                accent="text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
              />
              <StatCard
                label="Active Rooms"
                value={String(overview?.metrics.activeRooms ?? 0)}
                subtext={`${overview?.metrics.activeTournaments ?? 0} active tournaments`}
                icon={Activity}
                accent="text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              />
              <StatCard
                label="Matches Today"
                value={String(overview?.metrics.matchesToday ?? 0)}
                subtext={`${overview?.metrics.completionRate ?? 0}% clear • ${overview?.metrics.avgAccuracy ?? 0}% avg acc`}
                icon={Trophy}
                accent="text-amber-400 bg-amber-500/10 border-amber-500/30"
              />
              <StatCard
                label="Moderation Queue"
                value={String(
                  (overview?.metrics.openReports ?? 0) + (overview?.metrics.openDisputes ?? 0)
                )}
                subtext={`${overview?.metrics.openReports ?? 0} reports • ${overview?.metrics.openDisputes ?? 0} disputes`}
                icon={ShieldAlert}
                accent="text-rose-400 bg-rose-500/10 border-rose-500/30"
              />
            </div>

            {/* Rank Distribution & System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section className="lg:col-span-7 bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Gem Rank Distribution
                  </h2>
                  <span className="text-[11px] font-mono text-gray-400">
                    {totalRankPlayers} ranked profiles
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(overview?.rankDistribution ?? {}).map(([rank, count]) => {
                    const pct =
                      totalRankPlayers > 0 ? Math.round((count / totalRankPlayers) * 100) : 0;
                    return (
                      <div key={rank} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-gray-200">{rank}</span>
                          <span className="font-mono text-gray-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-900 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${RANK_COLORS[rank] ?? 'bg-amber-400'}`}
                            style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="lg:col-span-5 bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>Supabase Health</span>
                  </h2>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {overview?.health.status ?? 'checking'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">
                      Query Latency
                    </span>
                    <span className="text-lg font-black font-mono text-white">
                      {overview?.health.dbLatencyMs ?? 0}ms
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-900/70 border border-gray-800">
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">
                      Total Matches
                    </span>
                    <span className="text-lg font-black font-mono text-amber-300">
                      {(overview?.metrics.totalMatches ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/80 text-[11px] text-gray-400">
                  Privileged Mode:{' '}
                  <span className="font-bold text-gray-200">
                    {overview?.health.usingServiceRole
                      ? 'Service Role Active'
                      : 'Authenticated Admin JWT'}
                  </span>
                </div>
              </section>
            </div>

            {/* Active Rooms & Recent Match Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <section className="xl:col-span-5 bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Active Multiplayer Rooms
                </h2>
                {(overview?.activeRoomsList ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    No active rooms right now.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {overview?.activeRoomsList.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 text-xs"
                      >
                        <div>
                          <span className="font-mono font-black text-amber-300">{room.code}</span>
                          <span className="text-gray-400 ml-2 capitalize">
                            {room.instrument} • {room.mode}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {room.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="xl:col-span-7 bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-3 overflow-x-auto">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Recent Match Activity
                </h2>
                <table className="w-full text-left text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Mode</th>
                      <th className="pb-2 text-right">Score</th>
                      <th className="pb-2 text-right">Accuracy</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {(overview?.recentMatches ?? []).map((m) => (
                      <tr key={m.id} className="hover:bg-gray-900/40">
                        <td className="py-2.5 font-bold text-white">{m.playerName}</td>
                        <td className="py-2.5 capitalize text-gray-400">{m.instrument}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-amber-300">
                          {m.score.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right font-mono text-cyan-300">
                          {m.accuracy.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              m.completed
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {m.completed ? 'Cleared' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(overview?.recentMatches ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-500">
                          No match records found yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: PLAYERS & MODERATION */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            {/* Searchable Player Directory */}
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Player Directory ({playersTotal})
                </h2>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={playerQuery}
                    onChange={(e) => {
                      setPlayerQuery(e.target.value);
                      setPlayerPage(1);
                    }}
                    placeholder="Search username or display name..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="pb-2.5">Player</th>
                      <th className="pb-2.5">Rank / Level</th>
                      <th className="pb-2.5 text-right">Elo Rating</th>
                      <th className="pb-2.5 text-right">Best Score</th>
                      <th className="pb-2.5 text-right">Songs</th>
                      <th className="pb-2.5 text-right">Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {players.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-900/40">
                        <td className="py-3">
                          <p className="font-bold text-white">{p.displayName}</p>
                          <p className="text-[10px] text-gray-500">@{p.username}</p>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {p.gemRank} • Lv.{p.level}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-amber-300">
                          {p.rating}
                        </td>
                        <td className="py-3 text-right font-mono text-gray-200">
                          {p.bestScore.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono text-gray-400">
                          {p.songsCompleted}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => void handleTogglePlayerPublic(p.id, !p.isPublic)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              p.isPublic
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                            }`}
                          >
                            {p.isPublic ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Public</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No matching players found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPlayerPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-800/80 text-xs text-gray-400">
                  <span>
                    Page {playerPage} of {totalPlayerPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPlayerPage((p) => Math.max(1, p - 1))}
                      disabled={playerPage <= 1}
                      className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPlayerPage((p) => Math.min(totalPlayerPages, p + 1))}
                      disabled={playerPage >= totalPlayerPages}
                      className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* User Conduct Reports Queue */}
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Conduct Reports Queue ({reports.length})</span>
              </h2>
              {reports.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">
                  No open user conduct reports. Community is clean.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-rose-300 uppercase">
                            {r.reason}
                          </span>
                          <span className="text-xs text-gray-400">
                            Target: <strong className="text-white">{r.reportedName}</strong> (@
                            {r.reportedUsername})
                          </span>
                        </div>
                        {r.details && <p className="text-xs text-gray-300">{r.details}</p>}
                        <p className="text-[10px] text-gray-500">
                          Filed by {r.reporterName} • {new Date(r.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleDismissReport(r.id)}
                        className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-rose-500/20 border border-gray-700 hover:border-rose-500/40 text-xs font-bold text-gray-200 hover:text-rose-200 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Resolve &amp; Clear</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: TOURNAMENTS & DISPUTES */}
        {activeTab === 'tournaments' && (
          <div className="space-y-6">
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4 overflow-x-auto">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Championship Tournaments ({tournaments.length})
              </h2>
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="pb-2.5">Tournament</th>
                    <th className="pb-2.5">Instrument</th>
                    <th className="pb-2.5">Capacity</th>
                    <th className="pb-2.5">Start Time</th>
                    <th className="pb-2.5 text-right">Status Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {tournaments.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-900/40">
                      <td className="py-3">
                        <p className="font-bold text-white">{t.title}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{t.eventType}</p>
                      </td>
                      <td className="py-3 capitalize text-gray-300">{t.instrument}</td>
                      <td className="py-3 font-mono text-amber-300">{t.capacity} Players</td>
                      <td className="py-3 text-gray-400">
                        {new Date(t.startAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <select
                          value={t.status}
                          onChange={(e) => void handleTournamentStatusChange(t.id, e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="registration_open">Registration Open</option>
                          <option value="check_in">Check-In</option>
                          <option value="in_progress">In Progress</option>
                          <option value="paused">Paused</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {tournaments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No tournaments created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Dispute Resolution Desk */}
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Match Disputes Desk ({disputes.length})</span>
              </h2>
              {disputes.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">
                  No tournament disputes filed.
                </p>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white">{d.tournamentTitle}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300">
                            {d.reason}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              d.status === 'pending'
                                ? 'bg-rose-500/15 text-rose-300'
                                : d.status === 'upheld'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">{d.description}</p>
                        <p className="text-[10px] text-gray-500">
                          Filed by {d.filedByName} • {new Date(d.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {d.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => void handleResolveDispute(d.id, 'upheld')}
                            className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Uphold</span>
                          </button>
                          <button
                            onClick={() => void handleResolveDispute(d.id, 'rejected')}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: SONG & MAP HEALTH */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Approved Gospel Pool */}
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Approved Gospel Hymn Pool
                </h2>
                {contentData?.analyzerConfig && (
                  <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Engine {contentData.analyzerConfig.version}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(contentData?.approvedPool ?? []).map((song) => (
                  <div
                    key={song.id}
                    className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{song.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{song.artist}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-xs font-bold text-amber-300 block">{song.bpm} BPM</span>
                      <span className="text-[10px] text-gray-500">
                        {Math.floor(song.duration / 60)}:
                        {String(song.duration % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Audited Rhythm Maps Health */}
            <section className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 space-y-4 overflow-x-auto">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Rhythm Map Playability Audit
              </h2>
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="pb-2.5">Map Fingerprint</th>
                    <th className="pb-2.5 text-right">Plays</th>
                    <th className="pb-2.5 text-right">Avg Notes</th>
                    <th className="pb-2.5 text-right">Clear Rate</th>
                    <th className="pb-2.5 text-right">Avg Accuracy</th>
                    <th className="pb-2.5 text-right">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {(contentData?.auditedMaps ?? []).map((m) => (
                    <tr key={m.mapId} className="hover:bg-gray-900/40">
                      <td className="py-2.5 font-mono text-gray-200 max-w-[200px] truncate">
                        {m.mapId}
                      </td>
                      <td className="py-2.5 text-right font-mono text-white">{m.plays}</td>
                      <td className="py-2.5 text-right font-mono text-gray-400">{m.avgNotes}</td>
                      <td className="py-2.5 text-right font-mono text-amber-300">
                        {m.completionRate}%
                      </td>
                      <td className="py-2.5 text-right font-mono text-cyan-300">
                        {m.avgAccuracy}%
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.healthStatus === 'healthy'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : m.healthStatus === 'review'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {m.healthStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(contentData?.auditedMaps ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No map telemetry recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, icon: Icon, accent }) => (
  <div className="bg-[#0e101a] border border-gray-800/80 rounded-2xl p-5 flex items-start justify-between gap-3">
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">{value}</p>
      <p className="text-[11px] text-gray-500 truncate">{subtext}</p>
    </div>
    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${accent}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);
