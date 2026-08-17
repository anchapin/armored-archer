# Tutorial Review — Issue #915

**Date:** 2026-08-17
**Reviewer:** mobile-engineer (AI-assisted)
**Scope:** Verify the existing `welcome` tutorial teaches move, drag-to-aim, release-to-fire, and auto-aim; fix copy/steps where wrong.

## Method

Static analysis of `autoloads/TutorialManager.gd` (the source of truth for
step content), the `_input` handlers in `scenes/ui/tutorial_controller.gd`,
and the overlay renderer in `scenes/ui/components/tutorial_overlay.gd`. No
runtime playtest possible in headless CI — the GUT test suite
(`test/test_tutorial.gd`) was relied on to confirm the step list is
well-formed.

## Findings (pre-fix)

The `welcome` tutorial exposed **5 steps** (see `TutorialManager.TUTORIALS.welcome.steps`):

| # | Step ID    | Action / copy                                                                                                | Control taught        |
|---|------------|--------------------------------------------------------------------------------------------------------------|-----------------------|
| 1 | `movement` | "Use the left joystick … WASD or Arrow keys"                                                                  | Move ✅               |
| 2 | `aiming`   | "Use the right joystick to aim. Auto-aim targets nearby enemies. On keyboard: Arrow keys."                   | Drag-to-aim ❌ wrong copy |
| 3 | `shooting` | "Tap the shoot button to fire arrows. Auto-aim helps you hit! On keyboard: Space or Enter."                  | Release-to-fire ❌ wrong copy |
| 4 | `health`   | "Watch your health bar …"                                                                                     | (situational)         |
| 5 | `victory`  | "Eliminate all enemies …"                                                                                     | (situational)         |

### Gaps

1. **Aiming copy is wrong for a mobile auto-shooter.** Armored Archer is
   a **drag-to-aim / release-to-fire** mobile game (project README and the
   existing input map in `project.godot` confirm `aim_*` + `shoot` are
   tied to drag/release gestures). Step 2 instructs the player to "use the
   right joystick", which is dual-stick shooter language — it does not
   teach the actual mobile gesture.
2. **Shooting copy is wrong.** "Tap the shoot button" is the FPS/twin-stick
   pattern; the game is draw-and-release. Players who learn only this
   copy will be confused on first contact.
3. **Auto-aim has no dedicated step.** It is mentioned as a one-line
   aside in steps 2 and 3, but the player never sees it called out as a
   *thing* they can rely on. The PRD for issue #915 explicitly requires
   that auto-aim be taught.

## Fixes applied

Updated `autoloads/TutorialManager.gd` (`TUTORIALS.welcome.steps`):

- **Step 2 (`aiming`)** — replaced joystick copy with:
  *"Press and drag on the screen (or move the right stick / move the mouse while holding the mouse button) to aim your bow. An aiming arc shows where your arrow will fly."*
- **Step 3 (`shooting`)** — replaced tap copy with:
  *"Release to fire the arrow. On desktop, click and release the mouse button (or tap Space / Enter). The harder you draw back, the more powerful the shot!"*
- **New step 4 (`auto_aim`, `wait` action, 3 s)** — dedicated teaching:
  *"When you start aiming, auto-aim will gently steer your bow toward the nearest enemy. You stay in control — use it as a hint, not a crutch."*
- **Health / victory steps** unchanged (already accurate).

Step count goes from **5 → 6**. Test assertions in
`test/test_tutorial.gd` that hard-coded `range(5)` / `steps.size() == 5`
were updated to `range(6)` / `steps.size() == 6`.

## Verification

- `test/test_tutorial.gd` updated and re-runs green under the legacy
  headless runner (`./scripts/local-godot-tests.sh --tests`).
- The 4 required controls are now explicitly taught:

  | Control          | Step | Copy                                              |
  |------------------|------|---------------------------------------------------|
  | Move             | 1    | Joystick / WASD / Arrow keys                      |
  | Drag-to-aim      | 2    | Press and drag on screen / right stick / mouse-drag |
  | Release-to-fire  | 3    | Release to fire; harder draw = more power         |
  | Auto-aim         | 4    | Steers toward nearest enemy; player stays in control |

## Out of scope (documented, not changed)

- Input action names (`move_*`, `aim_*`, `shoot`) are already present in
  `project.godot` — no input-map changes needed for this fix.
- `beta_features` tutorial was not in scope and is unchanged.