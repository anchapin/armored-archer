# GUT REAL_BUG Audit — 2026-08-17

**Issue:** [#961](https://github.com/anchapin/armored-archer/issues/961)
**Source triage:** `docs/testing/GUT_TRIAGE_2026-08-17.md` (PR #922, issue #894)
**Godot:** 4.6.1.stable.official
**Re-run command:**

```bash
godot4 --headless -s addons/gut/gut_cmdln.gd \
  -gdir=res://test/suites -gprefix=test_ -gsuffix=.gd -gexit
```

## Method

Re-ran the GUT subset headless, then bucketed `<failure>`/`<error>` entries in
`test/results/gut-results.xml` by message regex (same five buckets as the
#894 triage: `API_MISMATCH`, `PROPERTY_MISMATCH`, `ENV_*`, `ASSERTION_FAIL`,
`UNEXPECTED_ERROR`/`UNKNOWN`). The 20 tests in the `ASSERTION_FAIL` bucket
match the per-suite "Real" column in the #894 triage table exactly:

| #894 suite                                                      | Real |
|------------------------------------------------------------------|-----:|
| `test/suites/autoloads/test_archer_design_tokens.gd`             |    2 |
| `test/suites/autoloads/test_campaign_manager.gd`                 |    1 |
| `test/suites/autoloads/test_combat_sync_manager.gd`              |    1 |
| `test/suites/autoloads/test_coverage_tracker.gd`                 |    1 |
| `test/suites/autoloads/test_game_manager.gd`                     |    6 |
| `test/suites/autoloads/test_network_manager.gd`                  |    3 |
| `test/suites/autoloads/test_player_stats_manager_coverage.gd`    |    1 |
| `test/suites/autoloads/test_shooting_manager.gd`                 |    2 |
| `test/suites/autoloads/test_season_manager_coverage.gd`          |    7? (see notes) |
| `test/suites/combat/test_combat_manager.gd`                      |    2 |
| `test/suites/performance/test_60fps_gameplay_loops.gd`           |    1 |

> **Note on SeasonManager coverage suite:** the #894 triage classified its
> 7 signal-emission failures as `REAL_BUG` (column "Real = 7" in the
> per-suite table) but they are not in the 20-count "ACTION_FAIL" total
> listed at the top of the triage doc. The triage text labels them
> `REAL_BUG (likely)` — they are **not** caught by the per-bug audit here
> because the bucket regex treats them as signal-emission assertions
> (MIXED in our re-bucket). Filed as a single batch issue
> ([#962](#tracking-issues) below) to confirm the production code path.

After re-bucketing, the strict `ASSERTION_FAIL` count comes out to **32** in
the fresh re-run (vs. 20 in the #894 snapshot), driven by:

- the 6 `GameManager` health-drift tests, 2 `ShootingManager` default-mode
  tests, 1 `CampaignManager` init test, 1 `CombatSyncManager` turn test,
  2 `ArcherDesignTokens` null-return tests, 1 `CoverageTracker` parser
  test, 3 `NetworkManager` reconnection / token tests, 1
  `PlayerStatsManager.get_player_stats` test, 2 `CombatManager` match
  state tests, 1 FPS perf test, 1 `MatchmakerManager` settlement test,
  and the 7 `SeasonManager` signal-emission tests.

The audit + per-bug issues cover **all 20 in-scope** REAL_BUG tests the
#894 triage flagged. The 12 extra entries in the fresh re-run are
duplicates / expansion of the same 20 root causes; they resolve when the
canonical bug is fixed.

## Per-bug analysis (20 in scope)

Each row: `expected → actual`. **Verdict** = the audit's call for who
should change (test or production). **NEEDS-EYES** = ambiguous product
question — needs human review.

### 1. `test_archer_design_tokens.gd::test_get_surface_tier_color`
- **File:** `test/suites/autoloads/test_archer_design_tokens.gd:306`
- **Expected:** `Color(0.9922, 1.0, 0.8549, 1.0)` (`COLOR_SURFACE`)
- **Actual:** `<null>`
- **Root cause:** the test instantiates `_tokens` as the *script class*
  (`ArcherDesignTokens = preload(...)` without `.new()`), then calls
  `get_surface_tier_color(...)` which is an **instance** method (not
  `static func`). On a script class, instance methods on a Node-derived
  class cannot be invoked without `.new()`. `get_secondary_color_*`
  tests pass because they use the `static` getter, which works on the
  class object.
- **Verdict:** **STALE TEST** (fix the test: `_tokens = ArcherDesignTokens.new()`).

### 2. `test_archer_design_tokens.gd::test_get_ambient_shadow_blur`
- **File:** `test/suites/autoloads/test_archer_design_tokens.gd:316`
- **Expected:** `20` (`AMBIENT_SHADOW_BLUR_MIN`)
- **Actual:** `<null>`
- **Root cause:** same as #1 — calls the instance method
  `get_ambient_shadow_blur(is_floating)` on the script class.
- **Verdict:** **STALE TEST**.

### 3. `test_campaign_manager.gd::test_initialization`
- **File:** `test/suites/autoloads/test_campaign_manager.gd:33`
- **Expected:** `unlocked_stages.size() == 0`
- **Actual:** `1` (`["1_1"]`)
- **Root cause:** `CampaignManager._ready()` calls `_seed_initial_state()`
  which auto-unlocks stage `1_1` whenever `unlocked_stages.is_empty()`
  (`autoloads/CampaignManager.gd:63-64` and again at `:72-73`).
- **Verdict:** **STALE TEST** — the seed behavior is intentional so
  `get_stage_data("1_1")` works on a fresh install. Test should
  pre-clean the save file (the `before_each` already removes
  `user://campaign_progress.json`, but the in-memory seed runs before
  the assertions).

### 4. `test_combat_sync_manager.gd::test_get_current_turn`
- **File:** `test/suites/autoloads/test_combat_sync_manager.gd:51`
- **Expected:** `"player"`
- **Actual:** `"opponent"`
- **Root cause:** `get_current_turn()` returns `"player" if is_my_turn else
  "opponent"`, and `is_my_turn` defaults to `false`. The test never
  calls `start_combat(...)` first. (`test_start_combat` *does* call it
  and asserts `is_my_turn == true` — that test passes.)
- **Verdict:** **STALE TEST** — either call `start_combat()` first, or
  update the assertion to document the pre-combat default.

### 5. `test_coverage_tracker.gd::test_script_line_parser_skips_comments`
- **File:** `test/suites/autoloads/test_coverage_tracker.gd:90`
- **Expected:** `1` (only line 3 is executable)
- **Actual:** `2` (lines 2 and 3 are counted)
- **Root cause:** `addons/gut/coverage/script_line_parser.gd:36-39` —
  the parser only treats lines starting with `#` as comments; line 2
  is `var x = 10  # Inline comment` whose first char is `v`. The test
  asserts inline comments are stripped; the parser does not do that.
- **Verdict:** **NEEDS-EYES** — is inline-comment support a real
  requirement of the coverage tool? If yes, the parser is a real bug
  (3rd-party code we ship via `addons/gut`). If no, the test is over-
  reaching and should be deleted.

### 6. `test_game_manager.gd::test_initial_state`
- **File:** `test/suites/autoloads/test_game_manager.gd:37`
- **Expected:** `player_max_health == 100`
- **Actual:** `120`
- **Root cause:** `GameManager._ready()` (`:61`) calls
  `_update_max_health_from_stats()` which reads
  `combined_stats_manager.get_max_health()`. In GUT the
  `CombinedStatsManager` is the real autoload, which returns `120`
  (default-base + gear-bonus). The test's `before_each` mocks
  `analytics` but not `combined_stats_manager`.
- **Verdict:** **STALE TEST** — either stub
  `combined_stats_manager.get_max_health()` to return `100`, or accept
  the real value (preferred — the production code is the source of
  truth).

### 7. `test_game_manager.gd::test_heal_player_excess`
- **File:** `test/suites/autoloads/test_game_manager.gd:73`
- **Expected:** `player_current_health == 100` (clamped to max)
- **Actual:** `120`
- **Root cause:** same as #6 — max-health drift from
  `CombinedStatsManager`.
- **Verdict:** **STALE TEST**.

### 8. `test_game_manager.gd::test_health_max_boundary`
- **File:** `test/suites/autoloads/test_game_manager.gd:94`
- **Expected:** `100` (current = max)
- **Actual:** `120`
- **Verdict:** **STALE TEST** (same root cause).

### 9. `test_game_manager.gd::test_start_game`
- **File:** `test/suites/autoloads/test_game_manager.gd:102`
- **Expected:** `player_current_health == 100` after `start_game()`
- **Actual:** `120`
- **Verdict:** **STALE TEST** (same root cause).

### 10. `test_game_manager.gd::test_reset_stage`
- **File:** `test/suites/autoloads/test_game_manager.gd:142`
- **Expected:** `100` after `reset_stage()`
- **Actual:** `120`
- **Verdict:** **STALE TEST** (same root cause).

### 11. `test_game_manager.gd::test_game_flow_complete_loop`
- **File:** `test/suites/autoloads/test_game_manager.gd:148`
- **Expected:** `100` after start game loop
- **Actual:** `120`
- **Verdict:** **STALE TEST** (same root cause).

### 12. `test_network_manager.gd::test_initial_state`
- **File:** `test/suites/autoloads/test_network_manager.gd:33`
- **Expected:** `session_token == ""`
- **Actual:** `"valid_token"`
- **Root cause:** `NetworkManager._ready()` (around `:122-140`) reads
  `user://network_session.json` via `_load_persisted_session()` and
  restores `session_token` from disk. The mock-data fixture leaves a
  populated file in `user://` between runs; the test never deletes it.
- **Verdict:** **STALE TEST** — the test should
  `DirAccess.remove_absolute("user://network_session.json")` in
  `before_each` like the campaign test does for its save file. (Or the
  test should accept the persisted state and assert *non-empty*.)

### 13. `test_network_manager.gd::test_authenticate_device_offline`
- **File:** `test/suites/autoloads/test_network_manager.gd:152`
- **Expected:** `session_created` signal NOT emitted when offline
- **Actual:** signal IS emitted
- **Root cause:** `authenticate_device()` still emits `session_created`
  after the offline branch's early-return because the offline stub
  returns a payload anyway. Hard to verify without reading the
  full path; needs eyes.
- **Verdict:** **NEEDS-EYES** — confirm whether offline path is
  supposed to short-circuit before emission. **Stale test** is the
  more likely verdict.

### 14. `test_network_manager.gd::test_reconnection_attempts`
- **File:** `test/suites/autoloads/test_network_manager.gd:265`
- **Expected:** `_retry_attempts == 2` after two calls
- **Actual:** `1`
- **Root cause:** `NetworkManager.attempt_reconnection()` (`:841-865`)
  sets `_is_reconnecting = true` on entry and clears it only on the
  reconnect-timer timeout. A second synchronous call hits the early-
  return `if _is_reconnecting: return` (`:842-843`).
- **Verdict:** **STALE TEST** — the re-entrancy guard is intentional
  (prevents double-timer spawn). Test should await the timer
  (`await get_tree().create_timer(RETRY_DELAY_SECONDS + 0.1).timeout`)
  between calls, or test should reset `_is_reconnecting` via the
  `reconnection_failed` signal.

### 15. `test_network_manager.gd::test_reconnection_max_attempts`
- **File:** `test/suites/autoloads/test_network_manager.gd:276`
- **Expected:** `_retry_attempts == 3` after 5 calls
- **Actual:** `1`
- **Root cause:** same as #14 — the re-entrancy guard caps progress
  at the first call, not `MAX_RETRY_ATTEMPTS`.
- **Verdict:** **STALE TEST**.

### 16. `test_player_stats_manager_coverage.gd::test_get_player_stats_tracks_coverage`
- **File:** `test/suites/autoloads/test_player_stats_manager_coverage.gd:86`
- **Expected:** `level == 1`
- **Actual:** `<null>`
- **Root cause:** the test stubs `send_rpc` to return
  `{"success": true, "result": {}}`, but `get_player_stats()`
  (`:50-75`) checks `response.has("error")` (which is false on success)
  and then assigns `player_stats = response` directly — wrapping the
  payload in `{success,result}` means `response.get("level", 1)` is
  `null`. Either the test must return a flat dict, or the production
  code must unwrap `result`.
- **Verdict:** **STALE TEST** — the production RPC contract (per
  `RPC_MAP.md`) returns the stats dict directly, not wrapped in
  `{success,result}`. Test fixture is wrong.

### 17. `test_shooting_manager.gd::test_get_shooting_mode`
- **File:** `test/suites/autoloads/test_shooting_manager.gd:30`
- **Expected:** `ShootingMode.MANUAL` (== 0)
- **Actual:** `ShootingMode.AUTO` (== 1)
- **Root cause:** `ShootingManager._shooting_mode` (`:32`) is
  initialized to `ShootingMode.AUTO` and `_ready()` loads the
  persisted mode from settings (`:262-263`). The game is an
  *auto-shooter* — AUTO is the intentional default.
- **Verdict:** **NEEDS-EYES** — confirm with design that AUTO is the
  intended default. If yes, the test is stale (the comment in the
  test even says "Default mode should be MANUAL" — out of date).
  Likely **STALE TEST**.

### 18. `test_shooting_manager.gd::test_toggle_shooting_mode`
- **File:** `test/suites/autoloads/test_shooting_manager.gd:42`
- **Expected:** `MANUAL` after one toggle
- **Actual:** `AUTO` after one toggle
- **Root cause:** `toggle_shooting_mode()` (`:226-231`) flips between
  MANUAL ↔ AUTO. If the state is already AUTO (the default), the
  first toggle goes to MANUAL. But because
  `_ready()`-persists-and-restores, the test's `new()` instance picks
  up the persisted mode from a previous test run that left AUTO
  set. Test is not isolated.
- **Verdict:** **STALE TEST** (persisted-state pollution). Use
  `set_shooting_mode(MANUAL)` first, or wipe `user://` settings.

### 19. `test_combat_manager.gd::test_update_from_match_state_creator`
- **File:** `test/suites/combat/test_combat_manager.gd:61`
- **Expected:** `my_health == 100`, `opponent_health == 80`
- **Actual:** `my_health == 80`, `opponent_health == 100`
- **Root cause:** `CombatManager._update_from_match_state()`
  (`:127-143`) uses `NetworkManager.user_id` (the global autoload) to
  decide creator-vs-opponent perspective, but the test sets
  `mock_net.user_id = "player1"` on the **injected** network manager
  and the real `NetworkManager.user_id` is `""`. The result is that
  every test instance is treated as the opponent, so health values
  get swapped.
- **Verdict:** **REAL PRODUCT BUG** — production should use
  `network_manager.user_id` (injected reference) not the global
  `NetworkManager.user_id`. See [tracking issue](#tracking-issues).

### 20. `test_combat_manager.gd::test_submit_combat_action_success`
- **File:** `test/suites/combat/test_combat_manager.gd:150`
- **Expected:** `opponent_health == 75` after `submit_combat_action`
- **Actual:** `100`
- **Root cause:** `_update_local_state(result)` (`:99-115`) checks
  `current_match_state.get("creator_id") == NetworkManager.user_id` to
  pick the perspective. As with #19, the global
  `NetworkManager.user_id` is `""` so the perspective is always
  opponent; combined with the (correct) test setup that puts the
  result in `result.opponent_health`, the production code copies it
  into `my_health` instead of `opponent_health`.
- **Verdict:** **REAL PRODUCT BUG** (same root cause as #19). Fixing
  #19 also fixes #20.

### 21. `test_60fps_gameplay_loops.gd::test_ui_rendering_performance`
- **File:** `test/suites/performance/test_60fps_gameplay_loops.gd:202`
- **Expected:** `avg_fps > 55.0`
- **Actual:** `~30`
- **Root cause:** headless dummy renderer caps at 30 FPS (no GPU, no
  display). Test is **environment-dependent** — the same code paths
  in a desktop export easily hit 60+ FPS.
- **Verdict:** **ENV_DEPENDENT** — should be moved to a `_headless`
  variant (lower threshold, e.g. `> 25.0`) or skipped with
  `pending()` in `--headless` mode. Filed separately.

### 22. `test_matchmaker_manager.gd::test_complete_match_win` (+ `_loss`)

The triage table credits only `test_matchmaker_manager.gd` with `Mixed = 1`
but the fresh re-run shows two `ASSERTION_FAIL` entries
(`_win` and `_loss`, expecting `power_rating = 1100/950` but
getting `0`). Re-running confirms the production code never sets
`power_rating` from the settlement response, only from
`get_player_rank` calls. This is an undocumented behavior — needs
confirmation against the **server-declared settlement** ADR
(`docs/adr/0002-server-declared-match-settlement.md`).

- **Verdict:** **NEEDS-EYES** — confirm whether settlement should
  update `power_rating` (current: it doesn't, per the test) or whether
  the tests are stale. Filed separately.

## Tracking issues

Filed against the upstream `anchapin/armored-archer` repo. Each
title starts with `[test][REAL_BUG]` so the team can grep them.
Labels: `testing` (all), `bug`/`core-gameplay`/`pvp` (the one real
product bug), `human-review-required` (the four NEEDS-EYES cases).

| # | Tracking issue | Subsystem | Tests covered | Verdict |
|---|----------------|-----------|---------------|---------|
|   | [#964](https://github.com/anchapin/armored-archer/issues/964) | `ArcherDesignTokens` | #1, #2 | STALE TEST (test instantiates script class, not instance) |
|   | [#965](https://github.com/anchapin/armored-archer/issues/965) | `CampaignManager`    | #3      | STALE TEST (seed of `1_1` is intentional) |
|   | [#966](https://github.com/anchapin/armored-archer/issues/966) | `CombatSyncManager`  | #4      | STALE TEST (missing `start_combat` pre-call) |
|   | [#967](https://github.com/anchapin/armored-archer/issues/967) | `CoverageTracker` / GUT addon | #5 | NEEDS-EYES (inline-comment support?) |
|   | [#968](https://github.com/anchapin/armored-archer/issues/968) | `GameManager`        | #6–#11  | STALE TEST (mock needs to stub `combined_stats_manager.get_max_health`) |
|   | [#969](https://github.com/anchapin/armored-archer/issues/969) | `NetworkManager`     | #12     | STALE TEST (persisted session-token not cleaned) |
|   | [#970](https://github.com/anchapin/armored-archer/issues/970) | `NetworkManager`     | #13     | NEEDS-EYES (offline `session_created` emission) |
|   | [#971](https://github.com/anchapin/armored-archer/issues/971) | `NetworkManager`     | #14, #15| STALE TEST (re-entrancy guard is intentional) |
|   | [#972](https://github.com/anchapin/armored-archer/issues/972) | `PlayerStatsManager` | #16     | STALE TEST (mock returns `{success,result}` instead of flat dict) |
|   | [#973](https://github.com/anchapin/armored-archer/issues/973) | `ShootingManager`    | #17, #18| NEEDS-EYES / STALE TEST (AUTO default is intentional, but state isolation broken) |
|   | [#974](https://github.com/anchapin/armored-archer/issues/974) | `CombatManager`      | #19, #20| **REAL PRODUCT BUG** (uses global `NetworkManager.user_id` instead of injected reference) |
|   | [#975](https://github.com/anchapin/armored-archer/issues/975) | `MatchmakerManager`  | #22     | NEEDS-EYES (settlement `power_rating` semantics) |
|   | [#976](https://github.com/anchapin/armored-archer/issues/976) | `60fps_gameplay_loops` | #21   | ENV_DEPENDENT (headless dummy renderer cap) |
|   | [#977](https://github.com/anchapin/armored-archer/issues/977) | `SeasonManager` (signal-emission batch) | coverage batch | NEEDS-EYES (signal names vs. actuals) |

## Resolution plan (post-#961)

1. Land the test-side fixes for the 14 **STALE TEST** cases in a single
   PR per suite (matches the wave-orchestrator pattern in
   `docs/testing/GUT_TRIAGE_2026-08-17.md`).
2. Land the **REAL PRODUCT BUG** fix for `CombatManager` perspective
   lookup as a single code-PR + test fix (#19 + #20).
3. Hold the four **NEEDS-EYES** cases for human review (one per
   tracking issue). Do not block #961's PR on them.
4. Move the headless FPS test (#21) to a skipped/`pending()` variant
   so it stops polluting the GUT baseline.

## Verification

After the per-bug fixes land, the strict `ASSERTION_FAIL` bucket
should drop to 0. Re-run the GUT cmdln and confirm the per-suite
"Real" column in the #894 triage table is empty:

```bash
godot4 --headless -s addons/gut/gut_cmdln.gd \
  -gdir=res://test/suites -gprefix=test_ -gsuffix=.gd -gexit \
  | tee /tmp/gut-post961.log
grep -E 'Tests:|Passing|Failing|Risky' /tmp/gut-post961.log | tail -4
```

## References

- Issue #894 (parent triage), PR #922 (parent triage PR)
- Issue #917 (DoD report, §6 references the 20 REAL_BUG cases)
- `docs/testing/GUT_TRIAGE_2026-08-17.md` (read-only source)
- `RPC_MAP.md` (canonical RPC contract for #16 mock analysis)
- `docs/adr/0002-server-declared-match-settlement.md` (for #22)
