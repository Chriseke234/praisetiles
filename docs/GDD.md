# Gospel Rhythm Game — Game Design Document (GDD)

**Document status:** Draft v1.0 — decisions consolidated for MVP planning  
**Last updated:** 26 October 2026  
**Working title:** Undecided  
**Platform:** Browser-first, responsive web game  
**Target build window:** MVP target by 31 October 2026  
**Core modes:** Solo and Multiplayer  
**Instrument modes:** Piano Tiles and Guitar Tiles  
**Important:** This document is the current source of truth. Any item labelled *Open decision* must not be silently treated as final.

---

## 1. High concept

A browser-based rhythm game centred exclusively on gospel, praise and worship music. Players upload audio they are authorised to use; the game analyses its rhythm and creates playable note maps for two game presentations: Piano Tiles and Guitar Tiles. Players can play solo, compete with friends, join public rooms, build profiles and compete in tournaments.

The product should feel like a polished, modern rhythm-game arena with a contemporary Afro-inspired visual identity. It should be music-first, easy to enter, challenging to master and designed for social play.

### Product pillars
1. **Music-first gameplay:** the original uploaded recording remains the audio source; this is not an AI music-generation product.
2. **Two complementary instruments:** Piano Tiles and Guitar Tiles share the same timing, scoring and progression foundations.
3. **Skill and tension:** one incorrect tap or missed note ends the player's run.
4. **Social competition:** private rooms, public rooms, profiles, friends, leaderboards and tournaments are core product systems.
5. **Accessible entry:** guests can try casual gameplay without registration; persistent identity and competitive features require accounts.
6. **Buildable architecture:** launch a reliable core before expanding advanced social and tournament functionality.

## 2. Audience and platform

### Audience
- People who enjoy gospel, praise and worship music.
- Casual rhythm-game players.
- Friends and communities who want to compete together.
- Skilled players who want ranked matches, records and tournaments.

### Supported input
- Touchscreen: tap notes directly.
- Keyboard: proposed default lanes D, F, J, K.
- Mouse: click/tap the corresponding lanes or notes.
- **Open decision:** confirm whether keyboard mapping is configurable at MVP.

### Responsive targets
- Mobile-first touch gameplay.
- Tablet layout.
- Desktop keyboard and mouse gameplay.
- Performance-conscious effects, with a reduced-motion option.

## 3. Main navigation and player journey

### First entry
1. Show a short logo animation.
2. Start soundtrack only after user interaction, respecting browser autoplay restrictions.
3. Present a minimal game-first main menu.
4. Main menu choices: **Solo Leveling** and **Multiplayer**.
5. Player chooses Piano Tiles or Guitar Tiles after choosing the mode.

“Solo Leveling” is the current working label for solo play, not a confirmed final product name. Before public release, review naming and trademark/confusion risk because the phrase is strongly associated with an existing entertainment franchise.

### Solo journey
Main Menu → Solo Leveling → Instrument → Upload/choose an authorised audio track → Analyse → Optional map preview → Play → Result/Failure → Retry or Exit.

### Multiplayer journey
Main Menu → Multiplayer → Quick Play / Browse Rooms / Create Room → Lobby → Song nominations → Vote → Host uploads selected audio → Analyse and validate map → Players ready → Countdown → Match → Results → Rematch / Return / Leave.

## 4. Audio, uploads and rhythm-map generation

### MVP upload constraints
- Accepted formats: MP3, WAV and supported MP4 files with decodable audio.
- Maximum file size: 15 MB.
- Minimum duration: 30 seconds.
- Maximum duration: 5 minutes.
- The uploader must confirm that they have the rights or permission needed to use the recording.

### Processing
- Use lightweight signal processing initially; no paid AI API is required for the first version.
- Prefer browser-side processing where practical, with backend processing when required.
- Analyse the waveform/energy and rhythmic transients to estimate playable events.
- The first version generates beat-aligned playable patterns; it must not claim to transcribe the true piano melody or guitar part.
- Gospel tracks may contain vocals, drums, bass, keyboards, guitars, changing tempo and quiet introductions. Treat detection as an estimate, not a guarantee.
- Let players preview the generated pattern optionally. Flag or reject maps that fail basic validation; don't force every casual player to preview.
- Cache/reuse a rhythm map only when the audio fingerprint and analysis settings match.

