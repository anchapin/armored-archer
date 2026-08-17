# MVP-2 Prerequisites

**Status:** Blocking checklist for re-enabling the modes deferred by the MVP
PvE slice (issue #915). The MVP-PvE slice ships with `MVP_PVE_ONLY = true`
([#909](https://github.com/anchapin/armored-archer/issues/909)), which hides
PvP, Shop, and BuyGems from the main menu. Every item below must be closed
**before** that flag is flipped back to `false`.

**Audience:** The next engineer who picks up MVP-2 — typically weeks or months
after this document is written. By that point the original issue context may
be stale; this file is the durable landing page.

**Cross-references:**
- `readiness-gaps.md` (root) — current blocker dashboard.
- `MVP_GAP_ANALYSIS.md` (root) — pillar-level gap analysis.
- `docs/adr/0002-server-declared-match-settlement.md` — the ADR whose intent
  is being bypassed by `update_rank` (see Security below).
- `autoloads/const.gd` (line 40-44) — the `MVP_PVE_ONLY` build const.

---

## 1. Security — `armored_archer/update_rank` ADR-0002 bypass (BLOCKING)

**Why this is first:** This is the only prerequisite that can cause real
player harm (rating tampering, season-leaderboard injection, reward inflation)
if the const-flip is done without it. All other items are operational or
platform gaps.

### What the bypass is

ADR-0002 (`docs/adr/0002-server-declared-match-settlement.md`) ratified that
match settlement is **server-declared only**: the client may trigger settlement
but never assert outcomes. `complete_match` was patched to treat `winner_id` /
`loser_id` as advisory logging only (see `validation.ts` lines 250-257).

`update_rank` was **not** patched. It still accepts client-asserted
`winner_id` / `loser_id` as the authority for Elo, XP, and seasonal reward
settlement, and the anti-cheat signature is **optional** — a client that omits
all four signature fields (`requestId`, `timestamp`, `signature`, `nonce`)
skips signature validation entirely.

### Where it lives in the code

All references are in `backend/src/modules/season_system.ts`:

| Concern | Location | Risk |
|---|---|---|
| RPC registration | `initializer.registerRpc('armored_archer/update_rank', rpcUpdateRank)` — line 492 | Entry point is reachable behind `MVP_PVE_ONLY = true` only if any caller bypasses the const gate. |
| Anti-cheat gate | `function validateRankUpdateSignature(...)` — lines 548-597. The actual guard is **line 566**: `if (request.requestId && request.timestamp && request.signature && request.nonce) {` — the gate is a *presence* check, not a *requirement* check. Any omitted field silently disables signature verification for the rest of the call. | A malicious client can omit all four anti-cheat fields and still get a settled rank update. |
| RPC handler | `export function rpcUpdateRank(...)` — **lines 728-** (function begins at line 728). Reads `request.winner_id` / `request.loser_id` directly and uses them as the winners/losers for the leaderboard write at `applyEloUpdates(...)` (line 669+). | Client can self-assign any opponent and any Elo delta within the leaderboard schema. |
| Schema (permitting the bypass) | `backend/src/modules/validation.ts` **lines 234-248** — `update_rank` declares `winner_id` / `loser_id` as required strings and the four anti-cheat fields as `optional(...)`. Compare with `complete_match` (lines 253-257) which has the ADR-0002 advisory comment. | The schema is the contract-level enabler of the bypass. |

### What "close the bypass" means

At minimum, two changes, both behind the existing RPC handler:

1. **Make signature mandatory.** Either reject the call when any of
   `requestId` / `timestamp` / `signature` / `nonce` is missing, or drop the
   `if (...present)` guard and require signed payloads always. The latter
   means migrating every legitimate caller (the client-side matchmaker +
   combat-system integration) to sign first.
2. **Derive `winner_id` / `loser_id` from the server match state.** Look up
   `match_id` in the server's authoritative match record (the same record
   `combat_system.ts` writes) and use that to authoritatively resolve the
   winner, mirroring how `complete_match` now treats its `winner_id` /
   `loser_id` as advisory only. Honest implementation guidance: drop the
   client-asserted fields from the schema and add `match_id`-only lookup, or
   cross-check the client-asserted values against the server record and
   reject on mismatch.

A regression test should pin the behavior: a request missing any signature
field returns `ANTI_CHEAT_VIOLATION`; a request with `winner_id` not equal to
the server-declared winner returns `MISMATCHED_OUTCOME`.

### Why this is MVP-2 and not MVP

The MVP-PvE slice hides PvP, Shop, and BuyGems behind `MVP_PVE_ONLY = true`.
No honest player path can reach `update_rank` in the MVP build. The bypass
remains dormant until the const is flipped — which is the entire point of
making this an explicit prerequisite before that flip.

---

## 2. iOS export toolchain (BLOCKING for iOS launch)

Godot's iOS export requires a macOS host with Xcode installed. The
Armored Archer dev environment is Linux. Two consequences:

- **No automation path.** No CI lane can produce an iOS build from this
  repository's standard pipeline. Any iOS App Store submission requires a
  manual or out-of-band macOS build.
- **Deferred, not closed.** iOS release is not on the MVP-PvE slice (which
  targets Android via `docs/APP_STORE_ANDROID.md`; the iOS equivalent at
  `docs/APP_STORE_IOS.md` is intentionally thin). MVP-2 should either
  provision a macOS build lane (likely GitHub Actions `macos-latest`) or
  formally state iOS is post-MVP-2.

**Action item (MVP-2):** Confirm whether iOS is in the MVP-2 scope. If yes,
schedule a macOS toolchain lane before flipping `MVP_PVE_ONLY`. If no, mark
iOS as a separate post-MVP-2 milestone so the const-flip does not implicitly
promise iOS readiness.

---

## 3. Const-flip re-enable procedure (DEFERRED — depends on #1 + #2)

Flipping `MVP_PVE_ONLY` from `true` to `false` is the single switch that
restores PvP, Shop, and BuyGems in the main menu. It is implemented in
`scenes/ui/main_menu.gd::_apply_mvp_gating()` (line 97: `if not
NetworkConsts.MVP_PVE_ONLY: return`).

### Pre-flight checklist (do **not** proceed until all are checked)

- [ ] Section 1 closed: `update_rank` bypass is patched and a regression
      test is in place (see `backend/src/modules/__tests__/season_system.test.ts`
      around the existing `update_rank` coverage at line 766+).
- [ ] Section 2 closed (or formally deferred): iOS toolchain decision
      recorded.
- [ ] `make backend-check` passes (lint + typecheck).
- [ ] Godot test suite passes (`./scripts/local-godot-tests.sh`) including
      `test/suites/ui/test_mvp_pve_only_909.gd` (already exercises the
      `MVP_PVE_ONLY = false` early-return path).
- [ ] Smoke test run on a healthy stack (`make services-start` then
      `make smoke-test-quick`).

### The flip

Edit `autoloads/const.gd` line 44:

```gdscript
# Before
const MVP_PVE_ONLY: bool = true

# After
const MVP_PVE_ONLY: bool = false
```

Then rebuild. The `test_mvp_pve_only_909.gd` suite's `test_gating_early_returns_when_const_false`
case (lines 173-187) verifies the source-level contract — the `if not
NetworkConsts.MVP_PVE_ONLY: return` guard — that makes the flip take effect at
runtime.

### What the flip exposes

From the test inventory at `test/suites/ui/test_mvp_pve_only_909.gd`:

- `pvp` button — re-shown (gates entry to MatchmakerManager + duel flow).
- `shop` button — re-shown (gates StoreManager + GemManager + cosmetic shop).
- `buy_gems` button — re-shown (gates IAP / RevenueCat wiring).

Each of these flows has its own pillar-level gaps already documented in
`MVP_GAP_ANALYSIS.md` (Pillars 2-4). The const-flip is a *visibility* unlock,
not a *functionality* unlock — meaning the Mode 2/3/4 P1 gaps become
player-facing at the moment of the flip and must be triaged accordingly.

---

## Change log

- 2026-08-17 — Initial creation (issue #916). Security (ADR-0002 bypass),
  iOS toolchain, and const-flip procedure recorded. Closed prerequisites
  tracker: zero of three closed.
