# Usability Findings: Heuristic Evaluation

**Date:** 2026-04-18
**Issue:** #733
**Scope:** First 15 minutes of gameplay + first purchase experience

---

## Executive Summary

A heuristic evaluation of the FTUE and purchase flows identified 11 issues across critical, moderate, and low severity. Four critical issues were addressed directly in code. The remaining issues require further validation through live usability sessions before committing fixes.

## Critical Issues (Fixed)

### C1: Purchase has no confirmation dialog
- **File:** `scenes/ui/store_menu.gd`
- **Impact:** Users could accidentally trigger real-money purchases with a single tap
- **Fix:** Added `ConfirmationDialog` that shows product name + gem amount before initiating purchase. Users must explicitly confirm or cancel.
- **Status:** FIXED

### C2: Tutorial text is keyboard-first on a mobile game
- **File:** `autoloads/TutorialManager.gd`
- **Impact:** Mobile users see "Use WASD" as primary instruction, causing confusion about controls
- **Fix:** Reordered descriptions to be mobile-first: "Use the left joystick" then "On keyboard: WASD"
- **Status:** FIXED

### C3: No visual feedback on successful purchase
- **File:** `scenes/ui/store_menu.gd`
- **Impact:** After purchase, only a console log confirms success. Users may tap again, thinking it failed
- **Fix:** Added animated success panel showing "Purchase Complete! +N Gems" with scale-in animation, auto-dismiss after 2.5s
- **Status:** FIXED (requires scene `.tscn` update to add SuccessPanel node)

### C4: Settings button does nothing silently
- **File:** `scenes/ui/main_menu.gd`
- **Impact:** Users tap Settings and nothing visible happens (only a console print)
- **Fix:** Shows an AcceptDialog with "Settings coming soon" message. Falls back to `settings_screen.tscn` if the scene exists
- **Status:** FIXED

## Moderate Issues (Requires Usability Session Validation)

### M1: Campaign map information overload
- **Observation:** Stage buttons show difficulty number, stage ID, wave count, boss tag, quest markers, and level requirements simultaneously. New players face 7+ data points per button
- **Recommendation:** Progressive disclosure - show only stage name and lock status initially; reveal details on tap/hold
- **Blocks users?** Potentially - new players may not know which button to tap first

### M2: No gear/loadout tutorial
- **Observation:** Loadout button is visible on main menu from the start, but no tutorial explains what gear is or why it matters
- **Recommendation:** Add a 2-step loadout tutorial after the welcome tutorial completes, triggered when player first returns to main menu after combat
- **Blocks users?** No - players can skip loadout entirely

### M3: Tutorial skip only available after step 1
- **Observation:** `can_skip: current_step_index > 0` means users must complete the movement step before seeing the skip button. Users who already know controls have no escape
- **Recommendation:** Add a persistent "Skip All" option even on step 0, perhaps behind a 2-tap confirmation to prevent accidental skips
- **Blocks users?** Moderate - experienced players will be frustrated for ~30 seconds

## Low Issues (Nice-to-Fix)

### L1: No welcome splash screen
- Players go from privacy consent directly to the main menu. A brief splash showing game title and art would set the tone
- No user impact - purely aesthetic

### L2: Store error dialog is unstyled
- Error messages use Godot's default `AcceptDialog` with no design token integration
- Low impact - errors are infrequent

### L3: Gem value proposition is unclear
- Store shows gem packs with prices but doesn't explain what gems buy or how far they go
- Recommendation: Add a "What can I buy?" hint or show a few example cosmetics with gem prices

### L4: No first-purchase incentive
- Only a 25-gem achievement reward for first purchase. The Founder's Bundle exists but isn't highlighted as a first-time offer
- Recommendation: Consider a prominent "Starter Offer" banner or tooltip on first store visit

## Flow Timeline (Estimated First-Time User)

```
0:00  App Launch
0:02  Privacy Consent Dialog
0:05  Beta Welcome Screen (if beta)
0:08  Main Menu appears
0:12  Player taps "Play"
0:15  Campaign Map loads
0:20  Player selects Stage 1_1
0:25  Tutorial begins: Movement
0:35  Tutorial step: Aiming
0:42  Tutorial step: Shooting
0:50  Tutorial step: Health (auto-advances)
0:53  Tutorial step: Victory condition
0:55  First combat begins
2:30  First wave cleared (estimated)
4:00  First stage completed (estimated)
4:15  Back to Campaign Map
```

**Estimated time to first gameplay: ~55 seconds** (target: <60s - marginal)

## Session Recording System

A built-in usability feedback collector was created at `scripts/usability_feedback_collector.gd` that:
- Captures timestamped events (scene changes, button presses, tutorial steps)
- Measures time-to-milestone (first combat, store visit, first purchase)
- Detects hesitation (pauses >3 seconds)
- Outputs JSON session files to `user://usability_sessions/`

Activate by creating `user://usability_config.json`:
```json
{"enabled": true}
```

## Next Steps

1. Update `store_menu.tscn` to add the `ConfirmDialog` and `SuccessPanel` nodes referenced in code
2. Schedule 5-8 usability sessions using the plan in `docs/USABILITY_SESSION_PLAN.md`
3. Run sessions with the feedback collector enabled
4. Analyze results and update this document with session findings
5. Prioritize M1-M3 fixes based on actual user behavior data
