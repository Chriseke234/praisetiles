# Technical Implementation Plan — Gospel Rhythm Game

**Status:** Draft v1.0  
**Target:** Demonstrable MVP by 31 October 2026  
**Companion document:** `GDD.md`

## 1. Engineering goal

Build a responsive browser-first gospel rhythm game with Piano Tiles and Guitar Tiles, strict-failure gameplay, user-uploaded audio, beat-aligned rhythm maps, accounts/profiles, and a staged path to multiplayer, public rooms and tournaments.

Do not attempt to deliver every advanced social feature before validating the game clock, audio analysis and gameplay loop.

## 2. Working architecture

### Frontend
- React/Next.js with TypeScript if the workspace is new; otherwise inspect and preserve the existing compatible stack.
- Responsive UI and touch-first gameplay.
- Shared game engine for clock, lane input, hit judgement, combo, score and failure.
- Separate instrument presentation components for Piano Tiles and Guitar Tiles.
- Web Audio API for decoding, playback scheduling and analysis where supported.
- Keep gameplay animation on requestAnimationFrame; do not write every frame or tap to the database.

### Backend
- Supabase Auth for registered accounts.
- Supabase Postgres for profiles, rooms, matches, results, XP, progression, social graph and tournaments.
- Supabase Storage private bucket for temporary multiplayer audio.
- Supabase Realtime for room state, votes, chat, readiness and match status.
- Server-side routes/functions for validation, room transitions, result submission, XP awarding and cleanup.
- Vercel deployment.

### Audio analysis
- Start with lightweight signal processing; no paid AI API.
- Decode and inspect supported files; validate real file content, duration and size.
- Produce versioned maps with event timestamps and lane assignments.
- Cache by audio fingerprint + analysis version + settings.
- Map quality should be measured in playtests; never represent generated maps as exact instrument transcription.
- One versioned map per competitive match/tournament round.

## 3. Core domain entities

Proposed initial data model; refine after confirming Supabase capabilities and security rules.

- `profiles`: user ID, username, display name, avatar, privacy settings, created timestamp.
- `player_stats`: totals and personal records, separated by instrument where appropriate.
- `player_progress`: XP, level, gem tier, promotion requirements.
- `competitive_ratings`: rating by competitive category/instrument.
- `songs`: metadata and ownership/permission acknowledgement; avoid retaining permanent audio without a policy.
- `rhythm_maps`: audio fingerprint, analysis version, duration, event data, validation status.
- `rooms`: public/private, host, capacity, active state, settings, expiry timestamps.
- `room_members`: room, user/guest session, role, ready state, join/leave status.
- `song_nominations`: room, nominated title/artist, proposer.
- `song_votes`: nomination and voter; enforce one current vote per voter/round.
- `matches`: room, map version, instrument, rules version, state, timestamps.
- `match_participants`: participant, start/end state, failure reason, score, accuracy, highest combo, completion.
- `match_events` (optional): compact validated events or summary data needed for anti-cheat; avoid storing every animation frame.
- `friends`: requester, recipient, status.
- `follows`: follower, followed profile.
- `blocks_reports`: reporter, target, reason/status.
- `chat_messages`: room, sender, content, timestamp; retention policy to be defined.
- `achievements` and `player_achievements`.
- `tournaments`: organiser, status, schedule, capacity, rules snapshot.
- `tournament_entries`: participant, check-in, status.
- `tournament_rounds` and `tournament_matches`: bracket/advancement.
- `leaderboard_snapshots` or derived views, if needed for performance.
- `cleanup_jobs` or equivalent server-side cleanup mechanism.

Avoid excessive denormalisation until actual query patterns are measured.

## 4. Security principles

- Enable Row Level Security on user-facing tables.
- Users can read/update only their permitted profile fields.
- Room members can read only authorised room state.
- Private audio is never publicly readable.
- Do not expose service-role keys in browser code.
- Server validates host permissions and room state transitions.
- Server validates match submissions, prevents duplicate submissions and awards XP idempotently.
- Rate-limit uploads, room creation, voting, invitations and chat.
- Enforce upload size/duration/content checks on the server as well as client.
- Use short-lived, scoped signed URLs only where required.
- Use safe deletion jobs; retain match metadata after audio deletion.
- Keep secrets in environment variables and document required names without writing secret values into the repository.

## 5. Multiplayer state machine

Suggested states:
`waiting → nomination → voting → uploading → analysing → ready_check → countdown → playing → results → closed`

Allowed transitions must be enforced server-side. A client must not be able to jump from `waiting` directly to `playing` or edit a completed result.

