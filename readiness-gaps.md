# Readiness Gap Fixes

This file documents the work to fill the readiness gaps.

**Latest:** MVP PvE slice landed 2026-08 via issues #915 (tutorial+balance+DD),
#914 (audio wiring), #913 (frame animations), #911 (audio infra),
#910 (login fix), and #909 (`MVP_PVE_ONLY` const gate). The ratified MVP
scope is **PvE-only**: PvP, Shop, and BuyGems are hidden in the build via
`autoloads/const.gd::MVP_PVE_ONLY = true`. See
[`docs/mvp/MVP-2_PREREQUISITES.md`](docs/mvp/MVP-2_PREREQUISITES.md) for the
blocking checklist that must close before any of those modes re-enable.

For the full pillar-level gap analysis that motivated this slice, see
[`MVP_GAP_ANALYSIS.md`](MVP_GAP_ANALYSIS.md).

## Post MVP PvE Slice (2026-08) Status

### Blockers closed by this slice

| # | Blocker | Closed by | Notes |
|---|---|---|---|
| 1 | Login/services hard dependency (75% stuck on `login_screen`) | #910 — `MAX_AUTH_DURATION_SEC`, exponential backoff (`AUTH_RETRY_DELAYS`), pre-auth health probe (`HEALTH_CHECK_TIMEOUT_SEC` + `HEALTH_GATE_PATH`) | Bounded the entire login/auth sequence to ≤15s with 3 retry attempts; clear retry path. |
| 2 | EnemyFactory placeholders for foundational types | #915 (downstream of balance + tutorial) | Balance calibration removed early reliance on placeholder-only encounters. |
| 3 | Audio infrastructure (silent inventory) | #911 — `default_bus_layout.tres` + `AudioManager` wiring + playback + volume controls | `autoloads/const.gd::SOUND_*` event names are the canonical inventory. |
| 4 | Frame animations missing on Ch1 cast | #913 — SpriteFrames + AnimatedSprite2D for 7 Ch1 characters + menu screen-fades | `autoloads/const.gd::ANIM_*` names standardize the contract. |
| 5 | Sound wiring (event names not plumbed) | #914 — all event names + music transitions per inventory | See `SOUND_*` constants in `autoloads/const.gd`. |
| 6 | Tutorial review | #915 — tutorial review pass | First-time flow now covers the auto-shooter fantasy. |
| 7 | Balance calibration | #915 — balance calibration | Difficulty curve addressed the v4.0.0 "too hard" feedback. |
| 8 | DD (Data Disclosures) UI | #915 — DD disclosure UI | Player-facing data disclosures surfaced in the relevant settings. |
| 9 | MVP scope gating (PvE-only) | #909 — `MVP_PVE_ONLY` const + `main_menu.gd::_apply_mvp_gating()` | PvP, Shop, BuyGems hidden by default. Flip is the MVP-2 escape hatch. |

### Blockers remaining (MVP-2 scope)

| # | Blocker | Tracking | Notes |
|---|---|---|---|
| R1 | DB migrations apply task | #891 | SQL migrations under `backend/data/` apply task still on the list. |
| R2 | Asset procurement (e.g. `menu_loop.ogg`, `combat_loop.ogg`) | #912 | Files marked procurement-pending in `autoloads/const.gd::MENU_MUSIC_PATH` / `COMBAT_MUSIC_PATH`. AudioManager already degrades gracefully (logs warning + skips) so the silence is acceptable until assets land. |
| R3 | MVP-2 prerequisites (security bypass, iOS, const-flip) | #916 → [`docs/mvp/MVP-2_PREREQUISITES.md`](docs/mvp/MVP-2_PREREQUISITES.md) | The single most important "remaining" item: **do not flip `MVP_PVE_ONLY` until the security prerequisite is closed.** |
| R4 | DoD verification | #917 | The MVP Lock Definition-of-Done walk-through. |

### Pillars deferred by the MVP-PvE slice (re-enable via const-flip)

Per `MVP_GAP_ANALYSIS.md` Pillars 2-4:

- **Pillar 2 — Async Matchmaking + Live Duels.** Const-hidden behind
  `MVP_PVE_ONLY`. Full hybrid duel lifecycle (Duel Matchmaking → live Duel)
  remains the P2+ gap from the original analysis. Memo lives in
  `docs/ASYNC_DUEL_LIFECYCLE.md` and ADR-0003.
- **Pillar 3 — Seasonal Leaderboards.** Visible (leaderboard UIs) but the
  season claim + post-PvP rank update flows are not player-reachable until
  PvP is on. The seasonal infrastructure itself is wired.
- **Pillar 4 — Cosmetic Monetization.** Const-hidden. StoreManager +
  GemManager + cosmetic_shop UI exist; real IAP end-to-end vs. test
  fallbacks is unverified.

The const-flip re-enable procedure is documented in
[`docs/mvp/MVP-2_PREREQUISITES.md`](docs/mvp/MVP-2_PREREQUISITES.md) §3.

## Key Findings Summary (from MVP_GAP_ANALYSIS.md, legacy)

**Overall:** Exceptional scaffolding (40+ managers, design system, 1100+ sprites, 94.5% backend coverage, exhaustive planning) but **not yet a shippable MVP**.

**Pillar Status (vs. Frozen MVP Scope):**
- PvE Progression: 🟡 Partial (strong data/backend; blocked by login + enemy placeholders)
- Async PvP: 🔴 Thin (RPCs + UI exist; full turn-based lifecycle not end-to-end proven)
- Seasons/Leaderboards: 🟡 Wired (needs reset/claim + PvP integration verification)
- Cosmetic Monetization: 🟡 Partial (fallbacks + wiring exist; real IAP loop unverified)

**Top 5 P0 Blockers (legacy — see MVP PvE Slice table above for current status):**
1. Login/services hard dependency (reproduced 75% stuck on login_screen when backend down) — blocks all verification.
2. EnemyFactory placeholders for foundational types (Goblin/Skeleton/Archer).
3. PvE persistence not reliably verified end-to-end (retry TODOs remain).
4. Async PvP full duel flow not demonstrated as reliable.
5. Operational startup friction + graceful degradation.

**Recommendation:** Run the Verification Checklist in `MVP_GAP_ANALYSIS.md` with healthy services. Treat as "advanced vertical slice + great infrastructure" until the P0 list is closed. A focused "MVP Lock" effort on reliability + one polished pillar loop is required before beta or store claims.

See the full analysis for pillar tables, cross-cutting gaps (gameplay feel, UX/UI, testing reality, launch ops), and the exact verification steps.
