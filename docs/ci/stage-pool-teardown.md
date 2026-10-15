# Stage smoke delayed enemy return after cleanup

Main commit 34ecaf96 passed backend coverage but failed Test Coverage CI run
38651992340's stage-smoke job 116152735518. The player completed 60 seconds
alive. The strict runtime-error scan caught `ObjectPool.return_enemy` accessing
`available` on an empty dictionary, from the delayed death-animation callback
after pool cleanup. This is a lifecycle error, not a coverage shortfall.

Enemy returns now ignore queued-for-deletion nodes and a cleared destination
pool before parking/resetting the node. Live scene-pool returns and the default
pool fallback remain. Cleanup does not recreate enemy pools. The caller must
still check freed instances before passing them across the typed method boundary.

The six lifetime regression tests pass; reverting production fails three with
the original dictionary access error. Strict 60-second stage smoke passes.
Full GUT reports 634 tests, 561 passing and one existing failure, within the
unchanged baseline. Changed-file GDScript lint passes. No gameplay constants,
health overrides, smoke duration, thresholds or deployment changes.
