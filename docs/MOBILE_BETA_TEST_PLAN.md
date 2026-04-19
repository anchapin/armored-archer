# Armored Archer — Mobile Beta Test Plan

**Version**: 1.0
**Created**: 2026-04-19
**Scope**: Godot client mobile features for closed beta

---

## Target Devices

| Tier | Representative Devices | Target FPS |
|------|----------------------|------------|
| Flagship | iPhone 14+, Pixel 7+, Galaxy S23+ | 60 FPS |
| Mid-range | iPhone SE 3, Pixel 6a, Galaxy A54 | 45 FPS |
| Budget | Moto G7, Galaxy A12, iPhone SE 2 | 30 FPS |

---

## Touch Controls

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| TC-01 | Dual joystick movement | Hold left joystick in any direction for 3 seconds | Player moves smoothly in joystick direction at expected speed |
| TC-02 | Aim joystick smooth rotation | Move right joystick in continuous circles | Aim rotates smoothly with no snapping (lerp-based smoothing) |
| TC-03 | Aim from standstill | While stationary, move right joystick to aim | Bow rotates toward aim direction immediately |
| TC-04 | Joystick release returns to center | Release either joystick | Joystick thumb returns to center, player decelerates |
| TC-05 | Simultaneous move + aim | Hold left joystick right, right joystick up-left | Player moves right while aiming up-left |
| TC-06 | Deadzone handling | Move joystick slightly within 15% deadzone | No player movement or aim change registered |
| TC-07 | Diagonal movement | Push left joystick to diagonal | Player moves diagonally at correct normalized speed |
| TC-08 | Safe area positioning | Run on notched device (iPhone 14 Pro, Pixel 7) | Joysticks positioned below safe area, no overlap with notch/status bar |
| TC-09 | Landscape orientation lock | Rotate device to portrait | Game stays in landscape, UI does not reflow |
| TC-10 | Multi-touch | Touch both joysticks simultaneously | Both joysticks respond independently |

## Haptic Feedback

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| HF-01 | Shot fired haptic | Fire arrow by pressing shoot | Light vibration (30ms) on shot |
| HF-02 | Screen shake haptic | Trigger medium screen shake | Medium vibration (50ms) on screen shake |
| HF-03 | Critical hit haptic | Land a critical hit on enemy | Heavy vibration (80ms) on crit |
| HF-04 | Kill haptic | Kill an enemy | Success pulse (double vibration) |
| HF-05 | Damage taken haptic | Take damage from enemy | Damage pulse (double vibration pattern) |
| HF-06 | Budget device reduced haptics | Play on budget tier device | Haptic durations shortened (20-40ms) |
| HF-07 | Haptic toggle off | Disable haptics in settings | No vibration on any action |
| HF-08 | Desktop no vibration | Run on desktop platform | No vibration calls made |

## Performance

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PF-01 | Budget device FPS | Play 5-minute PvE session on Moto G7 | Sustained 30+ FPS during combat |
| PF-02 | Mid-range FPS | Play 5-minute session on Pixel 6a | Sustained 45+ FPS during combat |
| PF-03 | Flagship FPS | Play 5-minute session on Pixel 7 | Sustained 60 FPS during combat |
| PF-04 | Memory budget | Play 10-minute session on budget device | Memory stays under 256 MB |
| PF-05 | Memory leak check | Play 30-minute session | Memory growth under 50 MB, no leak detected |
| PF-06 | Object pool reuse | Kill 50 enemies in succession | Enemies recycle via pool, no memory leak |
| PF-07 | Scene transition | Navigate between menu, stage select, gameplay | Scene transitions complete within 1 second |
| PF-08 | Background/resume | Background app during combat, resume after 30s | Game resumes without crash, state preserved |
| PF-09 | Low memory warning | Trigger low memory on device | PerformanceProfiler emits memory_warning signal |
| PF-10 | Particle budget | Combat with 5+ enemies on screen | Particles capped per device tier (50/75/100) |

## Auto-Aim

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AA-01 | Single target selection | One enemy within 500px aim range | Enemy registered and targeted |
| AA-02 | Multi-target priority | 5 enemies in range, aim toward center | Nearest enemy in aim cone (45 deg) selected |
| AA-03 | Target death unregisters | Kill targeted enemy | Enemy unregistered, aim moves to next target |
| AA-04 | Out of range | Enemy beyond 500px | Enemy not registered for auto-aim |
| AA-05 | Aim cone boundary | Enemy at 46 degrees from aim direction | Enemy excluded from targeting |

## PvE

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PV-01 | Full stage completion | Start stage 1-1, kill all enemies | Stage completes, next stage unlocks |
| PV-02 | Boss fight | Complete chapter 1 boss stage | Boss defeated, chapter 2 unlocks |
| PV-03 | Difficulty scaling | Play stage 1-1 then stage 1-5 | Enemies in 1-5 have higher stats |
| PV-04 | Death and retry | Die during stage, select retry | Stage restarts with full health |
| PV-05 | Campaign persistence | Complete stage, close app, reopen | Progress saved, stage shows completed |

## PvP

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| PP-01 | Create match | Select ranked matchmaking | Match created, appears in available list |
| PP-02 | Accept match | Second player accepts match | Match starts, both players see active state |
| PP-03 | Submit turn | Choose action, submit turn | Turn submitted, opponent sees update |
| PP-04 | Reconnect after background | Start match, background app 30s, return | Match state restored, can continue |
| PP-05 | Forfeit match | Select forfeit option | Match ends, opponent wins |
| PP-06 | Turn timeout | Wait past turn timer | Timeout detected, turn auto-submitted |
| PP-07 | Match completion | Complete all turns | Winner determined, ranks updated |

## Store & IAP

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ST-01 | View products | Open store screen | 3 gem packs displayed with correct prices |
| ST-02 | Sandbox purchase | Buy small gem pack in sandbox | Gems awarded, receipt validated |
| ST-03 | Purchase failure | Cancel purchase dialog | No gems awarded, error handled gracefully |
| ST-04 | Restore purchases | Tap restore on already-purchased item | Purchases restored, gems re-awarded |
| ST-05 | Offline queue | Purchase while offline, go online | Pending purchase processes on reconnect |
| ST-06 | Store health check | Open store with store down | Outage detected, user-facing message shown |

## Safe Area

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| SA-01 | Notch device | Run on iPhone 14 Pro | UI elements avoid notch area |
| SA-02 | Dynamic island | Run on iPhone 15 Pro | UI avoids dynamic island |
| SA-03 | Rounded corners | Run on device with rounded corners | Buttons and controls avoid corner areas |
| SA-04 | Orientation change | Safe area after orientation change (if supported) | Safe area recalculated and applied |
| SA-05 | Safe area signal | Change screen size in testing | `safe_area_changed` signal emitted |

## Monitoring

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| MN-01 | Health snapshot | Wait 60 seconds in game | Health snapshot collected and logged |
| MN-02 | Error reporting | Trigger an error condition | Error buffered and reported to analytics |
| MN-03 | App pause flush | Background app with errors in buffer | Error buffer flushed before pausing |
| MN-04 | App resume snapshot | Resume app after backgrounding | Fresh health snapshot taken on resume |
| MN-05 | FPS drop detection | Cause FPS drop below threshold | `fps_dropped` signal emitted and reported |
| MN-06 | Memory monitoring | Play for 5 minutes | Non-zero memory usage reported in snapshots |
