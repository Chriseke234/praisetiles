# PraiseTiles — Implementation Status

**Status Date:** 31 October 2026  
**Current Milestone:** Phase 8 Complete — GDD Reconciliation & Remaining Game Implementation  
**Product Title:** PraiseTiles (`praisetiles`)  
**Rules Version:** `1.0.0` (Conforms to `docs/GDD.md` and `docs/TECHNICAL_IMPLEMENTATION_PLAN.md`)  
**Launch Recommendation:** **GO FOR PRODUCTION RELEASE**

---

## 1. Phase 1 Status Summary (Preserved & Intact)

The single-player vertical slice remains completely intact and verified:
- **Audio Validation & Decoding:** Size limits (15 MB), duration (30s–5m), and binary magic numbers for MP3, WAV, and MP4.
- **Rhythm Map Analyzer:** Browser-based energy-flux onset detection mapping dynamic transients to 4 lanes across 3 progressive stages without altering original audio speed.
- **Synthesized Gospel Track:** Royalty-free 120 BPM gospel praise track (C - G - Am - F) generator with kick, claps, and organ chords for instant zero-dependency play.
- **Shared 4-Lane Gameplay Engine:** Decoupled audio clock, millisecond-accurate note scheduling, `requestAnimationFrame` render loop.
- **Strict Failure Rules:** One incorrect tap or one missed note immediately terminates the run.
- **Presentations:** Distinct Piano Tiles (neon falling bars) and Guitar Tiles (fretboard perspective, strings, plectrum gems).
- **Provisional Timing Windows & Multipliers:** Perfect (±50ms), Great (±100ms), Good (±150ms); combo multiplier progression from 1.0x to 3.0x.

---

## 2. Phase 2 Features Implemented (Preserved & Active)

- **Schema:** `profiles`, `player_progress`, `player_stats`, `match_history` with strict RLS.
- **Progression:** 5 gem tiers (Quartz → Jade → Sapphire → Ruby → Diamond) with 3-factor promotion requirements (XP, accuracy, qualifying completed songs).
- **Authentication:** Supabase Auth, guest mode, and guest-to-account transfer modal.
- **Live Supabase Connected:** Configured and active on `ltrtkgerlfknhvqrrxwx.supabase.co`.

---

## 3. Phase 3 Features Implemented (Private Multiplayer)

- **Private Rooms:** Unguessable 8-character invite codes, host transfer, member readiness, nominations & voting with tie-breaking.
- **Synchronized Audio & Maps:** Upload via short-lived signed URLs, browser onset analysis, server-side map validation, scheduled start window.
- **Strict Elimination:** Missed notes terminate the runner without stopping other competitors.
- **Cleanup:** Temporary audio lifecycle cleanup.

---

## 4. Phase 4 Features Implemented (Public Multiplayer, Quick Play, Social & Ranked)

### 1. Configuration & Domain Types
- `src/config/social.ts`: Central social and competitive configuration:
  - Public rooms: default capacity 8, maximum 16, max 4 active competitors.
  - Matchmaking: 5s heartbeat interval, 15s timeout, initial ±100 Elo window expanding by 50 every 10s up to ±400.
  - Competitive rating: initial 1000 rating, minimum floor 100, provisional threshold 10 matches, K-factor 32 (provisional) vs 16 (established).
  - Room chat: 280-char limit, 1,500ms cooldown rate limit, SVG-only quick reactions (`amen`, `praise`, `hallelujah`, `fire`, `heart`, `blessed`). No emojis.
  - Moderation: report reasons (`harassment`, `hate_speech`, `spam`, `cheating`, `impersonation`, `other`).
- `src/types/social.ts`: Complete TypeScript definitions for `PublicRoomSummary`, `MatchmakingQueueEntry`, `Friendship`, `FollowerProfile`, `UserBlock`, `UserReport`, `UserPresence`, `RoomInvitation`, `CompetitiveRating`, `RatingHistoryEntry`, `LeaderboardEntry`, `RoomChatMessage`, `MatchShareData`.

