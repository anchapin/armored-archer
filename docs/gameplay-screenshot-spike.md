# Gameplay screenshot spike — report (issue #1766)

## Decision: ADOPT as a follow-up issue

The `xvfb-run` path on Linux produces real, repeatable gameplay screenshots
with measured numbers below. The demo script (`scripts/gameplay_screenshot_spike.gd`)
lands with this report. The Windows / real-rendering-host path was **not
attempted** — no such host is reachable from the VM — and is not claimed here.
No CI gate is added by this spike; no baselines are committed.

## What was built

`scripts/gameplay_screenshot_spike.gd` — a deterministic offline demo that
plays one campaign stage (default `1_3`, "First Blood") and captures the real
viewport at five fixed moments: stage_loaded, wave_spawn, shot_fired,
enemy_death, boss_spawn. It never logs in and never talks to a server
(`NetworkConsts.MVP_PVE_ONLY` is `true`; the demo drives `GameManager` /
`CampaignManager` / `EnemySpawner` directly, stage data from
`data/campaigns.json` via `CampaignManager.get_stage_data()`). Captures wait
until the subject is on camera (`_is_on_screen` checks), and the script fails
loudly — never writing a placeholder — if the viewport texture is unreadable
or a capture is 1x1 / uniform. Each capture prints a structured
`SPIKE_CAPTURE` JSON line (step, elapsed, enemies spawned/alive/killed,
shots fired, size, distinct colors, byte size); the run ends with a
`SPIKE_SUMMARY` JSON line including pairwise byte-diff ratios. The script
exits on its own (60s timeout) and leaves no Godot process behind (verified
with `ps` after each run below).

Usage:

```sh
xvfb-run -a godot --path . -s res://scripts/gameplay_screenshot_spike.gd -- \
    --out-dir=/abs/path --stage=1_3 --timeout=60
```

## Audit first (no duplication)

- Closed #1464 (headless stage 1_1 smoke test intent): the smoke-test intent
  exists in the tree's E2E/smoke coverage; this spike extends that idea to
  real-pixel captures instead of duplicating the smoke test.
- `test/suites/e2e/` (`E2ETestRunner`, `E2E` framework) and
  `scripts/full_core_loop_demo.gd` (login + PvP steps, `ENABLE_SCREENSHOTS =
  false`): the demo script reuses the same virtual-control / ShootingManager
  driving pattern, but runs offline with screenshots on. It does not replace
  the E2E framework.
- `scripts/screenshot_capture.gd` / `scripts/compare-screenshots.py`: the
  headless dummy renderer cannot read the viewport texture and substitutes a
  1x1 image (confirmed in `screenshot_capture.gd`). That is why this spike
  runs under `xvfb-run` with a real GL context instead of `--headless`.
- Closed #976 (headless dummy renderer FPS cap): no frame-rate or timing
  claim in this report comes from a headless run; wall times below are
  `xvfb-run` runs only.

## Measured results — xvfb-run path (Godot 4.6.3, Mesa llvmpipe OpenGL 4.5)

Three runs, same command (supervisor re-ran run 3; runs 1–2 by the worker,
same binary and command). All captures 640x360 (the project's 640x360
viewport), all non-uniform (31–92 distinct colors sampled).

| Run | Wall (script) | Captures | Shots | Kills | Pairwise diff ratios (consecutive) | Result |
|-----|--------------|----------|-------|-------|------------------------------------|--------|
| 1 | 9.3 s | 5/5 ok | 11 | 1 | 0.0083, 0.0069, 0.0196, 0.0099 | PASS |
| 2 | 9.3 s | 5/5 ok | 12 | 1 | 0.0000, 0.0000, 0.0107, 0.0093 | PASS |
| 3 | 11.2 s | 5/5 ok | 19 | 1 | 0.0242, 0.0154, 0.0368, 0.0075 | PASS |

Capture success rate: 15/15. Flakiness across 3 runs: 3/3 PASS, no run
failed, no orphan process left running, exit code 0 every time. One honest
caveat: in run 2 the first two captures were byte-identical
(stage_loaded == wave_spawn pixels, diff 0.0) even though the wave-spawn
wait requires an enemy on camera — the enemy can be on camera yet contribute
no differing pixels at this resolution. Death and boss steps were distinct
in all 3 runs. The script's per-step distinct-colors check still passed
(40–60 colors), so this is a same-frame-content effect, not a placeholder.
A follow-up that compares screenshots across code changes should therefore
key its assertions to the death/boss steps (or to diff thresholds), not to
stage_loaded-vs-wave_spawn pixel equality.

Cost: ~9–11 s per run on the VM under llvmpipe software rendering, plus a
one-off Godot import. No GPU, no device, no server, no login.

## Paths tried

- (a) `xvfb-run` on Linux: **works** (numbers above). Godot
  4.6.3.stable.official.7d41c59c4, downloaded official Linux binary,
  `timeout 120 xvfb-run -a godot --path . -s
  res://scripts/gameplay_screenshot_spike.gd -- --out-dir=... --stage=1_3
  --timeout=60`. Quit/timeout: the script quits itself at the end of the
  sequence or at the 60 s timeout; `timeout 120` bounds the wrapper.
- (b) Non-headless Godot on a Windows runner / real-rendering host: **not
  attempted** — no such host is reachable from this VM. Not claimed.
- Headless (`--headless`): not a rendering path — dummy renderer, 1x1
  placeholder per `screenshot_capture.gd`; deliberately not used.

## Follow-up suggested

File one issue to wire this demo into the agent loop as a non-required
check (e.g. run the demo after VFX/gameplay changes and attach the
`SPIKE_SUMMARY` + diff ratios to the PR), with assertions keyed to the
death/boss captures per the run-2 caveat above. Do not add committed
baselines or a required CI gate until that follow-up measures CI-side cost
and flakiness on a real runner.

## Out of scope (not done here)

No CI required check, no committed baselines or PNG captures, no Autopilot
(separate spike, Godot 4.7), no Effekseer, no Android/device testing, no new
gameplay content, no workflow-file changes, no production code changes.
Two pre-existing warnings seen in the logs and left alone: missing audio
assets (`archetype_death_guardian.wav`, `boss_intro.wav` — "procurement
pending") and ObjectDB leak warnings at exit.
