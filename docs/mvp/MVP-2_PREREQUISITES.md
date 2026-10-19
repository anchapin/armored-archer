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
- `autoloads/const.gd` (line 45) — the `MVP_PVE_ONLY` build const.

---

## 1. Security — `armored_archer/update_rank` ADR-0002 bypass (CLOSED)

**Status: closed.** The client-facing `armored_archer/update_rank` RPC no
longer exists, so there is no bypass left to close. This section is kept as
the record of what the hole was and how it was closed; it is no longer a
blocker for the const-flip.

### What the bypass was

ADR-0002 (`docs/adr/0002-server-declared-match-settlement.md`) ratified that
match settlement is **server-declared only**. `update_rank` historically
accepted client-asserted `winner_id` / `loser_id` as the authority for Elo,
XP, and seasonal reward settlement, and its anti-cheat signature check was a
*presence* check rather than a *requirement* check.

### How it was closed

- #955 / #984 required the anti-cheat signature (HMAC verification on by
  default).
- #1076 / #1114 removed the client-facing RPC entirely. Elo now moves only
  via server-settled matches. Evidence in current code:
  - `backend/src/index.ts` (around line 596) carries the tombstone:
    `update_rank is intentionally NOT registered — removed in issue #1076`.
  - `backend/src/modules/season_system.ts` (around line 639) records the
    removal of `rpcUpdateRank` + `registerRpcUpdateRank`.
  - `backend/src/modules/__tests__/season_system.test.ts` ("update_rank
    removal (issue #1076)") pins that no `registerRpc*` export registers
    `armored_archer/update_rank`.
  - `backend/src/modules/__tests__/anti_cheat.test.ts` pins that a
    client-asserted winner/loser payload fails signature verification.

### Remaining micro-cleanup (non-blocking)

The `update_rank` entry in `backend/src/modules/validation.ts`
(`ZodSchemas`) is a dead schema — no handler validates against it since the
RPC was removed. Removed alongside this doc update in the same PR; no
behavior change.

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

## 3. Const-flip re-enable procedure (DEFERRED — depends on #2; #1 is closed)

Flipping `MVP_PVE_ONLY` from `true` to `false` is the single switch that
restores PvP, Shop, and BuyGems in the main menu. It is implemented in
`scenes/ui/main_menu.gd::_apply_mvp_gating()` (line 97: `if not
NetworkConsts.MVP_PVE_ONLY: return`).

### Pre-flight checklist (do **not** proceed until all are checked)

- [x] Section 1 closed: `update_rank` RPC removed (#1076/#1114); removal
      pinned by `backend/src/modules/__tests__/season_system.test.ts`
      ("update_rank removal") and `anti_cheat.test.ts` signature tests.
- [ ] Section 2 closed (or formally deferred): iOS toolchain decision
      recorded.
- [ ] `make backend-check` passes (lint + typecheck).
- [ ] Godot test suite passes (`./scripts/local-godot-tests.sh`) including
      `test/suites/ui/test_mvp_pve_only_909.gd` (already exercises the
      `MVP_PVE_ONLY = false` early-return path).
- [ ] Smoke test run on a healthy stack (`make services-start` then
      `make smoke-test-quick`).

### The flip

Edit `autoloads/const.gd` (line 45 at time of writing):

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
- 2026-10-18 — Section 1 marked CLOSED (#1658): the `update_rank` bypass was
  already fixed by #955/#984 (mandatory HMAC) and #1076/#1114 (RPC removed);
  doc rewritten to record reality. Stale line references updated; dead
  `update_rank` Zod schema removed. Tracker: one of three closed.