### 2. Database Schema & RPC Functions
Location: `supabase/migrations/20261029000000_phase4_social_ranked.sql`
- **Room Alterations:** Added `name`, `is_public`, `room_mode` (`casual` vs `ranked`), `max_active_players = 4` to `rooms`. Added `is_active_player`, `seat_index` to `room_participants`.
- **New Tables with RLS:**
  - `matchmaking_queue`: Active queue pool with heartbeat timestamps and rating tracking.
  - `friendships`: Mutual friend requests and connections (`pending`, `accepted`, `declined`).
  - `follows`: One-way social follower graph.
  - `user_blocks`: Bidirectional interaction block list.
  - `user_reports`: Moderation report logs.
  - `room_invitations`: Direct in-app room invites with expiration.
  - `competitive_ratings`: Per-instrument & overall competitive ratings and provisional status.
  - `rating_history`: Audit trail for all ranked match adjustments.
  - `room_messages`: Text chat and quick reaction events per room.
- **SECURITY DEFINER Functions:**
  - `create_public_room`: Creates listed public room with configurable 8–16 capacity.
  - `join_public_room`: Validates total capacity (<= 16) and assigns active vs spectator slot (first 4 players are active competitors).
  - `queue_for_matchmaking`: Inserts or refreshes user queue entry.
  - `cancel_matchmaking`: Removes user from queue with 0 rating penalty.
  - `atomic_matchmaker`: Server-side FIFO/rating-window matching assembling groups of 2–4 players into an instant public room.
  - `calculate_ranked_elo`: Pairwise Elo updates with provisional multiplier and 100-rating floor.

### 3. Server API Routes
- `GET & POST /api/rooms/public`: Filterable public room discovery (mode, instrument, waiting-only, name query, pagination) and room creation.
- `POST & DELETE /api/matchmaking/queue`: Enter/heartbeat queue, poll match status, atomic matching, and cancel queue.
- `GET & POST /api/social/friends`: Mutual friend requests, accept, decline, and removal.
- `GET & POST /api/social/follow`: Follow and unfollow other praise players.
- `GET & POST /api/social/block`: Block and unblock players.
- `POST /api/social/report`: Submit moderation reports.
- `GET & POST /api/social/invite`: Send, accept, and decline direct room invitations.
- `GET /api/leaderboards`: 5-tab leaderboards (Global, Weekly, Piano, Guitar, Friends) with deterministic tie-breaking.

### 4. Realtime Contexts & Client State
- `src/lib/social/SocialContext.tsx`: Manages presence, invitations, friends, blocks, and Quick Play queue polling with heartbeats.
- `src/lib/multiplayer/ChatContext.tsx`: Lobby text chat and SVG quick reactions with 1,500ms rate limiting and 280-char enforcement.

### 5. UI Components & Menus
- `src/components/multiplayer/PublicRoomBrowser.tsx`: Full public room browser with filters, pagination, and instant join.
- `src/components/multiplayer/QuickPlayModal.tsx`: Instant matchmaking modal with radar animation, instrument/mode selection, and auto-redirect.
- `src/components/social/FriendsModal.tsx`: Social hub with Friends, Requests, Player Directory Search, and Block List tabs.
- `src/components/social/LeaderboardModal.tsx`: 5-tab competitive leaderboard with top-3 podium highlights.
- `src/components/social/ShareResultCard.tsx`: Web Share API card excluding private audio URLs and internal IDs.
- `src/components/multiplayer/RoomChat.tsx`: Collapsible lobby chat with quick reactions.
- `src/components/profile/ProfileModal.tsx`: Extended with competitive rating, provisional status, and ranked win stats.
- `src/components/menu/MainMenu.tsx`: Added Ranks and Social header buttons, pending invite notification banner, and modal mount points.

---

## 5. Phase 5 Features Implemented (Tournaments, Brackets, Seasons & Rewards)

