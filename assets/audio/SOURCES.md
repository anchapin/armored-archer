# Asset Sources & License Tracker

**Owner:** @armored-archer/audio-team (art rows) and audio-team (audio rows)
**Created:** 2026-08-17 (issue #912 scaffold)
**Policy:** `docs/decisions/CC0_HYBRID_POLICY.md`

Every asset under `assets/` MUST have a row in this file. Rows are added by a
human owner (an AI agent cannot verify a CC0 license or a commercial-tier
ElevenLabs license offline). The import gate (`godot4 --headless --quit --import`)
must succeed before issue #912 can close.

Format:

```
| Asset | Origin URL | License | Provenance | Verified |
```

Legend:

- **License:** `CC0 1.0` for public-domain assets; `CC-BY 4.0` for attribution
  packs; `ElevenLabs-Commercial` for Foley AI outputs (must specify model +
  tier).
- **Provenance:** Free-text describing how the asset was obtained (download
  URL, generation prompt, commission invoice, etc.).
- **Verified:** Owner + date (ISO 8601) who confirmed license + provenance.

---

## Existing assets (provenance to confirm)

| Asset | Origin URL | License | Provenance | Verified |
|-------|-----------|---------|------------|----------|
| `assets/audio/sfx/combat/arrow_shot.wav` | TBD — Kenney "Tiny Dungeon" SFX pack candidate | TBD | pre-existing in repo (PR pre-#912); human to confirm | _pending_ |
| `assets/audio/sfx/combat/hit.wav` | TBD — Kenney / freesound CC0 candidate | TBD | pre-existing in repo; human to confirm | _pending_ |
| `assets/audio/sfx/combat/kill.wav` | TBD — Kenney / freesound CC0 candidate | TBD | pre-existing in repo; human to confirm | _pending_ |
| `assets/sprites/kenney/**` (interface, players, weapons, backgrounds, ui) | https://kenney.nl | CC0 1.0 | `assets/sprites/kenney/backgrounds/License.txt` references CC0 1.0 — apply across the `kenney/` subtree | _pending_ |

---

## SFX — to procure (issue #912 plan)

| Asset | Origin URL | License | Provenance | Verified |
|-------|-----------|---------|------------|----------|
| `assets/audio/sfx/combat/reload.wav` | TBD — Kenney / freesound `bow_draw` CC0 | CC0 1.0 (preferred) | _pending_ | _pending_ |
| `assets/audio/sfx/combat/level_up.wav` | TBD — freesound CC0 chime | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/wave_clear.wav` | TBD — freesound CC0 fanfare | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/victory_sting.wav` | TBD — freepd CC0 stinger | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/defeat_sting.wav` | TBD — freepd CC0 stinger | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/boss_intro_heavy.wav` | ElevenLabs Foley | ElevenLabs-Commercial (Creator / Pro tier) | _prompt + tier + date TBD_ | _pending_ |
| `assets/audio/sfx/combat/boss_attack_heavy.wav` | ElevenLabs Foley | ElevenLabs-Commercial | _pending_ | _pending_ |
| `assets/audio/sfx/combat/boss_death_heavy.wav` | ElevenLabs Foley | ElevenLabs-Commercial | _pending_ | _pending_ |
| `assets/audio/sfx/combat/bow_thrum_medium.wav` | ElevenLabs Foley | ElevenLabs-Commercial | _pending_ | _pending_ |
| `assets/audio/sfx/combat/archer_death_goblin.wav` | TBD — Kenney roguelike / freesound | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/archer_death_orc.wav` | TBD — Kenney roguelike / freesound | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/archer_death_skeleton.wav` | TBD — Kenney roguelike / freesound | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/archer_death_bandit.wav` | TBD — Kenney roguelike / freesound | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/combat/loot_pickup.wav` | TBD — Kenney / freesound CC0 | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/ui/click.wav` | TBD — Kenney interface pack (`assets/sprites/kenney/interface/tile_*.png` already CC0) | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/ui/toggle.wav` | TBD — Kenney interface pack | CC0 1.0 | _pending_ | _pending_ |
| `assets/audio/sfx/ui/error.wav` | TBD — Kenney interface pack | CC0 1.0 | _pending_ | _pending_ |

## Music — to procure

| Asset | Origin URL | License | Provenance | Verified |
|-------|-----------|---------|------------|----------|
| `assets/audio/music/menu_loop.ogg` | TBD — freepd.com CC0 `Action` / `Ambient` tag | CC0 1.0 | _pending; loop seam verified per `audio/music/SEAM_VERIFICATION.md`_ | _pending_ |
| `assets/audio/music/combat_loop.ogg` | TBD — freepd.com CC0 `Action` tag (~110–130 BPM) | CC0 1.0 | _pending; loop seam verified per `audio/music/SEAM_VERIFICATION.md`_ | _pending_ |

## Art — to procure

| Asset | Origin URL | License | Provenance | Verified |
|-------|-----------|---------|------------|----------|
| Player archer (idle / draw / release) | Kenney "Roguelike Characters" / "Tiny Dungeon" (CC0) | CC0 1.0 | _frame mapping TBD per `assets/sprites/kenney/SPRITE_SETUP.md`_ | _pending_ |
| Goblin (walk / attack / death) | Kenney "Roguelike Characters" | CC0 1.0 | _pending_ | _pending_ |
| Orc (walk / attack / death) | Kenney "Roguelike Characters" | CC0 1.0 | _pending_ | _pending_ |
| Skeleton (walk / attack / death) | Kenney "Roguelike Characters" | CC0 1.0 | _pending_ | _pending_ |
| Bandit (walk / attack / death) | Kenney "Roguelike Characters" | CC0 1.0 | _pending_ | _pending_ |
| Boss Ch1-A (intro / attack / death) | TBD — itch.io CC0 monster pack OR commission | CC0 1.0 OR CC-BY 4.0 | _pending_ | _pending_ |
| Boss Ch1-B (intro / attack / death) | TBD — itch.io CC0 monster pack OR commission | CC0 1.0 OR CC-BY 4.0 | _pending_ | _pending_ |

---

## Verification checklist (blockers for closing #912)

- [ ] Every row above has a non-`_pending_` value in `Verified`.
- [ ] Every Foley row lists the ElevenLabs model + tier.
- [ ] Every CC0 row lists the original distribution URL (not just "CC0").
- [ ] `godot4 --headless --quit --import` exits 0.
- [ ] `scripts/local-godot-tests.sh --lint` exits 0.
- [ ] No binary asset is committed under `migrations/`, `docs/`, or anywhere
      outside `assets/` without a matching row here.
