# Tutorial suite restoration and deduplication

The legacy and configured tutorial suites were byte-identical. The configured
suite is now canonical; the legacy file inherits it instead of copying tests.

Restoration is test-only:

- Explicit bool/int locals replace inference through a Node-typed manager.
- GUT signal watching replaces captured local flags and treating the error code
  returned by Signal.connect as a Callable for disconnect.
- Overall-progress setup completes every defined tutorial, including
  beta_features. The existing 1.0 expectation is unchanged.
- Fresh test managers keep production tutorial behavior and real disk methods,
  but omit service connections in _ready. Pending wait timers are invalidated
  during teardown, and GUT frees the manager.
- Existing disk backup/restore is retained with a unique backup filename. When
  no original save exists, the test-generated save is removed after the suite.
  The live TutorialManager autoload's in-memory state is not changed.

Godot 4.6: both tutorial script paths parse; configured focused execution runs
13 tests with 13 passes and 62 assertions (with an original save). Full execution finds 674 tests,
601 passes and the same one theme-layout failure, with 97 risky/pending tests.
The unchanged baseline gate passes. Scoped lint and diff check pass. Other
parse/runtime errors and resource leaks remain, so this is not all-clean.

No production tutorial flow, timer duration, reward, threshold, baseline or CI
workflow changes. Tests still cover real save/reload behavior. File backup and
restore are normal-process cleanup, not a guarantee against process crashes.

Same-session pre-patch full run: 661 tests, 588 passes and one failure. Byte
comparison confirms the original tutorial save is restored unchanged; a separate
no-original-save probe confirms the generated save is removed. Backup/read/write
errors stop affected setup or restoration, retaining the backup on restore error.
