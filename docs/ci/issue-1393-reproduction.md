# Issue #1393 Reproduction

## Problem

The `if (config.rateLimit.enabled)` branch and the `else` branch of `backend/src/index.ts` register RPCs through **different mechanisms**:

- **If-branch (lines 254–540):** 31 wrappers via `registerRpcWithRateLimit(initializer, 'armored_archer/<id>', '<id>', rpc<Xyz>Wrapper)`.
- **Else-branch (lines 542–617):** 65 helpers via `registerRpc<Xyz>(initializer)` calls.

Each helper in `backend/src/modules/*.ts` registers a single `'armored_archer/<id>'` literal. The bug class — what hit `get_currency` in PR #1387 — is **divergence**: a wrapper added to one branch without a matching helper in the other. Currently (post-#1387) the rate-limit-enabled branch is a **subset** of the else-branch (31 vs 65; the extra else-branch helpers cover RPCs that don't need per-tenant rate limiting, e.g. lifecycle/cleanup hooks). The branches are in sync today for the 31 RPCs they share.

## Exact divergence points in `backend/src/index.ts`

| Lines        | Branch                      | Mechanism                              |
|--------------|-----------------------------|----------------------------------------|
| `254–272`    | Branch preamble             | `if (config.rateLimit.enabled) {` … shared validator wrappers (`rpcGetCurrencyWrapper`, etc.) |
| `273–541`    | `if` body                   | 31 `registerRpcWithRateLimit(initializer, 'armored_archer/<id>', '<id>', rpc<Xyz>Wrapper)` calls (some duplicate `get_campaign_progress` registration — pre-existing, not addressed here) |
| `542–617`    | `else` body                 | 65 `registerRpc<Xyz>(initializer)` calls — each helper from `backend/src/modules/*.ts` registers exactly one `'armored_archer/<id>'` |
| `618–635`    | Closing braces              | both branches close; `}` of outer `if (config.rateLimit.enabled)` |
| `637–941`    | Wrapper definitions         | 31 `function rpc<Xyz>Wrapper(...)` bodies, each lazy-loading `const { rpc<Xyz> } = require('./modules/<file>')` |

### Pre-existing duplicate registration (out of scope here)

Lines 476–481 register `armored_archer/get_campaign_progress` a second time inside the same branch. This is a pre-existing bug surfaced by parsing — not addressed by issue #1393.

## Rate-limit-enabled RPCs (the set the CI check must verify against the else-branch)

```
armored_archer/accept_match
armored_archer/allocate_stats
armored_archer/app_launch_check   (registered via both branches — see Note)
armored_archer/check_refunds
armored_archer/check_subscriptions
armored_archer/create_match
armored_archer/equip_cosmetic
armored_archer/equip_gear
armored_archer/gain_xp
armored_archer/generate_gear
armored_archer/get_analytics_summary
armored_archer/get_builds
armored_archer/get_bundle_catalog
armored_archer/get_campaign_progress
armored_archer/get_currency
armored_archer/get_equipped_cosmetics
armored_archer/get_leaderboard
armored_archer/get_match_state
armored_archer/get_owned_cosmetics
armored_archer/get_player_performance
armored_archer/get_player_rank
armored_archer/get_player_reports
armored_archer/get_player_stats
armored_archer/get_survey_status
armored_archer/health_check
armored_archer/load_build
armored_archer/process_pending_purchases
armored_archer/purchase_bundle
armored_archer/query_audit_logs
armored_archer/report_player
armored_archer/respec_stats
armored_archer/revenuecat_webhook
armored_archer/save_build
armored_archer/save_cosmetic_loadout
armored_archer/spend_gems
armored_archer/stage_complete
armored_archer/submit_combat_action
armored_archer/submit_survey
armored_archer/sync_difficulty
armored_archer/track_event
armored_archer/track_match_outcome
armored_archer/track_revenue
armored_archer/unequip_cosmetic
armored_archer/validate_purchase
```

Note: `armored_archer/app_launch_check` does not currently appear in the if-branch's `registerRpcWithRateLimit` calls — it lives only in the else-branch via `registerRpcAppLaunchCheck(initializer)`. The CI check below treats the rate-limit-enabled set as the **reference** and verifies it is a subset of the else-branch set.

## Bundle wrapper eval-time re-init source

The eval-time publish loop is emitted into the bundle by **`backend/scripts/transpile-bundle.js`**, lines 1700–1742 (the `__capture` / `__replay` mechanism). The relevant block is:

```js
// transpile-bundle.js L1706–1724
try {
  __nakamaInitBuffer.forEach(function (entry) {
    if (entry.kind === "rpc") {
      initializer.registerRpc(entry.id, entry.fn);
    } else {
      initializer.registerBeforeRtCloseHook && initializer.registerBeforeRtCloseHook(entry.id, entry.fn);
    }
  });
} catch (e) {
  // eval-time publish is best-effort: pool runtimes retry nothing, but a
  // throwing init must not break eval (Nakama would drop the module).
}
```

This is generated code that wraps the webpack-emitted `backend/src/index.ts`. When the bundle loads in Nakama's `goja` runtime:

1. `__nakamaInitBuffer` collects every `initializer.registerRpc(...)` / `initializer.registerBeforeRtCloseHook(...)` call that ran during the first pass.
2. On re-init, the buffer is replayed to re-publish handlers onto the new pool runtime.
3. If any handler throws during replay (e.g., because the rate-limit-enabled branch added a wrapper referencing a module whose `registerRpc<Xyz>` was never called), the catch **silently swallows** the error and leaves pool runtimes with stubs. Those stubs throw `RPC <id> was not registered by InitModule` at first call — which is the failure mode the user sees as `get_currency` failing.

### Why this is silent

The bundle wrapper template (transpile-bundle.js lines 389–603) makes `console.*` and `process.stdout/stderr.write` no-ops. The only way to make an eval-time failure visible to monitoring is to **rethrow** so Nakama's runtime reports the module as unloadable. The CI check below prevents this scenario in CI; this rethrow is the production safety net.

## Hypothesis for the fix

Two changes:

1. **`backend/scripts/transpile-bundle.js`** — replace the silent `catch (e) {}` (line 1708–1724) with a loud rethrow so Nakama drops the module and the error appears in startup logs. The `console.error` call remains documented intent (it's a no-op at runtime, but logs on build/eval); the rethrow is what surfaces in monitoring.

2. **`scripts/ci/verify-rpc-registration.sh` (new)** — a shell check that:
   - Extracts `'armored_archer/...'` literals from the `if (config.rateLimit.enabled)` block (lines 254–540 of `backend/src/index.ts`).
   - Extracts the helper names called in the `else` block (lines 542–617).
   - For each helper name, looks up the `'armored_archer/...'` literal it registers in `backend/src/modules/*.ts`.
   - Asserts the if-branch set is a subset of the else-branch set. Drift (the next `#1387`-class bug) fails CI.

The check is wired into `.github/workflows/ci.yml` as a new step so it runs on every PR.

## Expected outcome

The CI check should **pass today** — branches are in sync after PR #1387. It exists to fail loudly on the next drift.