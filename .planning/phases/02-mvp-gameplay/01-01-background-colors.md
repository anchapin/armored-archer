# Phase 1.1: Background & Environment Colors

**Priority**: P0 - Critical
**Estimated Effort**: 2-4 hours
**Status**: 📋 Pending

---

## Problem

The game world is currently a grey box with no visual distinction between background, ground, and game elements.

---

## Objectives

1. Replace grey background with colored environment
2. Add visual distinction between ground and sky (if applicable)
3. Ensure player and enemies are visible against background

---

## Tasks

### Task 1.1.1: Audit Current Background

**File**: `scenes/main.tscn` or relevant game scene

**Steps**:
1. Open main game scene in Godot
2. Identify background node (ColorRect, Sprite, or TileMap)
3. Note current color values
4. Screenshot for before/after comparison

**Expected Output**: Documentation of current background setup

---

### Task 1.1.2: Choose Color Palette

**Options**:

**Option A: Simple Gradient** (Recommended for MVP)
```
Sky: #87CEEB (sky blue)
Ground: #228B22 (forest green) or #8B4513 (brown dirt)
```

**Option B: Solid Color**
```
Background: #2E4053 (dark blue-grey)
Ground: #5D6D7E (medium grey-blue)
```

**Option C: Textured** (If time permits)
- Simple gradient texture
- Subtle noise pattern

**Decision Criteria**:
- Must provide contrast with player/enemies
- Easy to implement in Godot
- No performance impact

---

### Task 1.1.3: Implement Background Color

**Implementation**:

```gdscript
# If using ColorRect
@onready var background: ColorRect = $Background

func _ready() -> void:
    # Sky gradient (if using GradientTexture)
    var gradient = Gradient.new()
    gradient.colors = [Color("#87CEEB"), Color("#E0F6FF")]
    background.texture = GradientTexture.new()
    background.texture.gradient = gradient
    
    # OR simple solid color
    background.color = Color("#2E4053")
```

**Godot Editor Steps**:
1. Select background node
2. In Inspector, find Color property
3. Change from grey (#888888) to chosen color
4. Save scene

---

### Task 1.1.4: Add Ground Plane (Optional)

If the game has a ground element:

```gdscript
# Add ground as separate ColorRect or Sprite
@onready var ground: ColorRect = $Ground

func _ready() -> void:
    ground.color = Color("#228B22")  # Forest green
    ground.position.y = viewport_size.y * 0.6  # Bottom 40% of screen
```

---

### Task 1.1.5: Verify Visibility

**Test Checklist**:
- [ ] Player sprite is visible against background
- [ ] Enemy sprites are visible against background
- [ ] Arrows are visible when flying
- [ ] No visual confusion or camouflage

**Adjustment**: If visibility is poor, adjust background color darkness/saturation

---

## Success Criteria

- [ ] Background is no longer grey
- [ ] Player is clearly visible
- [ ] Enemies are clearly visible
- [ ] No performance degradation
- [ ] Looks intentional, not placeholder

---

## Files to Modify

| File | Changes |
|------|---------|
| `scenes/main.tscn` | Background node color/texture |
| `scenes/main.gd` | Optional: background color setup |
| `assets/` | Add gradient textures if used |

---

## Testing

1. **Launch game** in Godot (F5)
2. **Observe** first 5 seconds of gameplay
3. **Verify** all elements are visible
4. **Screenshot** for documentation

---

## Timebox

**Maximum Time**: 4 hours

If not complete in 4 hours:
- Use solid color instead of gradient
- Document issue and move to next task
- Return later if time permits

---

## Next Phase

After background is complete:
→ Move to **Phase 1.2: Player Sprite & Colors**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
