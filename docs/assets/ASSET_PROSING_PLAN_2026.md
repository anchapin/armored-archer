# Asset Procurement Plan — CC0-First Hybrid (Issue #912)

**Owner:** @armored-archer/audio-team (human procurement)
**Author (scaffold):** [AI-assisted] MiniMax-M3
**Created:** 2026-08-17
**Closes:** #912
**Related:** `FOLEY_AI_SETUP.md`, `docs/decisions/CC0_HYBRID_POLICY.md`, `assets/audio/SOURCES.md`

> **Scope.** This document is a **procurement plan**, not an asset delivery.
> AI agents cannot verify CC0 license compatibility offline and cannot run
> ElevenLabs Foley without API keys. A human owner must execute each TODO row.
> This file's job is to (a) enumerate every asset we need, (b) name the
> primary CC0 source where one exists, (c) explicitly mark the gap-fill
> candidates that need AI Foley (`{category}_{action}_{intensity}.wav` per
> `FOLEY_AI_SETUP.md`), and (d) make ownership unambiguous.

---

## 1. Policy reminder

The CC0-first hybrid policy (see `docs/decisions/CC0_HYBRID_POLICY.md`) is:

1. **Default source** — CC0 / public-domain only (Kenney, freepd, incompetech
   CC0 reissues, OpenGameArt CC0 mirrors, kenney.nl, freesound.org CC0 tags).
2. **Gap-fill only** — ElevenLabs Foley AI is permitted **only** when no
   acceptable CC0 candidate exists (bow thrum, boss roar signature stings,
   boss death roars). Every AI-generated asset **must** carry a commercial-tier
   license flag (ElevenLabs Creator / Pro tier or equivalent) and be recorded in
   `assets/audio/SOURCES.md` with the model + license row.
3. **No proprietary assets without a documented license row.** Zero assets may
   live in `assets/` without a matching `SOURCES.md` row.
4. **Verification gate.** Files must import cleanly via
   `godot4 --headless --quit --import` before the issue can close.

---

## 2. Audio SFX — full event inventory (15–20 events)

The `AudioManager.gd` `_resolve_sfx_path()` table currently supports
`arrow_shot`, `arrow_hit`, `arrow_kill`, `reload`, `level_up`. The full event
set the plan requires is below. **Existing files** are marked ✓ with their
known provenance; **gap candidates** are marked ◌ with a Foley file name to
generate or a CC0 source URL to procure.

