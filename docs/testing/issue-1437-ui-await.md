# UI component suite parse restoration probe

Twenty-six calls to coroutine fixture helpers lacked await. Adding await restores
parsing without changing test assertions, production source or CI configuration.

Scoped Godot 4.6 execution of the existing runner reaches all checks: 24 pass,
three fail (27 reported checks across 26 test methods). This draft is not a
clean-test result and must not be treated as completed UI coverage.

Observed failures:

- Button state signal and theme toggle signal tests assign captured local
  variables in lambdas; those assignments do not update the outer local.
- Disabled state expects set_disabled to update custom button state; production
  exposes set_button_disabled for that behavior.

Observed runtime errors:

- Loading indicator fixtures attach a script to bare Control nodes without its
  required CenterContainer and Spinner children.
- ThemeToggle calls ThemeManager.is_dark_theme in _ready, but the production
  ThemeManager does not provide that method.

No assertions are weakened, no production APIs are changed, and no failures are
waived here. The two fixture/expectation repairs and production theme API mismatch
need a separately reviewed continuation. Missing await restoration is kept
separate so the previously absent suite's actual results are visible.

Validation: original check-only fails; updated check-only, scoped gdlint and diff
check pass. A temporary SceneTree driver instantiates the existing test node,
records its counters at tree_exiting and exits nonzero for failures; the driver
is not committed. Full-suite green is not claimed.
