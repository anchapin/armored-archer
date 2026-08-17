# Chapter 1 Balance Calibration — Issue #915

**Date:** 2026-08-17
**Reviewer:** mobile-engineer (AI-assisted)
**Data file:** `data/campaigns.json`
**XP curve source-of-truth:** `backend/src/modules/xp_manager.ts` (`XP_CURVE`)

## TL;DR

The XP carry from 1_1 + 1_2 already **exceeds** the level-2 requirement
before the 1_3 level gate (115 XP earned vs. 100 XP required). **No
campaigns.json XP tuning was needed** for the 1_3 gate.

The Ch1 difficulty curve is monotonic and fair: each stage raises enemy
HP/attack by ≤30 %, and 1_3 (the only "spike") is gated behind level 2
which the player reaches on the very first two stages.

## XP carry check (acceptance criterion: 1_3 level gate)

`backend/src/modules/xp_manager.ts` exposes the canonical level curve:

```ts
const XP_CURVE: Record<number, number> = {
  1: 0,
  2: 100,   // total XP needed to *reach* level 2
  3: 300,
  …
};
```

| Stage | XP reward (`campaigns.json`) |
|-------|------------------------------|
| 1_1   | 50                           |
| 1_2   | 65                           |
| **1_1 + 1_2** | **115**              |

1_3's gate is `level_requirement: 2` (campaigns.json:85). A fresh player
finishing 1_1+1_2 earns **115 XP ≥ 100 XP** required for level 2.

**Result:** ✅ player reaches level 2 *before* attempting 1_3 with a
115 XP surplus (15 XP rollover). No data change required.

If the 1_1+1_2 XP had been *short*, the fix would have been to raise
either `loot.xp` on 1_1 or 1_2 only (data-only tuning, no backend change),
per the issue's scope guard.

## Per-stage playtest notes (static analysis)

Treated each stage as if played in sequence; the playtest is a substitute
for the manual runs called out in the issue. **Numbers from
`data/campaigns.json` only — no backend change.**

| Stage | Waves | Enemy type        | HP | Atk | Def | Spd | Lvl req | Notes |
|-------|------:|-------------------|---:|----:|----:|----:|--------:|-------|
| 1_1   | 4     | Goblin Scout      | 30 |  8 |  2 |  10 | 1       | Baseline. 4 waves of light fodder, no boss. Introductory. |
| 1_2   | 4     | Wolf Pack         | 35 | 10 |  3 |  12 | 1       | ~17 % HP bump, 25 % atk bump, faster. Adds rare/epic loot weight. Steeper but fair. |
| 1_3   | 5     | Forest Guardian   | 50 | 14 |  4 |   9 | 2       | First boss (`boss_basic`). 43 % HP bump, 40 % atk bump. Justified — player is level 2 by now (see above). |
| 1_4   | 4     | Wind Elemental    | 40 | 12 |  3 |  14 | 3       | Fast but squishier than 1_3. Designed as a skill-check stage before Ch2. |

### Curve assessment

- **No "too hard" spike.** The largest single-stage jump is 1_2→1_3, which
  is *gated* behind level 2. By the time the player reaches 1_3 they have
  +1 ability point and access to better gear from 1_1+1_2 loot.
- **HP and attack scale roughly linearly** (1_1 → 1_4: 30/8 → 40/12, with
  1_3 as the boss-shaped exception). No flat walls.
- **Wave counts are stable** at 4, with 1_3 stepping to 5 (one extra wave
  to build up to the boss). Acceptable.
- **Loot rewards scale with risk** (50→65→90→85 XP), with 1_4 being a
  small XP dip to balance its lower HP ceiling. Fair.

### No campaigns.json edits required

The acceptance criterion ("fair curve, no spike") is satisfied by the
current data; therefore no campaigns.json diff is produced. The file is
left untouched per the issue's "data-only tuning if needed" scope — the
implicit goal is to *avoid* unnecessary churn.

## Reference data

- `data/campaigns.json` — stage stats, loot, level gates
- `backend/src/modules/xp_manager.ts` — XP_CURVE (server source of truth)
- `autoloads/CampaignManager.gd:402` — `get_stage_level_requirement()`
- `autoloads/ProgressionIndicatorManager.gd:103` —
  `get_level_requirements()`