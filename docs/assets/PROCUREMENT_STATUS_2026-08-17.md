# Asset Procurement Status — Issue #956

**Owner:** audio-team (human procurement required for binary assets)
**AI scaffold:** MiniMax-M3 (this pass)
**Updated:** 2026-08-17
**Related:** issue #956, issue #989, `docs/assets/ASSET_PROSING_PLAN_2026.md`, `assets/audio/SOURCES.md`

> **Scope note.** Per the procurement plan, AI agents cannot:
> 1. Verify a CC0 license offline (only the original distribution page can do that).
> 2. Run ElevenLabs Foley without a commercial-tier API key.
>
> This document tracks what the **automatable** part of issue #956 achieved and what
> remains for a human owner. The audio-team remains the responsible party for
> every binary that lands in `assets/`.

---

## 1. Summary

| Category | Required | Already present (binary) | Placeholder files (`.md`) | To procure (human) |
|---|---:|---:|---:|---:|
| Combat SFX | 17 | 3 (arrow_shot, hit, kill) | 14 | 14 |
| UI SFX | 3 | 0 | 3 | 3 |
| Music | 2 | 0 | 2 | 2 |
| Character sprites (Ch1) | 7 | Kenney roguelike/tiny-dungeon pack present (PNG, frame mapping TBD) | — | 7 (frame mapping + 3 boss assets) |
| **Total** | **29** | **3 + 1 pack** | **19** | **26** |

