# Selected campaign stage owns spawning

The main combat scene starts EnemySpawner with the selected GameManager stage ID,
wave count, encounter stats and boss. Spawning no longer begins at autoload boot,
when no campaign stage exists. Selecting or retrying a stage resets wave clocks,
active-enemy tracking and pooled objects. Leaving combat disarms spawning.

The pooled path receives the resolved archetype scene. Per-stage stats are applied
after the enemy has entered the tree (and its archetype _ready defaults ran), then
reset_for_spawn sets current health. Pooled AI drops its old Player reference.

For stage 1_1, data/campaigns.json specifies four waves of Goblin Scouts with
health30, attack8, speed10. This slice uses those existing values; it does not
tune balance or change campaign data. Boss stages spawn their boss after the last
wave is cleared, not treat a missing-yet-unspawned boss as victory. Stage generations
prevent old boss waits from ending a later retry.

Verification: focused stage tests cover actual pooled archetype/stats, wave
configuration, restart reset, stale deaths, menu disarming, pooled Player refs and
stale boss waits. Rendered normal fresh boot through campaign1_1 confirms the
selected stage and intended scout stats after tutorial skip. Strict60/60dev smoke
and the existing full GUT baseline gate pass locally. Neither is full victory,
reward, server settlement or save/unlock proof; those checks remain separate.