### Map integrity
A multiplayer match and ranked tournament round must use one shared, versioned rhythm map for all competitors. Do not independently regenerate a different map in each player's browser for the same competitive round.

### Open technical decision
The exact analysis algorithm, map-quality validation thresholds and handling of variable tempo must be verified during prototyping.

## 5. Instrument gameplay

### Shared foundation
- Four lanes are the proposed initial layout for both instruments.
- Tap notes only at MVP; sustained notes are deferred.
- Both modes use the same audio clock, hit evaluation framework, scoring, accuracy, combo and progression rules.
- Original audio speed is never changed to simulate difficulty.

### Piano Tiles
- Four falling-note lanes.
- Blend classic falling tiles with modern neon styling.
- Clear hit zones, readable note contrast and restrained effects.

### Guitar Tiles
- Four arcade/fretboard-inspired lanes.
- Shared timing and scoring rules with Piano Tiles.
- Distinct guitar-themed presentation without making note targets harder to read.

### Three-star song progression
Difficulty increases as the song progresses. The stars represent stages within a song, not three independent song-speed settings.

- **Star 1 — Establish the rhythm:** lower note density and introductory patterns.
- **Star 2 — Build intensity:** increased note density and more varied patterns.
- **Star 3 — Final challenge:** the most demanding patterns and highest note density.

The analyser should use track duration, detected rhythmic activity and musical changes where practical to place stage boundaries. If it cannot reliably detect song structure, use safe duration-based defaults. Never change the source track's playback speed.

### Strict failure rule
- One incorrect tap immediately ends the player's run.
- One missed required note immediately ends the player's run.
- Stop gameplay and music, then show a clear failure state.
- Record score, accuracy to the point of failure, highest combo, elapsed time and failure reason.
- Allow retry or exit.
- In multiplayer, the failed player is eliminated from active play; the remaining players continue.
- A failed attempt does not automatically mean all progression rewards are zero; rewards must be based on explicit anti-exploit rules.

### Hit grades
- **Perfect:** closest timing window.
- **Great:** very accurate timing.
- **Good:** acceptable timing.
- **Miss:** no valid hit; the run ends.
- Incorrect tap: the run ends.

**Provisional timing windows for playtesting:** Perfect ±50 ms; Great ±100 ms; Good ±150 ms. These are configuration defaults to test, not proven final values. Use a single shared judgement implementation and calibrate for audio/input latency.

## 6. Score, accuracy and combo

### Provisional base points
- Perfect: 1,000
- Great: 750
- Good: 500

### Provisional combo multiplier
- 1–9 consecutive successful hits: ×1.0
- 10–24: ×1.2
- 25–49: ×1.5
- 50–99: ×2.0
- 100+: ×3.0

Apply the current multiplier to the base points of each successful hit. Perfect, Great and Good all count as successful hits and advance the combo. A failed run ends the combo; preserve the highest combo in results.

### Accuracy
Use weighted timing quality:
- Perfect = 1.00
- Great = 0.90
- Good = 0.75

For a completed map:
`accuracy = sum(hit weights) / total required notes × 100`

For a failed run, show both:
- **Run accuracy:** weighted judgement for notes encountered up to failure, clearly labelled incomplete.
- **Completion status:** Failed / Completed.

Do not compare partial-run accuracy to completed-song records as if they were equivalent. Ranked results should use completed runs unless the tournament's published rules explicitly define an elimination format.

### Multiplayer winner and tie-break
For ranked matches and tournaments, use deterministic published rules:
1. Higher official score.
2. Higher accuracy.
3. Higher highest combo.
4. If still tied, a short sudden-death challenge or a predeclared tournament rule.

For ordinary private casual rooms, the host may select from supported tie-resolution options before the match. A host cannot alter results or rules after the match starts.

