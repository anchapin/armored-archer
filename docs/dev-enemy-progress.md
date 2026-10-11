# Enemy defeats own wave progress

The HUD uses confirmed regular-enemy defeats against the selected stage's full
wave budget, including future spawns. For1_1 this is3+4+5+6=18. Pending spawns no
longer count as kills; the final spawn emits its live-enemy count. Bosses remain
a separate objective. Resetting or leaving a stage clears progress.

BaseEnemy emits enemy_died at lethal damage before starting animation. The
normal CombatJuiceManager path used to park the enemy without telling the
spawner. That left its active list stale and stopped waves/victory. Death
accounting now does not depend on animation or the fallback return path.

Verification includes actual lethal damage through normal CombatJuiceManager,
duplicate damage/stale-death guards, deferred parking, between-wave and reset
counts, a final-spawn signal assertion, and negative mutations. Rendered normal
campaign selection then tutorial skip shows0/18with3alive and1/18after lethal
damage. The rendering probe uses lethal-damage injection, not a physical arrow
hit. Full GUT baseline and strict configured smoke pass. This slice does not
claim full campaign victory, server reward settlement or save/restart proof.
