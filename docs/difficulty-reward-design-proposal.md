# Difficulty rewards: design proposal for owner review

Status: proposal only. The owner approved the direction "higher difficulty
should have higher rewards" on October 15, 2026, not a payout formula or code.

## Current state and gap

The server helper `getEncounterRewardModifier` in
`backend/src/modules/dynamic_difficulty.ts` returns 1.0 and documents reward
neutrality. The client `DynamicDifficultyManager.get_encounter_reward_modifier`
already returns Easy 0.8, Normal 1.0, Hard 1.2 and Extreme 1.5.
`CombatManager.apply_difficulty_to_rewards` multiplies numeric reward fields.
These client helpers do not prove authoritative payouts scale. Restored legacy
progression assertions exercise the client helper, not server settlement.

Do not copy that generic client multiplier into server rewards. It could scale
unintended currencies or non-reward numeric fields. Client values are not proof
of difficulty played.

## Proposed first version, not approved

- PvE only. Keep PvP, ranked rewards, seasons, Punch-Up and purchased products
  unchanged.
- XP and Coins only initially. No Gems, item count, rarity, modifier pools or
  drop-rate changes. This is a proposed limit for review, not settled scope.
- Keep the normal payout as the floor. Reward bonus rises with harder validated
  challenge; do not reduce easier-mode payouts until the owner chooses that.
- Prefer a continuous bounded bonus over client Easy/Hard/Extreme labels.
  Candidate formula: `1 + max(0, server_modifier)`, up to 1.20x at +0.20.
  Existing client 1.5x Extreme is historical behavior, not an approved target.
- Server records the difficulty and formula version when accepting stage start;
  completion uses that snapshot, never a caller-supplied modifier. Require
  completion evidence for the recorded challenge. A local preview cannot
  authorize or increase the payout.
- Apply once in the existing server stage-settlement path, retaining dedup and
  retry/idempotency protection. Return base reward, bonus and final reward so
  the client can display the breakdown without recalculating it as authority.
- Round once after calculating the final XP/Coins reward, with explicit integer
  bounds. Do not allow a failed or replayed completion to earn another bonus.

## Decisions needed before code

1. Confirm eligible rewards: XP and Coins only, or other earned rewards too?
2. Choose the curve/cap: proposed 1.20x at +20%, existing client 1.50x Extreme,
   or another target. Confirm whether easier difficulty keeps normal payouts.
3. Confirm when difficulty locks for payout and what server evidence is enough
   to establish the harder challenge was actually played.

## Implementation and review stages

First map live stage start, completion, replay and reward-ledger ownership and
existing failure recovery. Propose the exact storage/handler diff for review,
including whether a schema migration is necessary. Do not infer permission for
migrations, auth changes, balance thresholds or rollout controls.

Then add failing server tests for forged client modifiers, missing/mismatched
stage snapshots, duplicate completion and retry after partial failure. Add
monotonicity/bounds/rounding tests and unchanged PvP/Gems/loot tests. Implement
only after approval of the formula and authoritative contract. Finally align
client preview and vocabulary with server-returned breakdown, verify normal
route gameplay and rendered disclosure, and merge only under normal CI gates.

No deployment, reward code or reward data change is included in this proposal.