### 1. Configuration & Domain Types
- `src/config/tournament.ts`: Central tournament system configuration:
  - Sizes: single-elimination for 4, 8, and 16 players (max 16).
  - Organizer roles: `platform_admin`, `approved_organizer`, `tournament_participant`, `tournament_viewer`.
  - Formats: single-elimination with round names mapped dynamically by capacity.
  - Song selection policies: `approved_pool`, `organizer_selected`, `voting`.
  - Approved gospel song pool with BPM and duration metadata.
  - 4-step tie-break policy: Score &gt; Accuracy &gt; Highest Combo &gt; Sudden Death.
  - Dispute reasons: `disconnection`, `desync`, `conduct`, `other` with 15-minute filing window.
  - Achievements catalog: 6 non-monetary badges (`first_tournament`, `first_tournament_win`, `tournament_finalist`, `tournament_champion`, `five_tournaments`, `clean_accuracy`).
  - Seasonal infrastructure: Season 1 points allocation (Champion: 100, Runner-up: 60, Semifinalist: 35, Quarterfinalist: 15, Participation: 5).
- `src/types/tournament.ts`: Full TypeScript domain types for `Tournament`, `TournamentParticipant`, `TournamentMatch`, `TournamentBracket`, `TournamentDispute`, `Season`, `SeasonStanding`, `Achievement`, `PlayerAchievement`, `InAppNotification`.

### 2. Database Schema & Functions
- `supabase/migrations/20261030000000_phase5_tournaments_seasons.sql`:
  - 10 tables: `tournament_organizers`, `seasons`, `tournaments`, `tournament_participants`, `tournament_matches`, `tournament_disputes`, `season_standings`, `achievements`, `player_achievements`, `notifications`.
  - Comprehensive RLS policies for organizers, participants, and viewers.
  - 4 Security Definer RPCs: `register_tournament_participant`, `check_in_tournament_participant`, `generate_single_elimination_bracket`, `advance_tournament_match_winner`.
  - Seed data for Season 1 and initial achievement catalog.

### 3. Server API Routes
- `src/app/api/tournaments/route.ts`: List tournaments with tab filtering and create new tournament with role verification.
- `src/app/api/tournaments/[id]/route.ts`: Get tournament details and update status/lifecycle controls.
- `src/app/api/tournaments/[id]/register/route.ts`: Participant registration and withdrawal.
- `src/app/api/tournaments/[id]/checkin/route.ts`: Idempotent participant check-in.
- `src/app/api/tournaments/[id]/bracket/route.ts`: Bracket tree retrieval and generation.
- `src/app/api/tournaments/[id]/matches/[matchId]/route.ts`: Match result recording and automatic round advancement.
- `src/app/api/tournaments/[id]/disputes/route.ts`: Filing and resolving tournament match disputes.
- `src/app/api/seasons/route.ts`: Current season and standings retrieval.
- `src/app/api/notifications/route.ts`: Fetch and mark read for in-app notification center.

### 4. Client State & UI Components
- `src/lib/tournament/TournamentContext.tsx`: Full React context for tournament actions, registrations, check-in, disputes, notifications, and season data.
- `src/components/tournament/TournamentHub.tsx`: Full-screen modal hub with status tabs, search, instrument filters, and season badge.
- `src/components/tournament/TournamentCard.tsx`: Rich visual tournament cards with capacity progress bars, real Unsplash images, and countdown timer.
- `src/components/tournament/TournamentWizardModal.tsx`: 4-step wizard for creating tournaments with chronological timeline validation.
- `src/components/tournament/TournamentDetailView.tsx`: Comprehensive tournament detail page with hero cover, register/check-in/withdraw actions, and 5 tabs (Bracket, Standings, Rules, Roster, Admin).
- `src/components/tournament/BracketViewer.tsx`: Interactive multi-round bracket visualization with participant seeding, scores, winner badges, and direct room join flow.
- `src/components/tournament/OrganizerAdminPanel.tsx`: Organizer console for tournament lifecycle management, bracket generation, and dispute resolution.
- `src/components/social/NotificationDrawer.tsx`: In-app notification center with read/unread tracking.
- `src/components/menu/MainMenu.tsx`: Added Tournaments nav button, notification bell with unread badge counter, and Championship Tournaments game mode tile.

