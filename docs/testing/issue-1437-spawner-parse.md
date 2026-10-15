# Spawner mapping suite parse restoration

The level spawner mapping suite failed to parse on Godot 4.6 because `:=`
attempted to infer the result of a method called through a dynamically scripted
Node2D. The local `scene` value now declares `PackedScene` explicitly. No
production source, assertions, comparisons, stage mappings or thresholds change.

Verification on Godot 4.6:

- Original source: check-only exits 1 with the scene inference parse error.
- Updated source: check-only exits 0.
- Focused GUT: one script, six tests, six passes and 33 assertions.
- Full GUT: 65 scripts, 640 tests, 567 passes and one existing failure; the
  unchanged baseline gate passes. The run still reports other parse/runtime
  errors, pending tests and leaked resources, so it is not an all-clean result.

The six restored tests now execute in the existing levels directory. Other
scripts reported in issue 1437 remain separate slices. A pre-existing Float/Int
comparison warning in this suite is unchanged; no assertion was weakened.
