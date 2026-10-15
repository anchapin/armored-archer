# Desktop and touch controls (#1448)

TouchUI AUTO uses display touch capability. DESKTOP hides/disables both stick
inputs; explicit TOUCH/DESKTOP modes support previews and tests. Hiding or safe
area relayout cancels held touch state without firing. The existing HUD
CanvasLayer is retained. Both sticks use120px local bounds, bottom corners and
12px padding plus inward safe margins. Their combined rectangular bounds occupy
12.5%of640x360. Circular transparent SVG ring/thumb textures replace the grey
square gradient; idle ring is faint and active ring brighter. Radius derives
from local size rather than repeated viewport multiplications. Thumb travel
and deadzone behavior remain; two fingers retain independent ownership.

Desktop input is a new path, not just hiding controls: mouse motion aims, left
button PRESS fires once at the clicked world position, release does not fire.
WASD movement, arrow aiming, Space/Enter shooting remain. Keyboard/virtual aim
wins when active; otherwise pointer aim follows camera transforms even without
new mouse motion. Only unhandled mouse events reach shooting, so UI buttons can
consume clicks; the empty touch overlay ignores mouse events. Emulated touch
mouse events and inactive/paused gameplay do not fire. Pointer actions notify
the existing tutorial, whose desktop instruction now says left-click to fire.
No firing cadence, damage, reward or authority changes.

## Validation

Godot4.6 focused15tests15pass51assertions. Includes actual SubViewport input
routing to a world player versus a Button, safe-margin placement, stable resize
radius, two-finger ownership, hide/cancel, keyboard priority, camera transform,
click direction and emulated-touch suppression. Shooting is spied, not sent to
services. Full689tests616pass1fail97risky versus main674tests601pass1fail97risky;
same152errors26warnings42orphans and existing theme-consistency failure.
Paired XML/baseline gate, scoped gdlint and diff checks pass.

Rendered actual touch_ui scene in640x360 via compatibility renderer and inspected
idle/active/desktop PNG pixels: round bottom-corner controls, clear centers,
no square fill, stronger active opacity, and no desktop sticks. This is an
isolated scene preview, not a physical phone or full gameplay screenshot.
Hardware touch/gesture feel and target-device safe areas remain unverified;
synthetic events exercise input ownership and bounds. No deployment or live
E2E/service execution. Normal own CI and fresh latest-main green gates apply.

Hosted StageSmoke initially failed because its headless desktop host directly
sent touch callbacks to correctly hidden joysticks. Its touch-teaching fixture
now explicitly selects TOUCH preview mode; no workflow/gate/timeout changes.
Isolated scripts/smoke_stage.sh60/10 passes: teaching/touch/release and60seconds
configured1_1combat, no death, max5enemies, strict runtime-error check clean.
Desktop visibility and real UI event routing remain separately tested.
