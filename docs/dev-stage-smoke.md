# Configured local dev stage smoke

Run `GODOT=/path/to/godot4 scripts/smoke_stage.sh 60 60`.

The wrapper imports assets and creates a temporary user-data directory, removed
on exit. It never uses the developer's normal tutorial or campaign save.
The test opens the campaign map and selects 1_1 through its normal stage-selection
handler, then checks the stage ID and encounter data before testing controls.
It does not cover login, privacy acceptance or a real connected backend.

The fresh tutorial must remain on Movement for four seconds without player damage
or new spawns. Movement and aiming touch callbacks, release reset and shooting
must advance teaching. The final defeat-enemies objective must resume combat.
The combat survival clock starts after teaching, not at scene boot. The existing
CI invocation requires 60 seconds alive or an earlier victory, and at least one
active enemy. This is not proof of victory, rewards or save/unlock persistence.

The custom headless SceneTree invokes the joystick's input callback explicitly
with screen-touch events. It does not claim to exercise OS input dispatch or a
physical touchscreen. Rendered-window input routing remains a separate playtest.

The wrapper fails on engine ERROR lines (including physics callback errors),
script/parse errors, nonzero exit, or a missing SMOKE PASS marker. No runtime
errors are allowlisted. Teardown stops audio and releases playback streams, frees
the stage/pool and gives the audio thread a short real-time drain window before
exiting. Run wrapper regressions with:

```bash
python3 scripts/tests/test_smoke_stage_wrapper.py
```

The strict offline run exposed StatAllocationManager fetching server season info
before connection. That manager now waits for actual NetworkManager online state
and fetches on later connection as well. It disconnects its signals on exit.
SeasonManager's disconnected error contract and NetworkManager auth/fail-closed
behavior are unchanged. Connectivity lifecycle coverage uses a narrow stub test;
real backend-present Godot verification remains outstanding.

Arrow contact return deactivates the arrow immediately but defers pool parking
until after the physics callback. Duplicate contact/return requests are ignored
until parking completes. This prevents CollisionObject process-mode changes
inside physics callbacks. Regression coverage includes an actual overlap with
a static wall and exactly one pool entry after return.
