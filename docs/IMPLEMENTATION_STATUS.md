# PraiseTiles — Phase 0 / Phase 1 Implementation Status

**Status Date:** 27 October 2026  
**Milestone:** M1 — Single-Player Playable Vertical Slice  
**Product Title:** PraiseTiles (`praisetiles`)  
**Rules Version:** `1.0.0` (Matches `docs/GDD.md` v1.0 specifications)

---

## 1. Implemented Features

### 1. Game-First Main Navigation & Entry
- **Branding & Visual Arena:** Dark gaming arena with contemporary Afro-inspired gold, amber, and cyan neon accents. Strictly zero emojis (all icons are inline SVGs via `lucide-react`).
- **Autoplay Compliance:** Audio context remains suspended until explicit user interaction, fully respecting browser autoplay restrictions.
- **Main Menu Choices:**
  - **Solo Leveling** (Active entry button).
  - **Multiplayer** (Disabled with an explicit "Coming Soon" badge).
- **Guest Access:** Guest mode without forced account registration.
- **Sound & Accessibility Controls:** Master volume slider with mute toggle; reduced-motion preference toggle.

### 2. Dual Instrument Presentation Modes
- **Piano Tiles:** 4-lane falling neon tiles with high-contrast glowing notes and bottom hit zone.
- **Guitar Tiles:** 4-lane arcade fretboard-inspired presentation with metallic string guides, horizontal fret dividers, and gem/plectrum note targets.
- **Shared Foundation:** Both modes share the exact same 4-lane timing, audio clock, hit evaluation, scoring rules, and note timestamps.

### 3. Audio Upload, Safety & Validation
- **Upload Constraints:** Max 15 MB, 30s min duration, 300s (5m) max duration.
- **Content Inspection:** Binary magic number validation for MP3 (ID3v2 and sync frame headers), WAV (RIFF...WAVE), MP4/M4A (`ftyp` box), and OGG containers.
- **Decodability:** Safely decodes audio data using Web Audio API with informative error states for corrupted, truncated, or unplayable files.
- **Permission Acknowledgement:** Mandatory checkbox requiring uploaders to confirm rights or permissions for the track.
- **Built-in Royalty-Free Praise Demo:** Offline 120 BPM gospel hymn synthesis generator with authentic praise chords (C - G - Am - F), kick, and claps for immediate instant play without requiring file uploads or copyrighted media.

### 4. Beat-Aligned Rhythm Analysis & 3-Star Staging
- **Algorithm:** Browser-based lightweight energy-flux transient detection (RMS windowing and half-wave rectified spectral novelty curve with adaptive thresholding).
- **Honesty Disclosure:** Explicitly documented as beat-aligned rhythmic transient estimation across 4 lanes; does NOT claim to perform polyphonic melody transcription or pitch-to-note extraction.
- **3-Star Progressive Song Progression:**
  - **Star 1 (0% to 33%):** Establish the rhythm — lower density, introductory pattern focus.
  - **Star 2 (33% to 66%):** Build intensity — moderate density and varied patterns across all 4 lanes.
  - **Star 3 (66% to 100%):** Final challenge — highest note density and syncopation.
  - **Tempo Integrity:** Audio playback speed is strictly preserved and never altered.
- **Optional Map Preview:** Displays duration, total notes, density, and 3-stage breakdown prior to starting the run.

### 5. Engine, Strict Failure & Scoring
- **Decoupled Game Clock:** Audio playback timestamping via `AudioContext.currentTime` decoupled from React state renders; note rendering driven by `requestAnimationFrame`.
- **Provisional Timing Windows:**
  - **Perfect:** ±50 ms (1,000 base points, 1.00 weight).
  - **Great:** ±100 ms (750 base points, 0.90 weight).
  - **Good:** ±150 ms (500 base points, 0.75 weight).
- **Combo Multipliers:** 1–9 hits (1.0x), 10–24 hits (1.2x), 25–49 hits (1.5x), 50–99 hits (2.0x), 100+ hits (3.0x).
- **Strict Failure Rule:**
  - One incorrect tap immediately ends the player's run (`INCORRECT_TAP`).
  - One missed required note immediately ends the player's run (`MISSED_NOTE`).
  - Failure is handled idempotently, stopping playback immediately.
- **Result Screen:** Clear differentiation between Completed runs and Incomplete partial runs with failure reason, final score, run accuracy, highest combo, notes hit, and elapsed time.
- **Instant Retry:** Retrying immediately resets gameplay state while reusing the decoded audio buffer and rhythm map without reloading or re-uploading.
- **Multi-Input Support:** Direct touch input for mobile/tablets, keyboard bindings (`D`, `F`, `J`, `K`), and mouse pointer support.

---

## 2. Test Verification & Results

All test suites were executed and verified locally:

```bash
# Unit & Integration Tests (Vitest)
npm test
# Result: 3 passed (30/30 tests passed in 7.65s)
# - tests/scoring.test.ts (16 tests)
# - tests/engine.test.ts (6 tests)
# - tests/audio.test.ts (8 tests)

# TypeScript Check
npx tsc --noEmit
# Result: 0 errors

# ESLint Check
npm run lint
# Result: 0 errors, 0 warnings

# Production Next.js Turbopack Build
npm run build
# Result: Compiled successfully in 3.1s; static routes generated
```

### Coverage Summary:
- Timing grade boundary checks (`PERFECT`, `GREAT`, `GOOD`, `MISS`).
- Combo multiplier progression at agreed thresholds (1, 10, 25, 50, 100).
- Weighted accuracy calculation including partial-run calculations.
- Strict failure on incorrect tap on an empty lane.
- Strict failure on missed note passing the late threshold.
- End-of-song natural completion handling.
- Instant retry state resets while preserving audio and map.
- Cross-instrument engine consistency (Piano Tiles and Guitar Tiles use identical map timestamps and scoring).
- Binary header inspection for MP3, WAV, MP4, and corrupt files.
- Oversize file rejection (> 15 MB).
- 3-Star progression density distribution.

---

## 3. Known Limitations & Scope Boundaries

As specified for Phase 0 / Phase 1:
- **Multiplayer:** Multiplayer rooms, lobbies, matchmaking, voting, and tournaments are disabled in this phase and marked as "Coming Soon".
- **Audio Analysis:** The client-side analyzer uses dynamic energy-flux onset detection. It creates playable beat-aligned rhythmic patterns, but does not transcribe true polyphonic guitar chords or piano melodies.
- **Persistence & Supabase:** No external database or cloud storage was linked during this initial single-player loop to ensure clean, isolated testing without fragile dependencies.

---

## 4. Next Milestone (Milestone 2)

- Set up Supabase project credentials and migrations for `profiles`, `player_progress`, `player_stats`, and `matches`.
- Implement registered user authentication alongside guest session migration.
- Add server-side score and result validation.
- Implement XP and gem tier progression (Quartz, Jade, Sapphire, Ruby, Diamond).