**Net effect of this PR:** no new binary assets committed. The 19 `.md`
procurement placeholders (created in #912) remain in place; each one already
points at a specific plan row + a single human owner. SOURCES.md was updated
to make this state machine-readable. ElevenLabs items (4) are explicitly
flagged as `ElevenLabs-Commercial` rows that **must** be filled by a human
before the file can land.

## 2. What this PR did

- Audited every existing file under `assets/audio/`, `assets/sprites/kenney/`,
  and the new `assets/audio/sfx/{combat,ui}/*.md` placeholders.
- Re-confirmed `godot4 --headless --quit --import` exits clean against the
  current placeholder state (no missing-resource warnings).
- Updated `assets/audio/SOURCES.md` with:
  - Explicit per-row owner + "procurement status" column.
  - Per-row concrete URL candidate (where one exists) instead of `TBD`.
  - A `Last AI pass` column showing which attempt this pass made.
- Added concrete ElevenLabs prompts (saved in
  `docs/assets/ELEVENLABS_FOLEY_PROMPTS_2026.md`) so the human owner can run
  the generation in one paste-and-click.
- Added this file (`docs/assets/PROCUREMENT_STATUS_2026-08-17.md`) as a
  hand-off document.

## 3. What this PR did NOT do

- **Did not download CC0 audio.** The Kenney audio-pack download URLs are
  not stable (the 404s during this pass confirm the issue). Without a
  verified CC0 source URL, the validator script cannot write a SOURCES.md
  row, and committing a `.wav` from an unverified source would violate
  `docs/decisions/CC0_HYBRID_POLICY.md`.
- **Did not generate ElevenLabs Foley.** No `ELEVENLABS_API_KEY` is
  available in CI; the prompts in §4 are ready for the human owner.
- **Did not run loop-seam verification on music.** `Audacity` or
  equivalent is required; the SEAM_VERIFICATION.md template is ready but
  empty.

## 4. ElevenLabs Foley prompts (ready to paste)

Four audio events are gap-fill only per the CC0 policy. The exact prompts
the human owner should use are at
`docs/assets/ELEVENLABS_FOLEY_PROMPTS_2026.md`. Each prompt includes:

- Intensity level (`heavy` / `medium`)
- Target file path (per `FOLEY_AI_SETUP.md` naming)
- Recommended ElevenLabs voice + duration
- License note: must be **Creator or Pro tier** for commercial use

## 5. Per-file action checklist (for human owner)

For each item below, the human owner should:

1. Pick the row in `assets/audio/SOURCES.md` to fill in.
2. Either:
   - Download a CC0 candidate and place it at the canonical path.
   - Or generate via ElevenLabs and place the `.wav` at the canonical path.
3. Run `godot4 --headless --quit --import` to generate the `.wav.import`.
4. Update the SOURCES.md row with: Origin URL, License, Provenance, Verified
   (owner + date).
5. Re-run `make bundle-size-check` + `scripts/local-godot-tests.sh --quick`
   to confirm no regressions.

### 5.1 Combat SFX (14 to procure)

| Canonical path | Plan ref | Source class |
|---|---|---|
| `assets/audio/sfx/combat/reload.wav` | §2 row 4 | CC0 (Kenney / freesound) |
| `assets/audio/sfx/combat/level_up.wav` | §2 row 5 | CC0 (freesound chime pack) |
| `assets/audio/sfx/combat/wave_clear.wav` | §2 row 6 | CC0 (freesound fanfare) |
| `assets/audio/sfx/combat/victory_sting.wav` | §2 row 7 | CC0 (freepd stinger) |
| `assets/audio/sfx/combat/defeat_sting.wav` | §2 row 8 | CC0 (freepd stinger) |
| `assets/audio/sfx/combat/boss_intro_heavy.wav` | §2 row 9 | ElevenLabs (prompt in §4) |
| `assets/audio/sfx/combat/boss_attack_heavy.wav` | §2 row 10 | ElevenLabs (prompt in §4) |
| `assets/audio/sfx/combat/boss_death_heavy.wav` | §2 row 11 | ElevenLabs (prompt in §4) |
| `assets/audio/sfx/combat/bow_thrum_medium.wav` | §2 row 12 | ElevenLabs (prompt in §4) |
| `assets/audio/sfx/combat/archer_death_goblin.wav` | §2 row 13 | CC0 (Kenney / freesound) |
| `assets/audio/sfx/combat/archer_death_orc.wav` | §2 row 14 | CC0 (Kenney / freesound) |
| `assets/audio/sfx/combat/archer_death_skeleton.wav` | §2 row 15 | CC0 (Kenney / freesound) |
| `assets/audio/sfx/combat/archer_death_bandit.wav` | §2 row 16 | CC0 (Kenney / freesound) |
| `assets/audio/sfx/combat/loot_pickup.wav` | §2 row 17 | CC0 (Kenney / freesound) |

### 5.2 UI SFX (3 to procure)

| Canonical path | Plan ref | Source class |
|---|---|---|
| `assets/audio/sfx/ui/click.wav` | §2 row 18 | CC0 (Kenney interface pack) |
| `assets/audio/sfx/ui/toggle.wav` | §2 row 19 | CC0 (Kenney interface pack) |
| `assets/audio/sfx/ui/error.wav` | §2 row 20 | CC0 (Kenney interface pack) |

### 5.3 Music (2 to procure)

| Canonical path | Plan ref | Source class |
|---|---|---|
| `assets/audio/music/menu_loop.ogg` | §3 row 1 | CC0 (freepd `Action`/`Ambient`) |
| `assets/audio/music/combat_loop.ogg` | §3 row 2 | CC0 (freepd `Action` ~110–130 BPM) |

### 5.4 Character sprites (7 to map)

| Canonical path | Plan ref | Source class |
|---|---|---|
| `assets/sprites/player/archer/{idle,draw,release}.tres` | §4 player | Kenney Roguelike (PNG present; frame mapping per `assets/sprites/kenney/SPRITE_SETUP.md`) |
| `assets/sprites/goblin_scout/{walk,attack,death}.tres` | §4 archetype | Kenney Roguelike |
| `assets/sprites/wolf_pack/{walk,attack,death}.tres` | §4 archetype | Kenney Roguelike |
| `assets/sprites/forest_guardian/{walk,attack,death}.tres` | §4 archetype | Kenney Roguelike |
| `assets/sprites/wind_elemental/{walk,attack,death}.tres` | §4 archetype | Kenney Roguelike |
| `assets/sprites/boss_basic/{intro,attack,death}.tres` | §4 boss A | itch.io CC0 OR commission |
| `assets/sprites/boss_wind/{intro,attack,death}.tres` | §4 boss B | itch.io CC0 OR commission |

## 6. Verification gate

Once the human owner lands binaries:

- [ ] Every row in `assets/audio/SOURCES.md` has a non-`_pending_` `Verified`
      value (owner + ISO 8601 date).
- [ ] Every ElevenLabs row lists model + tier.
- [ ] Every CC0 row lists the original distribution URL.
- [ ] `godot4 --headless --quit --import` exits 0.
- [ ] `scripts/local-godot-tests.sh --quick` exits 0.
- [ ] `make bundle-size-check` exits 0.

When all rows are filled and the gates pass, issue #956 can be closed by
re-running this pass (the `Last AI pass` column will read `_pass-N+1_`).

## 7. Addendum — issue #989 test failures (2026-08-17)

Issue #989 tracked 2 persistent Godot test failures attributed to missing
audio binaries. Root-cause analysis showed neither requires procurement to
resolve, so **no placeholder audio was generated** (per the CC0 hybrid
policy, synthetic placeholders would muddy provenance for zero benefit):

1. `[FAIL] test_archetype_helper_goblin` — not an asset failure. The test
   asserts the *event-name* wiring in `base_enemy.gd:archetype_death_event()`,
   which returned `""` because `script.has_method("resource_path")` is always
   false (`resource_path` is a property, not a method). Fixed by reading
   `script.resource_path` directly. This also restores per-archetype death
   SFX routing at runtime for `class_name`-less enemy scripts.
2. The unattributed second `Failed: 1` was cold-`.godot`-cache class
   resolution (GearData / CosmeticSkinData / GearSynergy suites), not audio.
   Running `godot4 --headless --quit --import` before the suite resolves it;
   with a warm cache the full suite is green.

The `[AudioManager] Music asset missing (procurement pending)` warnings for
`menu_loop.ogg` / `combat_loop.ogg` are **by design** — the #914 tests
verify path wiring (which passes) while file presence stays a procurement
signal. Option 1 of issue #989 (procure the real binaries via §5.1/§5.3)
remains open with the audio-team.
