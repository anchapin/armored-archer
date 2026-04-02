# Foley AI - Audio Asset Generation Setup

## Overview

Foley AI enables rapid audio asset generation for Armored Archer using natural language prompts, reducing dependency on external audio libraries and enabling cohesive sound design.

## Prerequisites

- Godot 4.6.1+ installed
- ElevenLabs API account (free tier available)
- Foley AI plugin installed from Godot Asset Library

## Installation

### 1. Get ElevenLabs API Key

1. Visit https://elevenlabs.io/
2. Sign up for free account
3. Navigate to API Keys section
4. Generate new API key
5. Save key securely (never commit to git)

### 2. Install Foley AI Plugin

**In Godot Editor:**

1. Open Asset Library (Ctrl+Shift+A)
2. Search: "Foley AI"
3. Download and install plugin
4. Restart Godot Editor

### 3. Configure Plugin

**Project Settings → Plugins → Foley AI:**

- **API Key**: Your ElevenLabs API key
- **Output Path**: `res://audio/foley_ai/`
- **Naming Convention**: `{category}_{action}_{intensity}.wav`

## Asset Organization

Foley AI automatically organizes generated assets:

```
res://audio/foley_ai/
├── combat/
│   ├── bow_fire_medium.wav
│   ├── arrow_impact_heavy.wav
│   ├── sword_swing_fast.wav
│   └── enemy_death_low.wav
├── ui/
│   ├── button_click_soft.wav
│   ├── toggle_on_medium.wav
│   ├── error_alert.wav
│   └── success_chime.wav
├── movement/
│   ├── footstep_concrete_light.wav
│   ├── footstep_grass_medium.wav
│   ├── run_heavy.wav
│   └── jump_effort.wav
└── ambient/
    ├── dungeon_ambience_low.wav
    ├── wind_outdoor_medium.wav
    └── water_drip_soft.wav
```

## Prompt Library for Armored Archer

### Combat Sounds

**Bow & Arrow:**
```
"bow string release with tension release echo, medium intensity, sharp metallic twang"
"arrow flying through air with faint whistle, short duration"
"arrow impact on metal armor, sharp clang, high frequency"
"arrow impact on flesh, dull thud, medium frequency"
```

**Melee Weapons:**
```
"sword swing through air, swoosh sound with slight edge resonance"
"sword impact on metal shield, loud clang, metallic reverberation"
"dagger stab through leather armor, tearing sound with slight squelch"
"axe chop into wooden door, heavy crunch with wood splintering"
```

**Enemy Effects:**
```
"goblin death, gurgle sound fading quickly"
"necromancer casting spell, magical whoosh with ethereal echo"
"boss roar, deep low frequency with metallic rumble"
"explosion with debris, blast sound with falling rubble tail"
```

### UI Feedback

**Buttons & Interactions:**
```
"button press with soft tactile click, very short"
"button release with subtle spring back, low volume"
"toggle switch on with satisfying click, medium crispness"
"toggle switch off with soft thud, low volume"
```

**Success & Error:**
```
"success chime, two-note ascending melody, pleasant tone"
"level up fanfare, short triumphant brass flourish"
"error buzz, low frequency dissonance, short duration"
"warning ping, high frequency tone, attention-grabbing"
```

### Movement & Environment

**Footsteps:**
```
"footstep on stone floor, sharp click with slight stone rattle, medium"
"footstep on wooden floorboard, dull thud with slight creak, medium"
"footstep on grass, soft rustle with earth crush, light"
"footstep in water, splash with droplet ripples, medium"
```

**Ambient:**
```
"dungeon ambience, low frequency with distant dripping and wind howl"
"forest ambience, birdsong with wind through leaves, peaceful"
"underground ambience, low rumble with water dripping, oppressive"
"battle aftermath, low wind with distant cries, somber"
```

### Special Effects

**Magic & Skills:**
```
"fireball cast, whoosh with crackling flame buildup"
"heal spell cast, soft chime with ethereal resonance"
"shield block, metallic clink with energy hum"
"teleport, vacuum whoosh with spatial reverb"
```

**VFX Complements:**
```
"screen shake, low rumble with quick fade"
"slow motion, whoosh with pitch shift downward"
"speed boost, whoosh with pitch shift upward"
"critical hit, sharp accent with slight echo"
```

## Audio Manager Integration

Update `AudioManager.gd` to use Foley-generated assets:

```gdscript
# Preload Foley-generated SFX
const SOUND_BOW_FIRE = preload("res://audio/foley_ai/combat/bow_fire_medium.wav")
const SOUND_ARROW_HIT = preload("res://audio/foley_ai/combat/arrow_impact_medium.wav")
const SOUND_BUTTON_CLICK = preload("res://audio/foley_ai/ui/button_click_soft.wav")
const SOUND_SUCCESS = preload("res://audio/foley_ai/ui/success_chime.wav")
const SOUND_ERROR = preload("res://audio/foley_ai/ui/error_alert.wav")

# Use with existing AudioStreamPlayer2D system
func play_bow_fire():
    var stream = SOUND_BOW_FIRE.instantiate()
    add_child(stream)
    stream.play()
```

## Prompting Best Practices

### Structure Your Prompts

```
[SOUND CATEGORY] + [ACTION/STATE] + [INTENSITY] + [QUALITY DESCRIPTORS]

Examples:
- "bow string release with tension echo, medium intensity, sharp metallic twang"
- "footstep on concrete, light intensity, crisp click"
- "explosion with debris, high intensity, deep bass with falling stones"
```

### Descriptive Keywords

**Timbre/Tone:**
- metallic, wooden, organic, digital, ethereal, gritty
- sharp, dull, crisp, soft, harsh, smooth
- warm, cold, bright, dark, muddy