---

## 6. Phase 6 Features Implemented (Advanced Audio Intelligence, Rhythm-Map Quality & Gameplay Depth)

### 1. Audio Preprocessing & Validation Hardening
- `src/lib/audio/validator.ts`:
  - Silence / near-silence detection (RMS &lt; 0.001, peak amplitude &lt; 0.005).
  - Widespread clipping detection (&gt; 15% samples clipped at &ge; 0.999).
  - Cancellation signal support (`AbortSignal`).
  - Diagnostic metrics returned in `AudioValidationResult` (`peakAmplitude`, `rmsEnergy`, `isNearSilent`, `isClipped`, `sampleRate`, `numberOfChannels`).

### 2. Multi-Band Spectral Flux Onset Detection & RhythmMap v2.0
- `src/config/audio.ts`: Version `2.0.0` audio configuration with 40ms frame size, 20ms hop size, 250 Hz crossover, 800ms local adaptive window, and 120ms duplicate suppression window.
- `src/types/audio.ts`: Complete types for `DifficultyProfile`, `RhythmMapV2`, `NoteV2`, `RhythmMapMetrics`, `AudioAnalysisDiagnostics`.
- `src/lib/audio/analyzer.ts`:
  - 2-Band Sub-band spectral flux: single-pole IIR low-pass filter isolating kick & bass (&lt; 250 Hz) and high-pass isolating percussive/melodic attacks (&gt; 250 Hz).
  - Sliding-window adaptive thresholding (`localMean + sensitivity * localStdDev`).
  - Duplicate onset suppression window (120ms).
  - Confidence scoring per candidate note (`0.0` - `1.0`).
  - Advisory tempo estimation via autocorrelation of the energy flux curve.
  - Deterministic FNV-1a checksum generation.

### 3. Playability & Integrity Validation Engine
- `src/lib/audio/mapValidator.ts`:
  - 7 playability rules: duration bounding, monotonic timestamp ordering, min 15 notes, min 100ms note spacing, max density cap (&le; 8 nps in 5s windows), lane balance (&le; 55% per lane), and difficulty spike limit (&le; 3x density increase).
- `src/app/api/rooms/[code]/map/route.ts`:
  - Updated server-side validation to enforce playability checks on all multiplayer and tournament maps before storing in Supabase.

### 4. Gameplay Presentation & Responsiveness
- `src/lib/game/engine.ts`:
  - Configurable audio-visual calibration offset (`±150ms`) for Bluetooth and mobile latency compensation.
  - Input event deduplication window (`30ms`) preventing touch/click double-firing on hybrid devices.
- `src/components/gameplay/GameContainer.tsx`:
  - Added latency calibration popup slider (`-150ms` to `+150ms`) in top bar with persistence in `localStorage`.
- `src/components/gameplay/PianoTilesView.tsx`:
  - Enhanced neon key illumination, hit beams, and floating hit splashes.
- `src/components/gameplay/GuitarTilesView.tsx`:
  - Enhanced fretboard strings with active vibration pulse and circular arcade gem notes.

### 5. Developer Audio Evaluation Tool
- `src/components/dev/AudioEvaluationTool.tsx`:
  - Dev-only evaluation console with HTML5 Canvas waveform & 3-Star stage boundary visualization.
  - Interactive candidate onset inspector with live difficulty profile switcher (`beginner`, `standard`, `advanced`).
  - Playability validation inspector and non-sensitive diagnostic JSON exporter.
  - Accessible via "Audio Diagnostics" button in `MainMenu.tsx` footer.

---

## 7. Phase 7 Features Implemented (Production Hardening, Security, Performance, Observability & Launch Readiness)

### 1. Security Hardening & Rate Limiting
- `src/lib/security/rateLimiter.ts`:
  - Sliding-window in-memory rate limiter with per-IP and per-user bucket keys.
  - Standard RFC 429 response helper with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
  - Rate limiting enforced on `/api/rooms/create` (10/min), `/api/rooms/[code]/upload` (5/min), `/api/matchmaking/queue` (20/min), `/api/social/report` (5/5min), `/api/social/friends` (30/min).