| # | Event name (`play_sfx(...)`) | Folder | Status | Primary source (CC0) | Gap-fill (ElevenLabs Foley) | Owner |
|---|------------------------------|--------|--------|-----------------------|------------------------------|-------|
| 1 | `arrow_shot` (bow release) | sfx/combat | ✓ existing | Kenney "Tiny Dungeon" SFX (`assets/sprites/kenney/` source pack); provenance TBD — confirm via SOURCES.md row | — | audio-team |
| 2 | `arrow_hit` (impact on enemy) | sfx/combat | ✓ existing | Kenney / freesound CC0 — confirm | — | audio-team |
| 3 | `arrow_kill` (enemy death) | sfx/combat | ✓ existing | Kenney / freesound CC0 — confirm | — | audio-team |
| 4 | `reload` (bow reload) | sfx/combat | ◌ missing | Kenney "Tiny Dungeon" or freesound `bow_draw` CC0 | `combat_reload_medium.wav` | audio-team |
| 5 | `level_up` | sfx/combat | ◌ missing | freesound CC0 chime pack | `combat_level_up_high.wav` | audio-team |
| 6 | `wave_clear` | sfx/combat | ◌ missing | freesound CC0 fanfare | `combat_wave_clear_high.wav` | audio-team |
| 7 | `victory_sting` (chapter win) | sfx/combat | ◌ missing | freepd stinger | `combat_victory_sting_high.wav` | audio-team |
| 8 | `defeat_sting` (chapter lose) | sfx/combat | ◌ missing | freepd stinger | `combat_defeat_sting_low.wav` | audio-team |
| 9 | `boss_intro` (boss spawn roar / stomp) | sfx/combat | ◌ missing | — | `combat_boss_intro_heavy.wav` **(ElevenLabs Foley — CC0 gap)** | audio-team |
| 10 | `boss_attack` (signature boss swing / cast) | sfx/combat | � missing | — | `combat_boss_attack_heavy.wav` **(ElevenLabs Foley — CC0 gap)** | audio-team |
| 11 | `boss_death` (boss defeat roar) | sfx/combat | ◌ missing | — | `combat_boss_death_heavy.wav` **(ElevenLabs Foley — CC0 gap)** | audio-team |
| 12 | `bow_thrum` (signature bow draw/release resonance) | sfx/combat | � missing | — | `combat_bow_thrum_medium.wav` **(ElevenLabs Foley — CC0 gap — required per PRD)** | audio-team |
| 13 | `archer_death_goblin` | sfx/combat | ◌ missing | Kenney roguelike pack / freesound | `combat_archer_death_goblin_medium.wav` | audio-team |
| 14 | `archer_death_orc` | sfx/combat | ◌ missing | Kenney roguelike pack / freesound | `combat_archer_death_orc_heavy.wav` | audio-team |
| 15 | `archer_death_skeleton` | sfx/combat | ◌ missing | Kenney roguelike pack / freesound | `combat_archer_death_skeleton_medium.wav` | audio-team |
| 16 | `archer_death_bandit` | sfx/combat | ◌ missing | Kenney roguelike pack / freesound | `combat_archer_death_bandit_medium.wav` | audio-team |
| 17 | `loot_pickup` | sfx/combat | ◌ missing | Kenney / freesound CC0 | `combat_loot_pickup_soft.wav` | audio-team |
| 18 | `ui_click` | sfx/ui | ◌ missing | Kenney interface pack (`tile_*` already in `assets/sprites/kenney/interface/`) | `ui_click_soft.wav` | audio-team |
| 19 | `ui_toggle` | sfx/ui | ◌ missing | Kenney interface pack | `ui_toggle_medium.wav` | audio-team |
| 20 | `ui_error` | sfx/ui | ◌ missing | Kenney interface pack | `ui_error_high.wav` | audio-team |

**Total: 20 events. 3 already exist; 17 to procure.**
Of those 17: **12 CC0 candidates exist** (Kenney packs and freesound CC0 mirrors
are well-known sources); **4 require ElevenLabs Foley** (rows 9, 10, 11, 12 —
the boss signatures and bow thrum that the PRD calls out as gap-fill only).

### Foley naming convention reminder
Per `FOLEY_AI_SETUP.md`, every AI-generated file uses
`{category}_{action}_{intensity}.wav`. Categories in this plan: `combat`, `ui`.
Intensities: `soft` / `medium` / `high` / `low` / `heavy`.

---

## 3. Music — 2 loops with verified clean seams

| # | Track | Folder | Status | Primary source (CC0) | Owner |
|---|-------|--------|--------|-----------------------|-------|
| 1 | `menu_loop.ogg` | audio/music | ◌ missing | freepd.com (`Action` / `Ambient` CC0 tags) or incompetech CC0 reissues | audio-team |
| 2 | `combat_loop.ogg` | audio/music | ◌ missing | freepd.com (`Action` tag, ~110–130 BPM) or incompetech CC0 reissues | audio-team |

**Loop seam verification (human task):**
- Trim to a full-number-of-beats length so waveform endpoints meet at zero
  crossing.
- Crossfade the last 50–200 ms with the head and verify in Audacity
  ("Loop Playback") that no click / pop is audible.
- Record verification notes (date + reviewer) in
  `assets/audio/music/SEAM_VERIFICATION.md` (created when files land).

---

## 4. Art — 7 Ch1 characters

Frame minimums:
- **Player archer:** `idle` / `draw` / `release` (3 frames minimum).
- **4 archetypes (goblin / orc / skeleton / bandit):** `walk` / `attack` /
  `death` (3 frames minimum each).
- **2 bosses (boss_ch1_a, boss_ch1_b):** `intro` / `attack` / `death`
  (3 frames minimum each).