**Intensity:**
- very low, low, medium, high, very high
- subtle, moderate, intense, extreme

**Duration:**
- instant, very short, short, medium, long, very long
- fading, sustained, decaying, looping

**Effects:**
- echo, reverb, delay, distortion, chorus
- wet, dry, gritty, polished, lo-fi
- whoosh, thud, clang, crunch, squelch

### Contextual Prompts

**For Mobile Games:**
```
"short button click, optimized for mobile, no heavy bass, crisp tactile feedback"
"light footstep, quick attack, suitable for rapid gameplay loop"
```

**For UI/Feedback:**
```
"short, non-intrusive notification sound, clear feedback"
"reward chime, satisfying and cheerful, builds positive association"
```

## Batch Generation Workflow

Generate related sounds in batches for consistency:

```python
# scripts/generate_foley_batch.py

import requests
import json

ELEVENLABS_KEY = "your-key-here"

SOUNDS = [
    ("bow_fire", "bow string release with echo, medium"),
    ("arrow_hit_metal", "arrow impact on armor, metallic clang"),
    ("arrow_hit_flesh", "arrow impact, dull thud"),
    ("goblin_death", "goblin death gurgle, quick fade"),
    ("button_click", "button press, soft click"),
    ("success_chime", "success two-note chime, pleasant"),
]

for name, prompt in SOUNDS:
    response = requests.post(
        "https://api.elevenlabs.io/v1/fg-sound-generation",
        headers={"xi-api-key": ELEVENLABS_KEY},
        json={"text": prompt, "duration_seconds": 1.0}
    )
    with open(f"res://audio/foley_ai/{name}.wav", "wb") as f:
        f.write(response.content)
    print(f"Generated: {name}")
```

## Quality Control

### Review Checklist

After generating audio assets:

- [ ] Volume levels are consistent across similar sounds
- [ ] No clipping or distortion
- [ ] Appropriate length for gameplay use
- [ ] Fits with other assets (cohesive style)
- [ ] Exported in correct format (16-bit WAV, 44.1kHz)
- [ ] File size reasonable for mobile (<500KB typically)

### Testing

Test sounds in context:

```gdscript
# test/foley_test.gd
extends Node

func _ready():
    # Test all combat sounds
    test_combat_sfx()
    await get_tree().create_timer(1.0).timeout

    # Test UI sounds
    test_ui_sfx()
    await get_tree().create_timer(1.0).timeout

    print("Foley audio test complete")

func test_combat_sfx():
    AudioManager.play("bow_fire_medium")
    await get_tree().create_timer(0.3).timeout
    AudioManager.play("arrow_impact_medium")
    # ...

func test_ui_sfx():
    AudioManager.play("button_click_soft")
    await get_tree().create_timer(0.2).timeout
    AudioManager.play("success_chime")
    # ...
```

## Troubleshooting

### API Rate Limits

**Issue:** Requests failing with 429 status

**Solution:**
1. Upgrade to paid ElevenLabs tier
2. Implement batch generation (fewer API calls)
3. Cache generated sounds

### Sound Quality Issues

**Issue:** Generated sounds don't match expectations

**Solutions:**
1. Be more specific in prompts
2. Include duration parameter (e.g., "0.5 seconds")
3. Add descriptive quality keywords
4. Generate multiple variations and select best

### File Not Found

**Issue:** Generated audio not appearing in Godot

**Solutions:**
1. Check output path in plugin settings
2. Import assets manually (drag from filesystem)
3. Reimport assets (right-click → Reimport)
4. Check file permissions

## Cost Management

ElevenLabs pricing (as of 2026):

| Tier | Monthly Characters | Cost |
|------|------------------|------|
| Free | 10,000 | $0 |
| Starter | 30,000 | $5 |
| Creator | 100,000 | $22 |

**Cost Estimate:**
- Average sound: ~100 characters
- 100 sounds ≈ 10,000 characters
- Free tier sufficient for initial asset library

**Optimization:**
- Generate variations in bulk
- Reuse prompts across projects
- Cache successfully generated sounds

## Integration with Existing Audio System

The project has `AudioManager.gd` autoload. Integrate Foley-generated sounds:

```gdscript
# In autoloads/AudioManager.gd

# Foley sound categories
enum SoundCategory {
    COMBAT,
    UI,
    MOVEMENT,
    AMBIENT
}

# Volume settings for Foley sounds
var foley_volumes := {
    SoundCategory.COMBAT: 0.8,
    SoundCategory.UI: 0.6,
    SoundCategory.MOVEMENT: 0.7,
    SoundCategory.AMBIENT: 0.5
}

# Play Foley sound with category-based volume
func play_foley(sound_path: String, category: SoundCategory) -> void:
    var volume = foley_volumes.get(category, 1.0)
    play_sound(sound_path, volume)

# Auto-volume based on game state
func adjust_volumes_for_state(state: GameManager.GameState) -> void:
    match state:
        GameState.COMBAT:
            foley_volumes[SoundCategory.COMBAT] = 1.0
            foley_volumes[SoundCategory.MOVEMENT] = 0.5
        GameState.UI_ONLY:
            foley_volumes[SoundCategory.COMBAT] = 0.0
            foley_volumes[SoundCategory.UI] = 1.0
```

## Resources

- **Foley AI Plugin**: https://godotengine.org/asset-library/asset?asset=123456
- **ElevenLabs Docs**: https://elevenlabs.io/docs/sound-effects
- **Audio Manager**: autoloads/AudioManager.gd
- **Project Audio Guide**: docs/AUDIO_GUIDE.md (if exists)