- `src/app/api/rooms/cleanup/route.ts`:
  - Hardened with fail-closed security logic: explicitly rejects requests with HTTP 503 if `CLEANUP_SECRET` is unset, and HTTP 401 if bearer token does not match.
- `next.config.ts`:
  - Comprehensive HTTP security headers: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and fine-grained `Content-Security-Policy` allowing Supabase and Unsplash assets.
- `src/lib/security/envValidator.ts`:
  - Centralized runtime environment validator ensuring critical variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are present and properly formed without leaking raw secret values.

### 2. Database Integrity & Composite Indexes
- `supabase/migrations/20261031000000_phase7_hardening_indexes.sql`:
  - `idx_rooms_status_public` on `rooms(status, is_public)` for rapid lobby filtering.
  - `idx_rooms_audio_expires` on `rooms(audio_expires_at)` for high-efficiency audio cleanup queries.
  - `idx_room_matches_room_status` on `room_matches(room_id, status)`.
  - `idx_match_scores_match_score` on `match_scores(match_id, score DESC)` for lightning leaderboard ranking.
  - `idx_profiles_competitive_rating` on `profiles(competitive_rating DESC)`.
  - `idx_tournament_participants_status` and `idx_tournament_matches_bracket`.
  - `idx_season_standings_rank` on `season_standings(season_id, tournament_points DESC)`.
  - `idx_friendships_lookup` and `idx_reports_status`.

### 3. Observability, Logging & Health Monitoring
- `src/lib/observability/logger.ts`:
  - Structured JSON logger outputting ISO timestamps, log level, event name, and safe metadata.
  - Deep recursive data sanitization masking passwords, tokens, bearer headers, service keys, and private credentials.
- `src/app/api/health/route.ts`:
  - Production health probe reporting overall status (`healthy`, `degraded`, `unhealthy`), uptime in seconds, Supabase connectivity ping, and memory utilization (RSS, heapUsed, heapTotal).
- `src/components/common/ErrorBoundary.tsx`:
  - Accessible client-side React error boundary with fallback interface, recovery retry actions, and SVG iconography.

### 4. Accessibility, Legal Compliance & UI Polish
- `src/components/legal/TermsOfServiceModal.tsx`:
  - Terms of service modal specifying gospel community focus, audio upload authorization, and competitive anti-cheat policies.
- `src/components/legal/PrivacyPolicyModal.tsx`:
  - Privacy policy and ephemeral audio lifecycle disclosure explaining 2-hour storage TTL and permanent deletion guarantees.
- `src/components/setup/AudioUploadModal.tsx`:
  - Explicit audio copyright and uploader authorization confirmation required before processing.
- `src/components/menu/MainMenu.tsx`:
  - Footer with accessible links to Terms of Service, Privacy Policy, and live System Health monitor.

### 5. Performance Optimization & Bundle Code-Splitting
- Lazy loaded heavyweight modal trees with `next/dynamic` (`PublicRoomBrowser`, `FriendsModal`, `LeaderboardModal`, `TournamentHub`, `AudioEvaluationTool`, `TermsOfServiceModal`, `PrivacyPolicyModal`).

---

## 8. Phase 8 Features Implemented (GDD Reconciliation & Remaining Game Implementation)

### 1. Requirement Traceability Matrix (GDD & Technical Plan)

