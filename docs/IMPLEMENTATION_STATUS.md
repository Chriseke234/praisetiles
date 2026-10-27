# PraiseTiles — Implementation Status

**Status Date:** 27 October 2026  
**Current Milestone:** Phase 2 Complete — Authentication, Supabase, Player Profiles & Progression  
**Product Title:** PraiseTiles (`praisetiles`)  
**Rules Version:** `1.0.0` (Conforms to `docs/GDD.md` v1.0 specifications)

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

## 2. Phase 2 Features Implemented

### 1. Database Schema & Versioned Migrations
Location: `supabase/migrations/20261027000000_phase2_auth_progression.sql`
- **`profiles`:** User ID (linked to `auth.users`), unique normalized username (3–20 chars, alphanumeric/underscore), display name, avatar reference, privacy toggle (`is_public`), and timestamps. Email addresses are strictly hidden from public profiles.
- **`player_progress`:** User ID, total XP, player level, gem rank, qualifying completed song count, and rules version.
- **`player_stats`:** Songs attempted, songs completed, best completed score, best completed accuracy, highest combo, and separated statistics for Piano Tiles vs. Guitar Tiles.
- **`match_history`:** Unique match ID (idempotency key), user ID, instrument, song title, song fingerprint, score, accuracy, highest combo, elapsed time, completion status, failure reason, and rules version.

### 2. Security & Row Level Security (RLS)
- Strict RLS enabled on `profiles`, `player_progress`, `player_stats`, and `match_history`.
- Direct `UPDATE` and `INSERT` on `player_progress` and `player_stats` by regular authenticated users is disallowed.
- Progression and XP updates are handled through the trusted Postgres function `record_match_result` or server routes with idempotency checks to prevent duplicate submissions or score inflation.
- Private account data is accessible only by the owning authenticated user.

### 3. Player Progression & 3-Factor Gem Promotions
- Centralized configuration in `src/config/progression.ts`:
  - **Quartz** ("Pulse Starter"): Starting tier.
  - **Jade** ("Rhythm Keeper"): 80% accuracy, 3 qualifying completed songs, 300 XP.
  - **Sapphire** ("Groove Master"): 85% accuracy, 5 qualifying completed songs, 700 XP.
  - **Ruby** ("Virtuoso"): 90% accuracy, 7 qualifying completed songs, 1,500 XP.
  - **Diamond** ("Legend"): 95% accuracy, 10 qualifying completed songs, 3,000 XP.
- **Strict Progression Rule:** XP alone never unlocks a rank. Promotion requires meeting the XP threshold, the accuracy threshold, and the count of qualifying completed songs.
- Failed partial runs never count as completed songs toward records or rank promotion.
- Anti-farming limits: runs lasting under 15 seconds grant 0 XP; runs lasting >= 15 seconds grant 5 XP. Completed runs award full base XP weighted by accuracy, combo, and score.

### 4. Authentication, Guest Mode & Offline Resiliency
- Built-in `AuthProvider` (`src/lib/auth/AuthContext.tsx`) managing user session, profile, progress, and stats.
- **Offline / Unconfigured Fallback:** Safe detection of missing Supabase credentials via `isSupabaseConfigured()`. Guest mode operates seamlessly without crashing when Supabase is unconfigured or offline.
- **Guest Session Progress:** Guest match attempts and scores are tracked in `sessionStorage`.
- **Guest-to-Account Transfer:** When a guest registers or logs in, a prompt explains pending match records and requests explicit user confirmation to transfer progress without duplicates.

### 5. Player Profile & UI Components
- **`MainMenu.tsx`:** Displays authenticated profile pill with gem rank tier badge and avatar; or "Guest" badge with "Sign In" button.
- **`AuthModal.tsx`:** Clean, responsive dialog with Sign In and Account Registration tabs, input validation, and "Continue as Guest" fallback.
- **`ProfileModal.tsx`:** Modal displaying user avatar, gem rank title, level and XP progress bar, 3-factor promotion checklist, tabbed statistics (Overview, Piano Tiles, Guitar Tiles), and match history.
- **`TransferGuestModal.tsx`:** Confirmation dialog for merging guest session matches into the authenticated account.
- **`ResultScreen.tsx`:** Displays progression XP earned badge and non-blocking background result submission.

---

## 3. Test Verification & Results

```bash
# Unit & Integration Tests (Vitest)
npm test
# Result: 5 passed (47/47 tests passed in 16.78s)
# - tests/scoring.test.ts (16 tests)
# - tests/engine.test.ts (6 tests)
# - tests/audio.test.ts (8 tests)
# - tests/progression.test.ts (12 tests)
# - tests/auth.test.ts (5 tests)

# TypeScript Check
npx tsc --noEmit
# Result: 0 errors

# ESLint Check
npm run lint
# Result: 0 errors, 0 warnings

# Production Next.js Turbopack Build
npm run build
# Result: Compiled successfully in 8.0s; static routes generated
```

---

## 4. Required Environment Variables

Create `.env.local` based on `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> # Optional, server-only
```

---

## 5. Next Steps to Connect a Live Supabase Project

1. In Supabase Dashboard, create a new project.
2. In SQL Editor, run `supabase/migrations/20261027000000_phase2_auth_progression.sql`.
3. Copy the Project URL and Anon API key into `.env.local`.
4. Run `npm run dev` to test live authentication, profile persistence, and match history syncing.

---

## 6. Next Milestone (Milestone 3 — Private Multiplayer Proof)

- Private room lifecycle and member roles (Host, Participant).
- Song nominations and voting.
- Host upload with shared versioned rhythm map across players.
- Synchronized countdown and common scheduled start time via Web Audio clock.
- Strict elimination of failed players while remaining participants continue.
- Match results, tie-break resolution, and rematch loops.
