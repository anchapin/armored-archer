# Combat pause lifecycle

The configured Pause action and an on-screen Pause button stop stage simulation.
Resume or the Pause key resumes it. The stage owns this SceneTree pause and
releases it when leaving for the campaign map or reloading a stage.

Player, pooled enemies/arrows and the spawner's timers inherit the tree pause.
Only the stage input handler, Pause/Resume controls and GameOver controls remain
live. This matters because pooled combat nodes are children of ObjectPool, not
Main. Pausing only Main would leave projectiles and enemies moving.

Pause and results cancel held movement/aim touches without firing an arrow.
Inactive combat rejects player movement/shooting. Defeat freezes simulation
behind GameOver, but Try Again can still leave for the campaign map. Campaign
victory retains its existing automatic map return, releasing the owned pause.
The delayed boss victory timer also respects the tree pause.

The welcome tutorial keeps its separate enemy-only pause: movement and aim
teaching remain live. This change does not add rewards or alter balance.

## Validation

- Four focused tests, 28 assertions: positions and wave clocks freeze, Resume
  restarts clocks/projectiles, result controls remain live, keyboard toggle,
  touch cancellation consumes no ammo, stage exit releases the pause.
- Disabling both pause assignments produces three failing focused tests.
  Restoring the assignments passes all four.
- Full GUT: 620 tests, 543 passing, five existing failures, 97 risky/pending.
  No additional failure relative to the previous 616-test run.
- Strict configured tutorial plus moving campaign combat: 60/60 seconds PASS,
  no runtime ERROR. This does not prove an ordinary aiming victory or backend
  reward settlement.
- Rendered 500x850 Pause/Resume and GameOver checked for readability. Actual
  Resume and Try Again buttons return to live combat and the unpaused map.
- Focused GUT retains one ScreenShake orphan from its pooled combat fixture;
  the full suite has existing resource warnings. These are not hidden by
  reducing the production smoke gate.
