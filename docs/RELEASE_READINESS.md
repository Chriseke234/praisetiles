# PraiseTiles — MVP Release Readiness & Scope Decision

**Document Date:** 31 October 2026  
**Milestone:** Phase 9 Complete — Release Audit & Scope Recommendation  
**Product Title:** PraiseTiles (`praisetiles`)  
**Recommendation:** **GO FOR PUBLIC MVP RELEASE**

---

## 1. Executive Summary

PraiseTiles has satisfied all core gameplay, security, audio processing, multiplayer, and progression requirements set forth in `docs/GDD.md` and `docs/TECHNICAL_IMPLEMENTATION_PLAN.md`.

- **Test Suite:** 12 test files passed, 238/238 automated tests passing (100% success rate).
- **Type Safety:** 0 TypeScript compilation errors under strict configuration.
- **Code Quality:** 0 ESLint errors or warnings.
- **Production Build:** Successfully compiled and optimized via Next.js Turbopack across all 28 dynamic and static routes.
- **Database:** Supabase schema fully hardened with Row Level Security, idempotent migration scripts, and composite query indexes.

---

## 2. Capability Audit: What Is Genuinely Ready

| System | Capabilities Verified | Release Status |
|---|---|---|
| **Core Solo Gameplay** | 4-lane engine, Piano & Guitar presentations, decoupled audio clock, 1.8s approach, latency calibration slider (±150ms). | **Ready for Production** |
| **Strict Failure Engine** | Immediate termination on missed required note or incorrect tap with failure attribution (`MISSED_NOTE`, `INCORRECT_TAP`). | **Ready for Production** |
| **Scoring & Progression** | Base points (1000/750/500), combo multipliers (1.0x to 3.0x), weighted accuracy formula, 5 gem tiers (Quartz → Diamond), 3-factor promotion checklist, anti-farming protection. | **Ready for Production** |
| **Audio Pipeline** | Binary magic-byte inspection (MP3, WAV, MP4), 15MB size limit, 30s–300s duration bounds, synthetic 120 BPM gospel demo hymn fallback, 2-band spectral flux onset analysis. | **Ready for Production** |
| **Input Customization** | Configurable key bindings (`useKeyBindings`) stored in `localStorage` with automated duplicate key swapping, defaulting to `D, F, J, K`. | **Ready for Production** |
| **Accounts & Persistence** | Supabase Auth, guest mode with 50-run session capping, guest-to-registered progress transfer, profile privacy toggle (`is_public`), GDPR/CCPA account deletion path with anonymized match retention. | **Ready for Production** |
| **Private Multiplayer** | Unguessable 8-character invite codes, host transfer on disconnect, nominations and voting with deterministic tie-breaking, synchronized countdown, independent elimination, idempotent result submission. | **Ready for Production** |
| **Public Rooms & Matchmaking**| Filterable public room directory with 4 active competitors cap, Quick Play queue with expanding Elo rating window. | **Ready for Production** |
| **Competitive & Social** | Elo ratings with provisional K=32 and established K=16, 5-tab leaderboards, friend requests, follow graph, user blocks, moderation reports. | **Ready for Production** |
| **Tournaments & Seasons** | Single-elimination brackets for 4, 8, and 16 players, check-in window, automatic round advancement, dispute filing, seasonal tournament points and standings. | **Ready for Production** |
| **Production Hardening** | Sliding-window in-memory rate limiting, HTTP security headers (HSTS, CSP, X-Frame-Options), telemetry log sanitization, production `/api/health` probe. | **Ready for Production** |

---

## 3. Systems Requiring Beta Observation (Field Trial)

While fully implemented and verified via automated integration tests, the following areas should be monitored during the initial beta launch:

1. **Live High-Latency Multiplayer Sync:**
   - Evaluated in separate local browser sessions and automated unit fixtures. Live performance over cellular networks with high jitter (>300ms) should be monitored using the `/api/health` probe and user feedback.
2. **Ephemeral Audio Storage Lifecycle:**
   - Temporary audio files have a 2-hour TTL and are cleaned up by `/api/rooms/cleanup`. Verify that external cron execution (e.g. Vercel Cron or GitHub Actions) runs reliably on schedule.

---

## 4. Rights, Privacy & Content Safety Safeguards

1. **Audio Copyright Confirmation:**
   - Every audio upload explicitly requires the player to confirm that they have the rights or permission to use the recording before processing begins.
   - Built-in royalty-free 120 BPM synthetic praise track guarantees zero-dependency gameplay without requiring any user upload.
2. **Ephemeral Audio Retention:**
   - Audio uploaded for multiplayer rooms is strictly private, accessible only via temporary signed URLs, and purged after 2 hours.
3. **Data Scrubbing:**
   - Account deletion anonymizes user profiles (`Praiser (Deleted)`) while preserving tournament bracket integrity.
4. **Community Moderation:**
   - Report API (`/api/social/report`) and blocking API (`/api/social/block`) allow players to self-moderate offensive behavior or room disruptions.

---

## 5. Open Product Decisions & Recommendations

| Decision Item | GDD Reference | Recommendation for Release |
|---|---|---|
| **Product Name** | GDD §1, §10 | Confirmed as **PraiseTiles**. |
| **"Solo Leveling" Label** | GDD §10 (Item #1) | Recommend labeling as **Solo Praise** or **Solo Mode** in public marketing to prevent trademark confusion with existing media franchises. |
| **Timing Windows** | GDD §10 (Item #3) | Retain provisional windows (±50ms / ±100ms / ±150ms) with the built-in Latency Calibration Slider (±150ms offset) for player personalization. |
| **Keyboard Remapping** | GDD §10 (Item #4) | **Resolved:** Fully implemented with `useKeyBindings` hook and UI rebinding. |

---

## 6. Recommended MVP Release Scope

For the 31 October 2026 launch target, the recommended public release scope includes:

1. **Tier 1 (Core MVP — Demonstrable Build):**
   - Main menu with responsive desktop and mobile viewports.
   - Guest solo play with both Piano Tiles and Guitar Tiles presentations.
   - Audio upload with validation & royalty-free demo praise track.
   - 3-Star stage difficulty progression with strict failure.
   - Scoring, combo multipliers, accuracy calculations, results, and retry.
   - Remappable keyboard controls and latency calibration slider.
2. **Tier 2 (Persistent Accounts & Progression):**
   - Supabase Auth, guest-to-registered transfer, profile customization, and gem tier progression.
3. **Tier 3 (Multiplayer & Competitive):**
   - Private multiplayer rooms with synchronized matches.
   - Public rooms, Quick Play queue, and casual/ranked modes.
   - Single-elimination tournaments (4, 8, 16 players) and seasonal leaderboards.

---

## 7. Deployment, Health Monitoring & Rollback Strategy

1. **Deployment Platform:** Vercel (Edge Runtime & Node.js Serverless).
2. **Environment Variables Required:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Server-only)
   - `CLEANUP_SECRET` (Server-only for cron)
3. **Rollback Mechanism:**
   - Vercel allows instant 1-click rollback to any previous deployment hash.
   - All database migrations are non-destructive and idempotent.
4. **Health Probe:**
   - Live endpoint available at `GET /api/health` providing database connectivity status, memory RSS, and uptime.