### Match start
1. Host-selected audio is uploaded to private storage.
2. Validate file, duration and permission acknowledgement.
3. Analyse or retrieve matching validated rhythm map.
4. Save map version and match rules snapshot.
5. Each active participant confirms audio/map readiness.
6. Schedule a common future start time.
7. Start playback and gameplay against a shared match clock.
8. Use Realtime for state changes, not frame-by-frame gameplay.

### Failure and result
- Incorrect tap or missed required note ends that player's run.
- Record failure reason and run summary.
- Other active participants continue.
- Prevent duplicate result writes.
- Finalize standings using the match's stored scoring/rules version.

### Cleanup
- Audio file deleted when room officially closes or safe abandonment cleanup closes it.
- Match records and progression remain.
- Do not close rooms with active matches or valid reconnect windows.
- Abandoned-room threshold starts at 30 minutes of inactivity, with server-side safeguards.

## 6. Scoring module

Initial configurable values from GDD:
- Perfect 1,000 base points, weight 1.00.
- Great 750 base points, weight 0.90.
- Good 500 base points, weight 0.75.
- Combo multiplier: 1.0 / 1.2 / 1.5 / 2.0 / 3.0 at agreed provisional thresholds.
- Incorrect tap or missed note ends the run.
- Timing windows are provisional and must be calibrated in tests.
- Original music speed never changes with difficulty.

Put tuning values in a central configuration object with a rules version; don't duplicate magic numbers across components.

## 7. Suggested implementation milestones

### M1 — gameplay vertical slice
- Scaffold app.
- Main menu and instrument selection.
- Upload and validate audio.
- Decode audio and produce first beat-aligned map.
- Shared four-lane game engine.
- Piano and guitar presentation.
- Three-star song progression.
- Hit grades, score, accuracy, combo and strict failure.
- Results and retry.
- Manual test with multiple real audio tracks.

### M2 — auth and persistence
- Supabase setup and environment configuration.
- Schema and RLS.
- Registered profiles and guest session.
- Store eligible results and progression.
- Profile statistics.

### M3 — private multiplayer
- Room lifecycle and member roles.
- Nominations/voting.
- Host upload and shared map.
- Ready checks and common scheduled start.
- Four active players.
- Failure elimination, final results and rematch.
- Audio deletion while preserving match records.

### M4 — public social competition
- Public room directory, capacity 8–16.
- Four active competitors per match.
- Quick Play and browse filters.
- Basic friend requests/invites and block/report.
- Casual/ranked distinction.
- Leaderboards and result validation.

### M5 — tournaments and polish
- Admin/approved-organiser tournament creation.
- Registration, check-in, rounds and advancement.
- Tie-break rules and profile tournament history.
- Mobile performance, reconnects, monitoring and security tests.
- Legal/rights/privacy copy before public release.

## 8. Testing checklist

### Audio
- Corrupt/unsupported files rejected gracefully.
- Actual content type validated, not just extension.
- Size and duration boundaries enforced.
- Browser audio decode failure handled.
- Playback clock and note timing remain aligned.
- Audio ends cleanly; no lingering notes after end.
- Slow intro and high-intensity chorus don't create impossible patterns.

### Gameplay
- Touch, keyboard and mouse input.
- Perfect/Great/Good boundaries.
- Incorrect tap ends the run once, without duplicate failure events.
- Missed note ends the run once.
- Combo multiplier changes at correct thresholds.
- Failed run accuracy is labelled partial.
- Retry resets gameplay state and reuses valid audio/map where possible.
- Reduced-motion option and readable hit targets.

### Multiplayer
- Two to four active players receive the same map version.
- Room state changes are server-validated.
- Reconnect preserves valid room state.
- Host departure transfers ownership safely.
- Failed player doesn't end other players' runs.
- Duplicate submissions cannot inflate scores/XP.
- Abandoned room cleanup doesn't destroy active match data.
- Audio deletion doesn't delete match records.

### Security
- RLS tests for profiles, rooms, votes, matches and results.
- Private audio cannot be fetched by unauthorised users.
- No service-role key in client bundle.
- Rate limits and malformed payload handling.
- Host cannot alter official results.
- User can block/report and use account privacy/deletion controls.

## 9. Instructions for the coding agent

Before changing code:
1. Inspect the repository, package files, app structure, existing design and current git diff.
2. Report the detected framework, dependencies, existing routes and relevant files.
3. Identify risks and propose a minimal implementation plan.
4. Preserve unrelated work; do not overwrite working files without inspecting them.
5. If this is a new/empty workspace, scaffold a clean project using TypeScript and a supported React/Next.js stack.
6. Implement one milestone at a time.
7. Run type checks, lint and available tests after each milestone.
8. Report what changed, commands run, test outcomes, remaining issues and exact next step.
9. Never claim a feature works unless it was implemented and tested.
10. Do not add paid APIs, external music catalogue integrations or unrequested dependencies without approval.
