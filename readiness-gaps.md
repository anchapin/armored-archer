# Readiness Gap Fixes

This file documents the work to fill the readiness gaps.

**Latest:** Full MVP Gap Analysis completed (2026-04). See [MVP_GAP_ANALYSIS.md](/MVP_GAP_ANALYSIS.md) for the current state vs. frozen `.planning/MVP-SCOPE.md` definition.

## Key Findings Summary (from MVP_GAP_ANALYSIS.md)

**Overall:** Exceptional scaffolding (40+ managers, design system, 1100+ sprites, 94.5% backend coverage, exhaustive planning) but **not yet a shippable MVP**.

**Pillar Status (vs. Frozen MVP Scope):**
- PvE Progression: 🟡 Partial (strong data/backend; blocked by login + enemy placeholders)
- Async PvP: 🔴 Thin (RPCs + UI exist; full turn-based lifecycle not end-to-end proven)
- Seasons/Leaderboards: 🟡 Wired (needs reset/claim + PvP integration verification)
- Cosmetic Monetization: 🟡 Partial (fallbacks + wiring exist; real IAP loop unverified)

**Top 5 P0 Blockers:**
1. Login/services hard dependency (reproduced 75% stuck on login_screen when backend down) — blocks all verification.
2. EnemyFactory placeholders for foundational types (Goblin/Skeleton/Archer).
3. PvE persistence not reliably verified end-to-end (retry TODOs remain).
4. Async PvP full duel flow not demonstrated as reliable.
5. Operational startup friction + graceful degradation.

**Recommendation:** Run the Verification Checklist in `MVP_GAP_ANALYSIS.md` with healthy services. Treat as "advanced vertical slice + great infrastructure" until the P0 list is closed. A focused "MVP Lock" effort on reliability + one polished pillar loop is required before beta or store claims.

See the full analysis for pillar tables, cross-cutting gaps (gameplay feel, UX/UI, testing reality, launch ops), and the exact verification steps.