| Req ID | Specification Source | Feature / Requirement | Implementation File(s) | Status | Verification Test |
|---|---|---|---|---|---|
| **REQ-A1** | GDD §1, §3 | Gospel-only praise theme & instrument selection | `src/components/menu/MainMenu.tsx`, `src/app/page.tsx` | Verified | `tests/engine.test.ts` |
| **REQ-A2** | GDD §3, §4 | Audio validation (MP3/WAV/MP4, 15MB, 30s-5m, binary headers) | `src/lib/audio/validator.ts`, `src/components/setup/AudioUploadModal.tsx` | Verified | `tests/audio.test.ts` |
| **REQ-A3** | GDD §4 | Synthetic royalty-free demo praise track (120 BPM, C-G-Am-F) | `src/lib/audio/synth.ts` | Verified | `tests/audio.test.ts` |
| **REQ-A4** | GDD §4, §6 | 3-Star progressive stage boundaries (33%, 66%, 100%) | `src/config/gameplay.ts`, `src/lib/game/scoring.ts` | Verified | `tests/scoring.test.ts`, `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-A5** | GDD §4 | Strict failure rule (MISSED_NOTE or INCORRECT_TAP fails immediately) | `src/lib/game/engine.ts` | Verified | `tests/engine.test.ts` |
| **REQ-A6** | GDD §4 | Scoring formula, accuracy weights & combo multipliers | `src/config/gameplay.ts`, `src/lib/game/scoring.ts` | Verified | `tests/scoring.test.ts`, `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-A7** | GDD §4, Open Decision #4 | Remappable 4-lane keyboard controls (defaults: D, F, J, K) | `src/hooks/useKeyBindings.ts`, `src/components/gameplay/GameContainer.tsx` | Verified | `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-A8** | GDD §3 | Short logo entrance animation | `src/app/globals.css` (`animate-brand-entrance`), `src/components/menu/MainMenu.tsx` | Verified | Production Build |
| **REQ-A9** | GDD §4 | Optional map preview bypass ("Quick Play") | `src/components/setup/AudioUploadModal.tsx`, `src/app/page.tsx` | Verified | `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-B1** | GDD §7 | Guest mode with sessionStorage & 50-run capping | `src/lib/auth/AuthContext.tsx` | Verified | `tests/auth.test.ts` |
| **REQ-B2** | GDD §7 | Authenticated accounts with Supabase Auth & RLS | `supabase/migrations/20261027000000_phase2_auth_progression.sql` | Verified | `tests/auth.test.ts` |
| **REQ-B3** | GDD §7 | 5 Gem Tiers (Quartz -> Jade -> Sapphire -> Ruby -> Diamond) & 3-factor promotion | `src/config/progression.ts` | Verified | `tests/progression.test.ts` |
| **REQ-B4** | GDD §7 | Anti-farming protection (15s minimum for 5 participation XP on failed runs) | `src/config/progression.ts` | Verified | `tests/progression.test.ts`, `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-B5** | GDD §7 | User profile settings & privacy toggle (`is_public`) | `src/app/api/profile/route.ts`, `src/components/profile/ProfileModal.tsx` | Verified | `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-B6** | GDD §7 | Preferred instrument persistence (`piano` vs `guitar`) | `supabase/migrations/20261101000000_phase8_profile_settings.sql`, `src/app/api/profile/route.ts` | Verified | `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-B7** | GDD §7 | GDPR/CCPA Account deletion path with anonymized match retention | `src/app/api/profile/route.ts` (`DELETE`), `src/components/profile/ProfileModal.tsx` | Verified | `tests/phase8_gdd_reconciliation.test.ts` |
| **REQ-C1** | GDD §8 | Private rooms (8-char codes, host transfer, member readiness, voting) | `src/components/multiplayer/MultiplayerModal.tsx`, `supabase/migrations/20261028000000_phase3_multiplayer_rooms.sql` | Verified | `tests/multiplayer.test.ts` |
| **REQ-C2** | GDD §8 | Shared audio upload via short-lived signed URLs & synchronized start | `src/app/api/rooms/[code]/upload/route.ts`, `src/app/api/rooms/[code]/map/route.ts` | Verified | `tests/multiplayer.test.ts` |
| **REQ-D1** | GDD §8 | Public room directory with capacity (8-16) & active slots (4) | `src/components/multiplayer/PublicRoomBrowser.tsx`, `src/app/api/rooms/public/route.ts` | Verified | `tests/phase4_multiplayer.test.ts` |
| **REQ-D2** | GDD §8 | Elo matchmaking & Quick Play queue with expanding rating search | `src/components/multiplayer/QuickPlayModal.tsx`, `src/app/api/matchmaking/queue/route.ts` | Verified | `tests/phase4_multiplayer.test.ts` |
| **REQ-D3** | GDD §8 | Friends, followers, player directory, block list, user reports | `src/components/social/FriendsModal.tsx`, `src/lib/social/SocialContext.tsx` | Verified | `tests/phase4_multiplayer.test.ts` |
| **REQ-E1** | GDD §9 | Single-elimination tournaments (4, 8, 16 players) with check-in & brackets | `src/components/tournament/TournamentHub.tsx`, `src/lib/tournament/TournamentContext.tsx` | Verified | `tests/phase5_tournaments.test.ts` |
| **REQ-E2** | GDD §9 | Seasons, tournament points, achievements & leaderboards | `src/components/tournament/TournamentHub.tsx`, `supabase/migrations/20261030000000_phase5_tournaments_seasons.sql` | Verified | `tests/phase5_tournaments.test.ts` |

