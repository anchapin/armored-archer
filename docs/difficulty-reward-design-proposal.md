# Difficulty rewards: revised proposal for owner review

Status: design only. No reward code, migration, data write or deployment.

## Decisions and limits

October 15 owner decisions: higher difficulty rewards all earned reward types;
match the existing client 1.5x Extreme target; Normal stays 1.0x with scaling
above it. Four-game streaks are a separate approved behavior change.

The scope approval settles the player promise, not every payout mechanic below.
All mechanics marked proposed still need design review. PvE only; ranked,
seasons, Punch-Up, purchased products and premium-currency faucets stay outside
this PvE bonus. IDs, rarity enums, gear stats, modifier pools, unlock counts and
score/stars are not quantities to multiply. A generic numeric-field loop is not
an acceptable implementation of "everything."

## Current settlement map

- `backend/src/modules/dynamic_difficulty.ts:getEncounterRewardModifier` returns
  1.0. Dynamic Difficulty currently does not affect authoritative stage rewards.
- `autoloads/DynamicDifficultyManager.gd` previews Easy 0.8, Normal 1.0, Hard 1.2,
  Extreme 1.5. Easy 0.8 is inconsistent with the new normal-floor intent and must
  be aligned only in the approved implementation, not treated as authority.
- Campaign stage tier is different from Dynamic Difficulty. In
  `backend/src/modules/gear_system.ts`, existing easy/medium/hard/nightmare tier
  multipliers are 0.5/1.0/1.5/2.2. Honest client claims allow easy/medium/hard;
  unknown/nightmare claims clamp to hard. This is an allowlist, not evidence of
  difficulty played. `calculateStageXPGain` rounds (60 base +65 verified boss)
  times stage-tier multiplier. `calculateDropRate` uses 0.45 times stage-tier
  multiplier plus 0.30 for a boss, capped at 1.0.
- `rpcStageComplete` claims before settlement; `applyCompletionAndRespond`
  persists best-of completion before loot and XP. No-improvement returns zero
  XP/no loot. SQL gear insertion retries, then fails visibly; prior completion
  and claim may remain. This is not an atomic exactly-once reward ledger.
- Current success response contains `xp_gained`, single `gear_dropped` and
  `loot.gear`, `drop_rate`, modifier unlocks and completion metadata. It has no
  Coins grant. `stage_xp.ts:grantStageXP` persists server-calculated XP. Any new
  PvE Coins award is a new economy grant, not a missing scalar to multiply.
- No authoritative stage-start RPC was found in current `backend/src`/RPC map.
  An analytics stage-start event is not a challenge snapshot or completion proof.

## Proposed common bonus, not a replacement for campaign tiers

Use one validated dynamic bonus for all eligible earned reward quantities, on
an explicitly defined base. Preserve existing campaign tier math as that base;
do not apply the same bonus twice at client, helper and settlement layers.
Normal and easier get dynamic multiplier 1.0; proposed Hard is 1.2; Extreme cap
is the selected 1.5. The exact intermediate curve/label boundaries remain for
review. Matching the Extreme cap alone does not approve a new continuous curve.

XP and any existing eligible integer currency amount would be multiplied once
and rounded once, with safe-integer bounds and a returned base/bonus/final
breakdown. Proposed rounding: nearest integer, matching current XP convention.
Coins require a mapped authoritative earning route and approved base award
before implementation; this proposal does not invent one. Premium Gems and
purchased products remain unchanged.

## Drops need a concrete choice

Multiplying a probability by the bonus then capping at 100% does not deliver the
same bonus in expected gear when base probability is near 100%. Current single
item response also cannot represent multiple drops. Multiplying rarity or gear
stats would change a different promise and is not proposed.

Proposed option for review: scale expected item quantity, retaining the existing
base loot roll. After a successful base roll, award one item plus a server-side
extra-item roll of `multiplier - 1` (0..0.5). That preserves the base chance and
rarity distribution, gives expected quantity exactly `base chance * multiplier`,
and never uses a probability above 100%. Each extra item is independently rolled
and persisted. It requires a versioned plural `gear_drops`/`loot.items` contract
and client handling, plus a durable per-completion grant ledger before any retry
can grant twice. Normal/easier remains one roll. The alternative is a capped
probability bonus with explicitly non-uniform gains at saturation. The owner
has not yet approved either mechanic or a plural contract.

## Authority and failure design required before code

Record validated challenge configuration and formula version at an authoritative
stage start; bind completion evidence to that session and challenge. Do not use
a caller-supplied modifier, analytics event or current-at-completion difficulty
as proof of the challenge played. Specify missing/mismatched/expired session
behavior and offline replay before enabling a bonus. A new start contract or
schema migration needs its own reviewed diff.

Design settlement around durable per-completion base/bonus/grant records so
partial XP/gear failures cannot double-grant or silently lose a reward. Preserve
claim/best-of protections until a reviewed replacement exists. Current failed
claims and retained best-of records must not be reset or replayed as an assumed
recovery. The normal payout itself may already be partially written: "fallback
to normal" after a settlement exception is not safe without reconciliation.

All new handlers remain synchronous under ADR-0008. Authentication, admin gates,
rollout controls and migration authority do not follow from approval of a cap.

## Review sequence

1. Review base-versus-dynamic composition, intermediate curve/rounding, Coins
   route and drop quantity-versus-probability choice. Confirm exclusions and
   client plural compatibility explicitly.
2. Review exact authoritative stage-start/evidence and grant-ledger contracts,
   including schema needs, retention, offline rules and partial-failure recovery.
3. Add failing tests for forged/missing/mismatched snapshots, replay, duplicate
   completion, every partial-write point, integer bounds, monotonicity and drops
   at base probability 0/near 1/1. Keep PvP/Gems/products unchanged.
4. Implement only after design approval. Align client preview and returned
   breakdown; inspect real gameplay/disclosure. Require own CI plus fresh green
   latest main. No deployment or recovery action is included here.