### Server authority
The browser may render live score, but ranked/tournament results and XP must be validated server-side. Prevent duplicate result submissions and obvious impossible scores. Do not trust client-submitted score totals without validation.

## 7. Player progression and profile

### Gem ranks and titles
| Tier | Gem rank | Title |
|---|---|---|
| 1 | Quartz | Pulse Starter |
| 2 | Jade | Rhythm Keeper |
| 3 | Sapphire | Groove Master |
| 4 | Ruby | Virtuoso |
| 5 | Diamond | Legend |

Progression uses both XP and performance requirements. XP alone cannot unlock the next tier.

### Initial proposed promotion configuration
These are initial values for playtesting and tuning:
- Quartz → Jade: 80% accuracy, 3 qualifying songs, 300 XP.
- Jade → Sapphire: 85% accuracy, 5 qualifying songs, 700 XP.
- Sapphire → Ruby: 90% accuracy, 7 qualifying songs, 1,500 XP.
- Ruby → Diamond: 95% accuracy, 10 qualifying songs, 3,000 XP.

A qualifying song and whether a successful completion is required must be explicitly defined in the progression implementation. Do not award a promotion merely from failed partial runs.

### Profile fields
- Username and display name.
- Profile image/avatar.
- Player level and XP.
- Gem rank.
- Competitive rating (separate from gem rank).
- Best score, accuracy and combo.
- Songs played/completed.
- Separate Piano Tiles and Guitar Tiles statistics.
- Match history and tournament placements.
- Achievements/badges.
- Friends and followers.
- Preferred instrument and cosmetic profile elements.
- Privacy controls and account deletion path.

### Other progression
- Achievements and personal records.
- Shareable result cards.
- Daily challenges after core systems are stable.
- Cosmetic unlocks after MVP if time permits.

### Guest mode
- Guest can play without creating an account.
- Guest results and temporary identity exist for the current session.
- Do not promise permanent saving for guests.
- Offer account creation and transfer of eligible session progress.
- Use short-lived server-side session records with expiry/cleanup; do not rely solely on localStorage.
- Guests may access public casual rooms, but ranked matches and tournaments require registration.

## 8. Social systems

### Friends and followers
- Friend requests with accept/decline.
- Followers as a one-way connection.
- Online/available status where safe.
- Invite friends to a room.
- Recent opponents.
- Block and report controls.
- Public profile viewing subject to privacy settings.

### MVP social priorities
1. Player profiles and stats.
2. Room invitations and friend connections.
3. Block/report.
4. Shareable match result cards.
5. Activity feed, advanced discovery and teams later.

### Chat
- Lobby chat and quick reactions are desired.
- Apply message length limits, rate limits, report/block and moderation controls.
- Chat must not be required to play.
- Open decision: exact chat retention and moderation policy.

## 9. Multiplayer rooms

### Room types
- Private room via invite/code.
- Public casual room.
- Ranked room/queue.

### Capacity
- Public lobby: 8–16 participants.
- Active match: maximum 4 players at MVP.
- Remaining participants may wait for a later match; spectator mode is a later enhancement unless straightforward.
- Private room initial capacity: up to 4 active competitors; whether its lobby can exceed four is an open decision.

### Room flow
Waiting → Nomination → Voting → Upload → Audio analysis/map validation → Ready checks → Countdown → Playing → Results → Rematch/close.

### Song nominations and votes
- One nomination per player per round, with title and artist.
- No audio upload during nomination.
- Self-voting allowed.
- Votes can be changed while voting remains open.
- Highest-voted nomination wins.
- Tie: runoff; if still tied, random selection among tied nominations.
- Host uploads the selected track.
- Same audio and versioned rhythm map for all match participants.

### Host powers
- Create/manage room and settings before match.
- Oversee nomination/voting and upload selected song.
- Start only when required preconditions are met.
- Remove disruptive participants before match, according to rules.
- Host cannot manipulate score, edit match results or change active-match rules.
- If host disconnects, allow reconnection; if host deliberately leaves, transfer ownership to another eligible participant.

