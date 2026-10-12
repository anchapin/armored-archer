# Combat health has one owner

GameManager owns accepted combat health changes and mirrors current/max health
directly into Player. Player submits damage after its existing defense reduction
but does not pre-deduct health. Repeated contacts during the existing0.1s gate
leave both values unchanged. The gate now ticks down and resets on combat entry,
so a first hit no longer makes later hits permanently ignored. Healing is applied
once; synchronization no longer calls Player.heal and loops into GameManager.
Lethal damage calls end_game(false), setting combat inactive and emitting one
player_died signal. Stat updates also mirror updated health to Player.

Focused tests cover repeated-hit gate/recovery, heal once and lethal/postdeath
state. Removing the cooldown tick fails the recovery assertion, then restoring
passes. Full GUT returns the existing five-failure baseline and strict60/60smoke
passes. Rendered normal campaign selection, tutorial skip and damage injection
shows110after two same-tick10hits,100after a later10hit,0withGameOverafter lethal
damage, then120/120onretry. These are injected damage checks, not enemy balance
or a human playthrough. Enemy/player simulation while the game-over panel is up,
proper pause controls and real backend rewards remain separate follow-ons.

A final stationary smoke recheck died at53seconds after the cooldown repair.
No balance or survival threshold changed. The combat harness now exercises public
movement input around a small route while existing auto-shoot runs. Three
consecutive60/60runs pass without errors. This checks functioning controls/combat
under movement, not whether a motionless player is invulnerable. Failed runs keep
the failure code and clean up rather than quitting before resource teardown.
