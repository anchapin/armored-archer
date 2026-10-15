# Stat allocation suite parse and discovery restoration

The legacy GUT suite used five missing comparison helper names. It now uses
vendored GUT `assert_gte` and `assert_lte`, whose implementations compare with
`>=` and `<=`. Expected values and assertion text are unchanged.

Parsing alone exposed fixture assumptions: the real store has no `_set_gems`
method and the autoload player starts with zero available points. Tests now use
fresh detached fixtures with the same production allocation methods, an in-memory
store and player stats, and no disk persistence or network calls. The valid
allocation fixtures provide 30 points and 20 points respectively. No production
cost, cooldown, validation, authority, threshold or baseline changes.

A thin suite under `test/suites/progression` inherits the restored test file,
so the existing GUT configuration discovers it without copying test bodies.
The legacy runner only instantiates this GUT file; it does not run its test
methods. Discovery matters separately from parsing.

Godot 4.6 verification:

- Original source fails check-only on the five helper names.
- Updated source and inherited suite parse.
- Focused configured GUT discovers one script and executes all 21 tests:
  21 passes, 34 assertions, no skipped tests.
- Same-session full baseline: 65 scripts, 640 tests, 567 passes, one failure.
- Restored full run: 66 scripts, 661 tests, 588 passes, the same theme-layout
  failure, 97 risky/pending tests; unchanged baseline gate passes.
- First full restored run had two additional unrelated failures (health-gate
  engine error and tutorial overlay progress). Baseline and repeated restored
  runs both return to one failure. These flakes are not fixed or waived here.
- Scoped gdlint and diff check pass. Other parse/runtime errors and leaks
  remain; this is not an all-clean project result.

The detached fixture overrides only disk save/load, which these tests previously
checked only for existence. It does not test disk persistence or live RPCs.
