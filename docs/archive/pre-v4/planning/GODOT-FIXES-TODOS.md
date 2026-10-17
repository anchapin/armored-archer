# Godot Error Fixes - TODO List

**Created**: 2026-03-15
**Project**: Armored Archer Local Testing Setup
**Status**: ✅ **COMPLETE**

---

## Done

### P0 - Critical Fixes

1. ✅ **Fix boss_fire.gd delta parameter**
   - File: `scenes/enemies/bosses/boss_fire.gd`
   - Fixed: Lines 84-87 now use `_delta` parameter

2. ✅ **Fix boss_ice.gd delta parameter**
   - File: `scenes/enemies/bosses/boss_ice.gd`
   - Fixed: Lines 95-98 now use `_delta` parameter

3. ✅ **Fix MatchmakerManager.gd get() calls**
   - File: `autoloads/MatchmakerManager.gd`
   - Fixed: Lines 121, 241 - Now access `current_season.get("season_id", 0)`

4. ✅ **Fix GearRegistry.gd - Export GearSlot**
   - File: `autoloads/GearRegistry.gd`
   - Fixed: Added `GearEnums` import, replaced all `GearSlot.SlotType` with `GearEnums.GearType`

5. ✅ **Fix GemManager.gd - GearSlot access**
   - File: `autoloads/GemManager.gd`
   - Fixed: Added `GearEnums` import, updated `slot_type_mapping`

### P1 - Configuration

6. ✅ **Create .env file for local testing**
   - File: `.env` (root directory)
   - Created with default values for local development

### P2 - Verification

7. ✅ **Verify all autoloads load successfully**
   - Ran Godot headless test
   - All autoloads loading without errors

8. ✅ **Test game launch**
   - Godot project opens successfully
   - No parse errors
   - Login screen loads

---

## Pending

(none - all tasks complete!)