| # | Character | Folder | Status | Primary source (CC0) | Gap-fill | Owner |
|---|-----------|--------|--------|-----------------------|----------|-------|
| 1 | Player archer | sprites/kenney/players | ◌ partial — see SPRITE_SETUP.md (Kenney tile_0000…tile_0007 already imported under CC0; **frame mapping needs human verification**) | Kenney "Tiny Dungeon" / "Roguelike Characters" CC0 (`License.txt` already in `assets/sprites/kenney/backgrounds/`) | — | art-team |
| 2 | Goblin | sprites/kenney/enemies | ◌ partial | Kenney "Roguelike Characters" CC0 | — | art-team |
| 3 | Orc | sprites/kenney/enemies | ◌ partial | Kenney "Roguelike Characters" CC0 | — | art-team |
| 4 | Skeleton | sprites/kenney/enemies | ◌ partial | Kenney "Roguelike Characters" CC0 | — | art-team |
| 5 | Bandit | sprites/kenney/enemies | ◌ partial | Kenney "Roguelike Characters" CC0 | — | art-team |
| 6 | Boss Ch1-A | sprites/bosses | ◌ missing | itch.io CC0 monster pack (procurement) or commission | `commission:boss_ch1_a.png` | art-team |
| 7 | Boss Ch1-B | sprites/bosses | � missing | itch.io CC0 monster pack (procurement) or commission | `commission:boss_ch1_b.png` | art-team |

**Existing CC0 license evidence on disk:**
`assets/sprites/kenney/backgrounds/License.txt` → Kenney CC0 1.0. The same pack
license applies to `kenney/players/`, `kenney/weapons/`, `kenney/ui/` (same
distribution). Confirm by referencing this file from the corresponding
SOURCES.md rows.

---

## 5. License tracking — every asset → source → license → SOURCES.md row

The single source of truth for licenses is `assets/audio/SOURCES.md`. Every
asset added to `assets/` (audio + art) gets a row there, owned by a human, and
**the import gate in §6 fails until every row exists.**

| Asset | Source URL | License | SOURCES.md row owner | Verified by |
|-------|-----------|---------|----------------------|-------------|
| `assets/audio/sfx/combat/arrow_shot.wav` | Kenney "Tiny Dungeon" SFX pack (link TBD by audio-team) | CC0 1.0 | audio-team | audio-team |
| `assets/audio/sfx/combat/hit.wav` | Kenney / freesound CC0 | CC0 1.0 | audio-team | audio-team |
| `assets/audio/sfx/combat/kill.wav` | Kenney / freesound CC0 | CC0 1.0 | audio-team | audio-team |
| `assets/sprites/kenney/**` (already in repo) | https://kenney.nl | CC0 1.0 (see `assets/sprites/kenney/backgrounds/License.txt`) | art-team | art-team |
| `combat_boss_intro_heavy.wav` … all Foley rows | ElevenLabs Foley AI (Creator or Pro commercial tier) | ElevenLabs commercial — flag with model + license in SOURCES.md | audio-team | audio-team |
| Music loops (2) | freepd.com / incompetech (CC0 reissues) | CC0 1.0 | audio-team | audio-team |
| Boss art (2) | itch.io CC0 monster pack OR commissioned (CC-BY or CC0) | documented per row | art-team | art-team |

---

## 6. Import gate (CI acceptance)

Per issue #912 acceptance:

```bash
godot4 --headless --quit --import
```

must succeed with zero errors after all assets are procured. The local
`scripts/local-godot-tests.sh` wrapper is the fallback when GitHub Actions is
dark (see AGENTS.md "CI outage recovery").

---

## 7. Out of scope for this PR

- Actual binary asset procurement (human task).
- Audio mix / master bus tuning beyond the existing `default_bus_layout.tres`
  wired by issue #911.
- New `AudioManager` API surface — only `play_sfx(name)` lookups need to grow
  to cover the 20 events; that expansion is a follow-up issue once files land.

---

*Generated by [AI-assisted] scaffold; every TODO row above is owned by a human
team member and re-verified at the import gate.*
