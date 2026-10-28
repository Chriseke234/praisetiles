# PraiseTiles — Implementation Status

**Status Date:** 28 October 2026  
**Current Milestone:** Phase 3 Complete — Private Multiplayer Rooms, Song Voting & Synchronized Rhythm Matches  
**Product Title:** PraiseTiles (`praisetiles`)  
**Rules Version:** `3.0.0` (Conforms to `docs/GDD.md` and `docs/TECHNICAL_IMPLEMENTATION_PLAN.md`)

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

### 1. Centralized Multiplayer Configuration & Types
- `src/config/multiplayer.ts`: Version `3.0.0`, maximum 4 participants (`MAX_PARTICIPANTS`), 8-character invite codes (`INVITE_CODE_LENGTH`), nomination limits (3 per player, 12 total), nomination & voting duration windows, countdown window (5,000ms), coarse score broadcast intervals (2,000ms), and documented sync tolerance (~±500ms).
- `src/types/room.ts`: Full domain types for `RoomStatus`, `RoomParticipant`, `Nomination`, `Vote`, `RoomMatch`, `MatchParticipant`, `RoomState`, broadcast payloads, and API contracts.

### 2. Database Schema & Versioned Migrations
Location: `supabase/migrations/20261028000000_phase3_multiplayer_rooms.sql`
- **`rooms`:** id, unguessable 8-character uppercase alphanumeric `invite_code`, host user ID, status machine (`waiting`, `nominating`, `voting`, `uploading`, `ready_check`, `countdown`, `playing`, `finished`, `closed`), instrument, song metadata, checksum, scheduled start timestamp, audio storage path, and expiration timestamps.
- **`room_participants`:** room ID, user ID, host indicator, readiness status, connection state, joined timestamp.
- **`nominations`:** room ID, user ID, song title, artist, timestamps.
- **`votes`:** room ID, nomination ID, user ID (with unique constraint `UNIQUE(room_id, user_id)` preventing duplicate votes per round).
- **`room_matches`:** match ID (idempotency key), room ID, validated `map_json`, `map_checksum`, song title and fingerprint, instrument, scheduled start timestamp, status, and casual mode indicator (`is_casual = TRUE`).
- **`match_participants`:** match ID, user ID, score, accuracy, highest combo, completion status, elimination timestamp, placement, failure reason, and submission timestamp.
- **SECURITY DEFINER Functions:**
  - `create_room(instrument)`: securely generates unguessable 8-char code and sets host participant.
  - `join_room(invite_code)`: validates active room state and capacity before registering player.
  - `transfer_host(room_id, new_host_id)`: transfers host privileges to another connected member.
  - `set_player_ready(room_id, ready)`: updates participant readiness.
  - `leave_room(room_id)`: removes participant and automatically transfers host to next connected member or closes empty rooms.
  - `submit_map(room_id, map_json, checksum, song_title, song_fingerprint)`: validates map fields, creates match record, sets future scheduled start (now + 5000ms), and transitions room.
  - `finalize_match(...)`: idempotent result submission computing placement via SQL CASE expressions and non-blocking player progression integration.
- **Storage Bucket (`room-audio`):** Private bucket configuration with RLS for host uploads and participant downloads via signed URLs.

### 3. Server-Side API Routes (Zero Client Secrets)
- `POST /api/rooms/create`: Auth-gated room creation returning invite code.
- `POST /api/rooms/[code]/join`: Joins room via invite code.
- `POST /api/rooms/[code]/upload`: Host-only endpoint creating short-lived signed upload URLs for Supabase Storage without exposing service-role keys.
- `POST /api/rooms/[code]/map`: Server-side structural validation of the generated rhythm map before database persistence.
- `POST /api/rooms/[code]/match/finalize`: Idempotent match participant result finalization.
- `POST /api/rooms/cleanup`: Periodic audio cleanup endpoint protected by `CLEANUP_SECRET`.

### 4. Realtime Synchronization & Audio Architecture
- `src/lib/multiplayer/RoomContext.tsx`: Manages room state, Supabase Realtime channel (`room:{roomId}`), Postgres Changes subscription, and broadcast channels.
- **Coarse Live Updates:** Score snapshots broadcast every ~2s (avoiding per-tap Realtime flood).
- **Strict Elimination Continues Match:** When a player misses a note or taps incorrectly, their run terminates and broadcasts elimination, but remaining participants continue playing seamlessly.
- **Synchronized Start:** Scheduled future start timestamp (`scheduledStartAt`) triggers precise Web Audio API playback via `AudioContext` clock.
- **Casual Mode Labelling:** All results and opponent bars clearly document ~±500ms sync tolerance and casual competitive status.

### 5. Multiplayer UI Components & Navigation
- `src/components/multiplayer/RoomLobby.tsx`: Master room lifecycle orchestrator.
- `src/components/multiplayer/ParticipantList.tsx`: Player roster with host crown, readiness checks, gem rank badges, and connection indicators.
- `src/components/multiplayer/NominationPanel.tsx`: Song nomination input and list with per-player caps.
- `src/components/multiplayer/VotingPanel.tsx`: Live vote tallies with real-time percentages and countdown timer.
- `src/components/multiplayer/OpponentStatusBar.tsx`: Live HUD displaying opponents' scores, combos, and eliminated status.
- `src/components/multiplayer/RoomGameContainer.tsx`: Synchronized game engine container reusing existing engine and visual views.
- `src/components/multiplayer/MultiplayerResultScreen.tsx`: Placement table, scores, accuracies, and rematch flow.
- `src/components/multiplayer/MultiplayerModal.tsx`: Create or join room dialog accessible from Main Menu.
- `src/app/room/[code]/page.tsx`: Dynamic Partial Prerendered route supporting direct invite link sharing.

---

## 4. Test Verification & Results

```bash
# Unit & Integration Tests (Vitest)
npm test
# Result: 6 passed (76/76 tests passed)
# - tests/scoring.test.ts (16 tests)
# - tests/engine.test.ts (6 tests)
# - tests/audio.test.ts (8 tests)
# - tests/progression.test.ts (12 tests)
# - tests/auth.test.ts (5 tests)
# - tests/multiplayer.test.ts (29 tests)

# TypeScript Check
npx tsc --noEmit
# Result: 0 errors

# ESLint Check
npm run lint
# Result: 0 errors, 0 warnings

# Production Next.js Turbopack Build
npm run build
# Result: Compiled successfully; Partial Prerendering and dynamic routes verified
```

---

## 5. Required Environment Variables

Create `.env.local` based on `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> # Server-only (for signed URLs & cleanup)
CLEANUP_SECRET=<your-cleanup-secret>             # Optional, for audio cleanup route
```

---

## 6. How to Run Phase 3 Migration in Supabase

1. Open Supabase Dashboard for your project.
2. In SQL Editor, open `supabase/migrations/20261028000000_phase3_multiplayer_rooms.sql`.
3. Run each numbered block (Block 1: Tables, Block 2: RLS Policies, Block 3: Room Functions, Block 4: Match Functions, Block 5: Storage Bucket).
4. Run `npm run dev` to start creating rooms, inviting friends, and testing synchronized matches.
