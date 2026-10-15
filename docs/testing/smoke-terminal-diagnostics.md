# Smoke terminal output and failure diagnostics

This is a test-fixture reporting repair, not a gameplay or CI threshold change.
The configured campaign smoke still uses the same route, inputs, spawn RNG and
production stats. The hosted 60-second minimum survival gate is unchanged.

The previous cleanup always printed `SMOKE PASS`, including after `_fail()`.
The process still returned 1, but contradictory output made failures harder to
read. Cleanup now prints `SMOKE PASS` only on exit 0 and `SMOKE FAILED` otherwise,
and a guard prevents overlapping cleanup coroutines.

On death or failure, `SMOKE STATE` records combat time, death time, authoritative
current/max player health, player position, wave and enemy positions/max health/
damage/speed. It does not change those values or reseed RNG.

Local Godot 4.6 checks:

```bash
GODOT=/path/to/godot4 scripts/smoke_stage.sh 60 60
```

- Normal run: combat 60.0 seconds, no death, max 4 enemies, `SMOKE PASS`, exit 0.
- Disposable negative control: replace only the deferred start call with a
  deferred `_fail("negative-control injected failure")`, then restore the source.
  Result: state JSON, `SMOKE FAIL`, `SMOKE FAILED`, no `SMOKE PASS`, exit 1.
- Changed GDScript passes gdlint.

The earlier hosted survival failure is still unresolved. An unseeded local pass
is not a reproduction or a fix. Do not lower the survival gate, change production
balance, choose a favorable seed or rerun until green on this evidence.
