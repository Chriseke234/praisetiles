# PraiseTiles — Implementation Status

**Status Date:** 28 October 2026  
**Current Milestone:** Phase 4 Complete — Public Multiplayer, Quick Play, Friends, Profiles, Ranked Matches & Leaderboards  
**Product Title:** PraiseTiles (`praisetiles`)  
**Rules Version:** `4.0.0` (Conforms to `docs/GDD.md` and `docs/TECHNICAL_IMPLEMENTATION_PLAN.md`)

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

## 5. Test Verification & Results

```bash
# Unit & Integration Tests (Vitest)
npm test
# Result: 7 passed (103/103 tests passed)
# - tests/scoring.test.ts (16 tests)
# - tests/engine.test.ts (6 tests)
# - tests/audio.test.ts (8 tests)
# - tests/progression.test.ts (12 tests)
# - tests/auth.test.ts (5 tests)
# - tests/multiplayer.test.ts (29 tests)
# - tests/phase4_multiplayer.test.ts (27 tests)

# TypeScript Check
npx tsc --noEmit
# Result: 0 errors

# ESLint Check
npm run lint
# Result: 0 errors, 0 warnings

# Next.js 16.4.3 Turbopack Production Build
npm run build
# Result: ✓ Compiled successfully in 28.2s (All 15 routes optimized, 0 errors)
```
