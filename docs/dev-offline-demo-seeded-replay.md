# Seeded replay of the offline PvE demo (issue #1861)

The offline demo (`scripts/run-offline-demo.sh`) runs with a pinned RNG seed,
so the same run can be replayed after a gameplay change and the two runs
compared. The seed lives in exactly one place:
`test/smoke/demo_seed.gd` (`DEFAULT_SEED`). The stage harness
(`test/smoke/smoke_stage.gd`) seeds the global RNG from it before the stage
starts and prints `SMOKE SEED: <n>` plus `seed=<n>` on its `SMOKE RESULT:`
line; the runner surfaces that value as the `seed:` line of its summary.

## Workflow

1. Before a gameplay change, run the demo and save the replay block:

   ```sh
   scripts/run-offline-demo.sh --keep-log > /tmp/before.txt
   ```

2. Make the gameplay change.
3. Run the demo again with the same seed (the default — do not pass `--seed`):

   ```sh
   scripts/run-offline-demo.sh --keep-log > /tmp/after.txt
   ```

4. Diff the seeded replay blocks (the section headed
   `OFFLINE DEMO REPLAY SUMMARY (seeded)` — it carries no wall-clock values,
   so a diff shows only real gameplay differences). Extract the block from
   each capture first — the full runner output also contains wall-clock
   lines (`wall_time_seconds`, `play_time_seconds`) that always differ:

   ```sh
   sed -n '/OFFLINE DEMO REPLAY SUMMARY/,/^====/p' /tmp/before.txt > /tmp/before.replay
   sed -n '/OFFLINE DEMO REPLAY SUMMARY/,/^====/p' /tmp/after.txt > /tmp/after.replay
   diff /tmp/before.replay /tmp/after.replay
   ```

A diff is shown to the reviewer; it is not auto-gated. An identical replay
block after a change that was supposed to alter gameplay is itself a finding
(the change may not be wired in).

## Debugging with a different seed

`--seed N` (or `OFFLINE_DEMO_SEED=N`) overrides the pinned seed for one run,
e.g. to reproduce a specific encounter. Overrides never change the pinned
default in `test/smoke/demo_seed.gd`, and a baseline comparison must always
use the pinned default on both sides.
