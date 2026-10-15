# UI component suite restoration

Twenty-six calls to coroutine fixture helpers lacked await. Adding await restores
parsing and reaches all26test methods (27reported checks). Fixture repairs:

- Collect signal arguments in mutable arrays instead of assigning captured
  locals in lambdas. Check the same emitted payloads.
- Call existing component apply_disabled API and retain both native disabled
  and custom DISABLED-state expectations. No production callers requiring a
  disabled-state change were found in scenes/scripts.
- Instantiate the real loading-indicator scene with CenterContainer/Spinner.
- Compare initial ThemeToggle state with manager's actual current mode, not
  an assumed dark default (manager defaults LIGHT and may load a saved mode).

Scoped Godot4.6 execution with the separate ThemeToggle mode API repair applied:
27pass0fail, no SCRIPT ERROR. Temporary SceneTree driver records the existing
node's counters at tree_exiting and returns nonzero for failures. Driver is not
committed. Scoped gdlint/diff checks pass. This slice changes no production code,
reward, threshold, workflow or baseline. Full-suite green is not claimed.

Without the separate production repair, the legacy suite still hits missing
ThemeManager APIs. This PR must wait for that dependency before merge, and own
hosted checks plus fresh latest-main green remain required. Earlier parse-only
probe reached24pass3fail plus fixture/runtime errors, now repaired explicitly
rather than hidden or waived.

Dependency update: ThemeToggle repair merged into main as a7747d0 on October15.
This branch is rebased onto that actual main. Scoped27checks pass0fail with no
SCRIPT ERROR; scoped lint/diffcheck pass. No temporary source application now
needed. Fresh own hosted checks are required on this rebased head before merge.