### 2. GDD Open Decisions Register Resolution

| # | GDD Decision Item | GDD Question | Phase 8 Resolution & Status |
|---|---|---|---|
| **1** | Product Name | PraiseTiles vs working title | Standardized as **PraiseTiles** across app and metadata. |
| **2** | Rhythm Detection | Transcribe vs beat estimation | Documented as 2-band spectral flux onset estimation (not transcriptive). |
| **3** | Timing Windows | Provisional ±50/100/150ms | Implemented provisional windows with active latency calibration offset slider (±150ms). |
| **4** | Keyboard Remapping | Configurable vs fixed keys | **Resolved in Phase 8:** Implemented `useKeyBindings` hook with localStorage persistence, lane swapping, and interactive rebinding UI. |
| **5** | Room Size Limits | >4 players in private lobby | Configured to 4 active competitors, up to 16 total participants/spectators. |
| **6** | Reconnection Grace | Connection drop tolerance | Heartbeat timeout set to 15 seconds with reconnect window. |
| **7** | Audio Retention | Temporary vs persistent storage | Ephemeral 2-hour TTL with authenticated automatic server-side cleanup cron (`/api/rooms/cleanup`). |
| **8** | Chat Retention | Persistent vs in-memory | Stored in `room_messages` scoped to room lifecycle. |
| **9** | Tournament Scheduling | Check-in window duration | Configurable 15-minute check-in window with automatic forfeit for no-shows. |
| **10** | XP Progression | Scaling values | Defined in `src/config/progression.ts` with 3-factor promotion checklist. |
| **11** | Rating Algorithm | Elo vs Glicko | Pairwise Elo implemented with provisional K=32 and established K=16. |
| **12** | Failed Run XP | Participation reward | **Resolved in Phase 8:** 0 XP for <15s to prevent farming; 5 XP for runs >=15s. |

---

## 9. Test Verification & Results

```bash
# Unit & Integration Tests (Vitest)
npm test
# Result: 11 passed (217/217 tests passed, 100% success rate)
# - tests/phase8_gdd_reconciliation.test.ts (13 tests)
# - tests/phase7_production_hardening.test.ts (10 tests)
# - tests/phase6_audio_intelligence.test.ts (22 tests)
# - tests/phase5_tournaments.test.ts (69 tests)
# - tests/phase4_multiplayer.test.ts (27 tests)
# - tests/multiplayer.test.ts (29 tests)
# - tests/scoring.test.ts (16 tests)
# - tests/progression.test.ts (12 tests)
# - tests/audio.test.ts (8 tests)
# - tests/engine.test.ts (6 tests)
# - tests/auth.test.ts (5 tests)

# TypeScript Check
npx tsc --noEmit
# Result: 0 errors

# ESLint Check
npm run lint
# Result: 0 errors (clean)

# Next.js 16.4.3 Turbopack Production Build
npm run build
# Result: ✓ Compiled successfully (28/28 routes optimized, 0 errors)
```
