# Progression scenario discovery restoration (#1437)

The legacy progression suite called absent GUT `assert_ge`/`assert_le`
helpers, so it did not parse. Use vendored `assert_gte`/`assert_lte`,
preserving all eight inclusive comparisons. A thin inherited script under
`test/suites/progression/` makes the same bodies discoverable by configured GUT.

Each test uses detached production managers, with only persistence overridden.
A minimal campaign fixture supplies one unlocked, incomplete stage so quest
objectives execute. Live autoload state, network signals and save files are not
mutated by this suite. No production behavior changes.

## Verification

Godot 4.6-stable, configured GUT, main bb6994f9:

- Focused selection: 26 tests, 25 passing, 1 risky, 40 assertions, exit 0.
- Full unchanged baseline: 674 tests, 601 passing, 1 failing, 97 risky;
  2826/2827 assertions, 152 errors, 26 warnings, 42 orphans, exit 1.
- Full restored: 700 tests, 626 passing, 1 failing, 98 risky;
  2866/2867 assertions, 152 errors, 26 warnings, 42 orphans, exit 1.
- The existing failure remains in the theme-consistency suite. No baseline
  or workflow changes. Modified scripts pass gdlint and whitespace validation.

The existing six-encounter pacing test asserts only if a break is recommended.
Six encounters do not reach its production threshold, leaving it visibly risky.
This restoration does not change that threshold or weaken an assertion.

The existing higher-difficulty-higher-rewards expectation passes against the
client helper (1.5 at highest difficulty versus 1.0 at normal). This does not
prove authoritative payout scaling: the server helper remains neutral.
Reward design and PRD direction are separate work; this patch changes no rewards.
