# Godot Error Fixes - Project Plan

**Project**: Armored Archer - Godot Error Cleanup
**Created**: 2026-03-15
**Goal**: Fix all Godot compilation errors and get the project ready for local testing

---

## Vision

Get the Armored Archer Godot project running without errors, enabling local development and testing.

---

## Current Issues Identified

### Critical Errors (Blocking)

1. **boss_fire.gd: Lines 84-87** - `delta` identifier not declared in `_physics_process`
2. **boss_ice.gd: Lines 95-98** - `delta` identifier not declared in `_physics_process`
3. **MatchmakerManager.gd: Lines 121, 241** - `get()` called with too many arguments
4. **GemManager.gd: Line 27** - Invalid access to `GearSlot` on GearRegistry

### Warnings (Non-blocking)

1. **NetworkManager.gd** - Missing environment variables (NAKAMA_SERVER_URL, PORT, KEY)
2. **LoginScreen.gd** - HTTP request issues (expected without backend)
3. **Tween warnings** - Empty tweens on login screen

---

## Success Criteria

- [ ] Godot project opens without script errors
- [ ] All autoloads load successfully
- [ ] Game can run locally (F5)
- [ ] No parse errors in output
- [ ] Login screen displays correctly

---

## Scope

### In Scope (v1)

- Fix all parse/compilation errors
- Fix autoload initialization issues
- Configure environment for local testing
- Verify game launches successfully

### Out of Scope (v2)

- Backend server setup (separate project)
- Full gameplay testing
- Performance optimization
- Additional features

---

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Fix `delta` parameter in boss_fire.gd | P0 |
| REQ-002 | Fix `delta` parameter in boss_ice.gd | P0 |
| REQ-003 | Fix `get()` calls in MatchmakerManager.gd | P0 |
| REQ-004 | Fix GearSlot access in GemManager.gd | P0 |
| REQ-005 | Create .env file for local testing | P1 |
| REQ-006 | Verify all autoloads load | P1 |
| REQ-007 | Test game launch | P1 |

---

## Technical Notes

### Issue 1: Boss Scripts - Missing `delta` parameter

**Problem**: Functions `update_timers(_delta: float)` are called with `delta` but the parameter is named `_delta`

**Files affected**:
- `scenes/enemies/bosses/boss_fire.gd` (lines 84-87)
- `scenes/enemies/bosses/boss_ice.gd` (lines 95-98)

**Fix**: Change function calls from `update_timers(delta)` to `update_timers(_delta)` OR rename parameter

### Issue 2: MatchmakerManager.gd - Dictionary.get() arguments

**Problem**: `dict.get(key, default)` is correct, but error suggests wrong usage

**Files affected**:
- `autoloads/MatchmakerManager.gd` (lines 121, 241)

**Fix**: Review and correct Dictionary.get() usage

### Issue 3: GemManager.gd - GearSlot access

**Problem**: Accessing `GearRegistry.GearSlot.SlotType.HELM` but GearSlot may not be accessible

**Files affected**:
- `autoloads/GemManager.gd` (line 27)
- `autoloads/GearRegistry.gd` (needs class_name or export)

**Fix**: Export GearSlot enum properly from GearRegistry

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| GearSlot enum not accessible | High | Add proper exports in GearRegistry |
| More errors discovered | Medium | Systematic verification after each fix |
| Backend dependency issues | Low | Mock/stub for local testing |

---

## Next Steps

1. Fix boss_fire.gd delta parameter
2. Fix boss_ice.gd delta parameter
3. Fix MatchmakerManager.gd get() calls
4. Fix GemManager.gd GearSlot access
5. Create .env file
6. Verify in Godot editor
7. Test game launch

---

**Status**: Ready for execution
