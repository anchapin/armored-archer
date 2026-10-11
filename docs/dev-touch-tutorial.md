# Local dev controls and safe onboarding

The combat scene binds TouchUI to its Player explicitly. The HUD CanvasLayer
is not the Player's parent, so TouchUI must not depend on that hierarchy.
Movement release clears virtual movement. Nonzero touch movement and aiming
advance the same tutorial steps as keyboard input; aiming release fires through
the existing player shooting path and clears touch aim.

Welcome teaching begins before the game starts. Enemy simulation, spawn and
wave clocks, automatic shooting, and damage are paused during the control and
timed-hint steps. Player input and manual shooting stay live. Combat resumes
for the final defeat-enemies objective, on skip, or after completion. Victory
completes the welcome tutorial before returning to the campaign map. An explicit
skip is retained on a later visit. Parked pool nodes remain parked.

Timed steps carry a generation guard: a delayed beta-tour timer must not advance
a welcome step started later. This matters on a fresh boot after beta dismissal.

## Verification

Run after a fresh import with Godot 4.6:

```bash
godot4 --headless --quit --import
godot4 --headless -s addons/gut/gut_cmdln.gd -gconfig= \
  -gtest=res://test/suites/dev/test_touch_tutorial.gd -gexit
```

The focused suite covers binding across the HUD boundary, movement release,
touch tutorial progression, shoot release, teaching/victory/skip behavior,
returning-player state, timer pause/resume, parked enemies, damage suppression,
victory completion, and stale timed steps. The full GUT suite still has an
existing failure baseline; use its normal baseline gate, not an all-green claim.

Live fresh-save verification should use the normal project boot, privacy and
beta dismissal, campaign map, and stage 1_1. Synthetic screen-touch events can
verify engine input routing, but are not a physical mobile-device playtest.
Backend-present boot, full stage/reward persistence, visual sizing, and the
separate Player/HUD health consistency issue are follow-up checks.