### Disconnects and cleanup
- Preserve room state during temporary disconnects.
- Reconnection grace period must be configurable and tested; exact duration is open.
- Wait for required participants to be ready before countdown.
- Abandoned rooms may be closed after 30 minutes of inactivity, but never delete a valid active match or an active reconnection window.
- Use server-side cleanup; don't depend on a browser being open.

### Synchronisation
- Preload audio and map, then schedule a common future start time.
- Use Supabase Realtime for state, votes, chat, readiness and status, not for every tap or animation frame.
- Define what happens when a player has slow loading or loses connection mid-match.

## 10. Public room discovery

Public room directory should show:
- Room name and host.
- Occupancy, e.g. 7/16.
- Active competitor slots, e.g. 3/4.
- Current state: waiting, voting, preparing, playing or results.
- Casual/ranked designation.
- Instrument rules.
- Song status.
- Eligibility/rank restrictions if any.

Actions:
- Quick Play finds a suitable public casual room.
- Browse Rooms filters available rooms.
- Create Room selects public/private and supported settings.
- Lock room or restrict to friends when appropriate.
- Room state transitions must be enforced server-side.

## 11. Ranked play and leaderboards

### Casual
- Public/private rooms.
- No permanent competitive rating changes.
- Guests allowed in public casual rooms.
- Strict failure rule applies to each player's run.

### Ranked
- Registered accounts required.
- Fixed scoring, map version and tie-break rules.
- Competitive rating separate from gem rank.
- Validated results and basic anti-cheat checks.
- Handle disconnects/abandonment consistently.
- Ranked leaderboards.

### Initial leaderboards
- Global ranked rating.
- Weekly champions.
- Piano Tiles leaders.
- Guitar Tiles leaders.
- Friends leaderboard.
- Country/rank filters may be added if useful.

## 12. Tournaments

### Hosting
- Initial tournament creation limited to platform administrators and approved organisers.
- Ordinary room hosts can create and manage rooms, not automatically official tournaments.
- Community-hosted tournaments can be expanded later.

### MVP tournament types
- Scheduled tournament.
- Short quick tournament if feasible.
- Weekly leaderboard challenge can follow if it complicates MVP.

### Suggested format
Up to 16 players: registration → check-in → Round 1 → semifinal → final → results.
A match round should use the same song, audio, rhythm map version, instrument rules, timing windows and scoring rules for every competitor.

### Tournament requirements
- Published start time and registration deadline.
- Participant cap.
- Instrument and song rules.
- Rank/eligibility requirements.
- Round advancement.
- Tie-break rules.
- Late arrival/forfeit policy.
- Results and tournament history.
- Rewards should initially be non-monetary: badges, profile banners, cosmetics and recognition.

Do not promise cash prizes at MVP. Tournament organisers must not be able to edit official results after matches are completed.

## 13. Audio rights, storage and retention

- Users must confirm they have rights/permission to upload and use their audio.
- The platform must not imply that uploading a song grants redistribution rights.
- Multiplayer uploads live in private storage, accessible only to authorised room participants through appropriate access controls.
- Delete the multiplayer audio file when the room is officially closed or safely cleaned up as abandoned.
- Preserve match records after audio deletion: IDs, participants, nominations/votes, song title/artist, score, accuracy, combo, outcomes, history and progression.
- Old records remain viewable, but replay may be unavailable if the audio was deleted and no authorised source exists.
- Server-side deletion and abandoned-upload cleanup are required.
- Solo audio retention policy needs a clear decision before public release.
- Provide reporting/takedown and privacy/account-deletion policies before broad public launch.

## 14. Visual direction and UX

- Dark gaming arena with contemporary Afro-inspired identity.
- Shared brand language, distinct Piano Tiles and Guitar Tiles treatments.
- Minimal background during gameplay; richer visuals in menus, lobbies and celebrations.
- Neon accents, clear contrast and readable notes.
- Subtle reactive effects must not obscure notes or add input latency.
- Reduced-motion option.
- Short logo animation; soundtrack starts only after user interaction.
- No 3D character customisation at MVP.
- Final name, logo and palette remain undecided.

