# Respec debit confirmation (issue #904, follow-up to #860)

**Status:** Confirmed intentional — paid respecs debit gems. **Awaiting product
owner sign-off below.**

**Owners:** Backend (currency) + Product
**Related:** #860 (currency ledger unification), PR #880, #866 (gold→coins
rename), PR #886, issue #904

---

## What changed in PR #880

Before the ledger unification, `respec_stats` debited the **Nakama wallet**
key `gem` (singular, lowercase). That wallet key was no longer written
anywhere by the post-#860 ledger (the only thing writing the wallet was
the respec path itself), so the debit silently failed. Result: respecs
were effectively free.

PR #880 rewired respec to debit the `player_currency` storage ledger via
`spend_gems`, so a paid respec now correctly subtracts from the player's
gem balance.

## Decision

**Yes, paid respecs now debit gems. This is intentional.**

We are keeping the existing respec cost (5% of the player's current gem
balance — see `RESPEC_COST_PERCENT` in `backend/src/modules/rpg_system.ts`).
The behavior pre-#880 was a bug, not a feature.

## Product owner sign-off

This document is a **living promise** per ADR-0001 (PRD amendment
governance). It records the intended behaviour so future refactors
don't accidentally regress respec back to "free" by reverting the wallet
key.

- [ ] Product owner name:
- [ ] Date:
- [ ] Decision (circle one): KEEP paid respecs as-is / CHANGE — (note new
      behaviour below)

If the product owner wants respecs to be free (or have a different
cost), file a follow-up issue and do **not** silently flip the code —
the ledger write must be removed or rewritten under a new PR with the
decision captured here.

## Why this is a doc, not a code change

Issue #904 explicitly forbids silently changing respec behaviour. A code
change here would be a policy decision, not a bugfix, and policy changes
need product sign-off, a changelog entry, and (if a balance change is
introduced) a migration plan for the players who already spent gems on
respecs under the old "free" behaviour.

## Out of scope for #904

- Reverting respec to the wallet-key path (#880 is the fix; reverting
  re-introduces the bug).
- Changing the respec cost percentage (would require a balancing pass
  with the design team).
- Refunding players who "free-respec'd" between the bug and the fix
  (would require a database scan + ledger credit; file separately if
  product wants it).
