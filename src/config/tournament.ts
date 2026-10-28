/**
 * Central Tournament, Seasons & Rewards Configuration for PraiseTiles Phase 5
 * Version: 5.0.0
 *
 * Conforms to Single-Elimination rules for 4, 8, and 16 players.
 */

export const TOURNAMENT_CONFIG = {
  VERSION: '5.0.0',

  SIZES: {
    SUPPORTED: [4, 8, 16] as const,
    DEFAULT_CAPACITY: 8,
    MAX_CAPACITY: 16,
    MIN_REQUIRED: {
      4: 4,
      8: 4, // Tournament can proceed with byes or cancel if < 4
      16: 8,
    } as const,
  },

  ROLES: {
    ADMIN: 'platform_admin' as const,
    ORGANIZER: 'approved_organizer' as const,
    PARTICIPANT: 'tournament_participant' as const,
    VIEWER: 'tournament_viewer' as const,
  },

  FORMAT: {
    TYPE: 'single_elimination' as const,
    // Match round names based on tournament capacity
    ROUNDS: {
      16: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship Final'] as const,
      8: ['Quarterfinals', 'Semifinals', 'Championship Final'] as const,
      4: ['Semifinals', 'Championship Final'] as const,
    },
  },

  STATUSES: {
    TOURNAMENT: [
      'draft',
      'published',
      'registration_open',
      'registration_closed',
      'check_in',
      'bracket_ready',
      'in_progress',
      'paused',
      'completed',
      'cancelled',
    ] as const,

    PARTICIPANT: [
      'registered',
      'checked_in',
      'withdrawn',
      'disqualified',
      'no_show',
      'eliminated',
      'champion',
    ] as const,

    MATCH: [
      'pending',
      'ready',
      'playing',
      'completed',
      'forfeited',
      'disputed',
    ] as const,
  },

  SONG_POLICIES: [
    { id: 'approved_pool', label: 'Approved Gospel Pool', desc: 'Curated pool of royalty-free gospel hymns' },
    { id: 'organizer_selected', label: 'Organizer Selected', desc: 'Pre-selected gospel track set by organizer' },
    { id: 'voting', label: 'Nomination & Voting', desc: 'Players vote from nominated gospel songs before each round' },
  ] as const,

  APPROVED_SONG_POOL: [
    {
      id: 'hymn-amazing-grace',
      title: 'Amazing Grace (Praise Synth)',
      artist: 'PraiseTiles Ensemble',
      bpm: 120,
      duration: 104,
    },
    {
      id: 'hymn-blessed-assurance',
      title: 'Blessed Assurance (Gospel Arena)',
      artist: 'PraiseTiles Worship',
      bpm: 128,
      duration: 112,
    },
    {
      id: 'hymn-way-maker',
      title: 'Way Maker (Elevation Edit)',
      artist: 'Gospel Fellowship',
      bpm: 116,
      duration: 120,
    },
    {
      id: 'hymn-joyful-joyful',
      title: 'Joyful, Joyful We Adore Thee',
      artist: 'Kingdom Keys',
      bpm: 124,
      duration: 98,
    },
  ] as const,

  TIE_BREAK_POLICY: [
    { step: 1, name: 'Official Score', desc: 'Highest raw score achieved in qualifying run' },
    { step: 2, name: 'Accuracy Percentage', desc: 'Highest note accuracy %' },
    { step: 3, name: 'Highest Combo', desc: 'Longest consecutive streak of notes hit' },
    { step: 4, name: 'Sudden Death Rematch', desc: 'Single-round sudden death rematch on identical song' },
  ] as const,

  DISPUTES: {
    REASONS: [
      { id: 'disconnection', label: 'Unexpected Connection Drop' },
      { id: 'desync', label: 'Severe Audio / Note Desynchronization' },
      { id: 'conduct', label: 'Unsportsmanlike Conduct or Harassment' },
      { id: 'other', label: 'Other Administrative Issue' },
    ] as const,
    FILING_WINDOW_MINUTES: 15,
  },

  ACHIEVEMENTS: [
    {
      code: 'first_tournament',
      title: 'First Step to Glory',
      description: 'Registered and completed your first PraiseTiles tournament.',
      iconName: 'Award',
      badgeTier: 'bronze',
    },
    {
      code: 'first_tournament_win',
      title: 'Victorious Note',
      description: 'Won your first tournament elimination match.',
      iconName: 'Flame',
      badgeTier: 'silver',
    },
    {
      code: 'tournament_finalist',
      title: 'Grand Finalist',
      description: 'Advanced to the Championship Final in any tournament.',
      iconName: 'ShieldCheck',
      badgeTier: 'gold',
    },
    {
      code: 'tournament_champion',
      title: 'Praise Champion',
      description: 'Crowned 1st Place Champion of an official PraiseTiles tournament.',
      iconName: 'Trophy',
      badgeTier: 'platinum',
    },
    {
      code: 'five_tournaments',
      title: 'Dedicated Competitor',
      description: 'Participated in 5 or more completed tournaments.',
      iconName: 'Sparkles',
      badgeTier: 'silver',
    },
    {
      code: 'clean_accuracy',
      title: 'Virtuoso Precision',
      description: 'Achieved 98%+ accuracy in a tournament match.',
      iconName: 'Music',
      badgeTier: 'gold',
    },
  ] as const,

  SEASON: {
    CURRENT_SEASON_ID: 'season-1',
    DEFAULT_SEASON_NAME: 'Season 1: Foundation of Praise',
    POINTS: {
      CHAMPION: 100,
      RUNNER_UP: 60,
      SEMIFINALIST: 35,
      QUARTERFINALIST: 15,
      PARTICIPATION: 5,
    },
  },
} as const;

export type TournamentCapacity = typeof TOURNAMENT_CONFIG.SIZES.SUPPORTED[number];
export type TournamentRole = typeof TOURNAMENT_CONFIG.ROLES[keyof typeof TOURNAMENT_CONFIG.ROLES];
export type TournamentStatus = typeof TOURNAMENT_CONFIG.STATUSES.TOURNAMENT[number];
export type ParticipantStatus = typeof TOURNAMENT_CONFIG.STATUSES.PARTICIPANT[number];
export type TournamentMatchStatus = typeof TOURNAMENT_CONFIG.STATUSES.MATCH[number];
export type SongSelectionPolicy = typeof TOURNAMENT_CONFIG.SONG_POLICIES[number]['id'];
export type DisputeReason = typeof TOURNAMENT_CONFIG.DISPUTES.REASONS[number]['id'];
export type AchievementCode = typeof TOURNAMENT_CONFIG.ACHIEVEMENTS[number]['code'];