## 15. Technical direction

### Intended stack
- Google Antigravity for implementation.
- Vercel for web hosting.
- Supabase Auth, Postgres, Storage and Realtime.
- No paid AI API for initial rhythm-map generation.
- Browser-side analysis where feasible, backend where needed.

### Security and reliability
- Use row-level security for user and room data.
- Never expose Supabase service-role credentials in the browser.
- Private storage and scoped signed access for audio.
- Server-side room state transitions, result validation and XP awards.
- Rate-limit uploads, room creation, invitations, chat and voting.
- Validate MIME type, actual decodability, size and duration; do not trust file extensions alone.
- Idempotent result submission and cleanup jobs.
- Log errors without unnecessarily retaining uploaded audio or sensitive data.
- Test slow networks, mobile browsers, disconnects and storage cleanup.

## 16. MVP boundary and delivery plan

**Time constraint:** target to have a demonstrable build by 31 October 2026. This is an aggressive target. A fully polished public platform with reliable multiplayer, social networking and tournaments may not be realistic in that window. Prioritise a working vertical slice and keep advanced features modular.

### Milestone 1 — playable vertical slice
- Main menu and responsive layouts.
- Guest entry.
- Audio upload validation.
- Rhythm-map prototype.
- Piano Tiles and Guitar Tiles.
- Three-star progression.
- Strict failure.
- Scoring, combo, accuracy and results.
- Retry.

### Milestone 2 — persistence
- Supabase project and schema.
- Authentication/profile.
- Save registered match results.
- XP and progression.
- Basic security policies.

### Milestone 3 — multiplayer proof
- Room creation/joining.
- Four-player active match.
- Host upload.
- Shared map and countdown.
- Elimination after failure.
- Results and rematch.
- Audio deletion while preserving match records.

### Milestone 4 — public and competitive features
- Public 8–16 person lobby with up to four active players.
- Casual room discovery.
- Basic friends/invitations.
- Ranked validation and leaderboard.
- Admin/approved-organiser tournament shell.

### Milestone 5 — polish and release readiness
- Mobile performance.
- Error handling and reconnection.
- Accessibility/reduced motion.
- Rights/terms/reporting.
- Load, security and cleanup tests.

### MVP acceptance criteria
- Both instruments are playable using the same song clock.
- Incorrect tap or missed note ends the run reliably.
- Results correctly distinguish completion from failure.
- A multiplayer match uses one shared rhythm-map version.
- A failed player does not stop other players' runs.
- Guests can play casual mode; ranked requires registration.
- Match records survive multiplayer audio deletion.
- Room capacity and state transitions are enforced server-side.
- No secret credentials are exposed client-side.
- App works on a representative Android mobile browser and desktop browser.

## 17. Open decisions register

Do not silently invent these as final:
1. Final product name/logo/palette.
2. Exact rhythm-detection implementation and quality thresholds.
3. Exact timing windows after playtesting.
4. Whether keyboard controls are remappable.
5. Whether private lobbies may exceed four participants.
6. Reconnection grace period and mid-match disconnect policy.
7. Whether solo audio is retained, and for how long.
8. Exact chat retention/moderation policy.
9. Tournament round scheduling and no-show policy.
10. Final XP rewards and promotion qualification rules.
11. Exact competitive rating algorithm.
12. Whether a failed attempt grants partial XP and how to prevent farming.
13. Browser support baseline and performance budget.
14. MVP launch scope: demonstrable prototype versus public production launch.

## 18. Immediate next action

Build in this order:
1. Create a clean project and this document as `docs/GDD.md`.
2. Ask the coding agent to inspect the workspace and report existing stack/files before modifying anything.
3. Create a concise technical implementation plan and architecture decision record.
4. Build the playable single-player vertical slice before attempting full multiplayer.
5. Test audio timing and strict-failure gameplay before committing to the multiplayer schema.
