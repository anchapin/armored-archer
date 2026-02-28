# Modular Sprite System for Gear

This document describes the modular sprite system implemented for Armored Archer.

## Overview

The modular sprite system provides:
- Separate sprite layers for each gear slot (Helm, Armor, Bow, Arrow)
- Base gear with RPG stats (attack, defense, speed, health)
- Cosmetic skins that overlay base gear purely for visual appearance
- Transmog system to combine base gear + skins
- Gear preview system

## Architecture

### Core Components

#### 1. GearSlot (Node2D)
- Represents a single gear slot with BaseSprite and SkinSprite
- Located at: `scenes/player/gear/gear_slot.tscn`

#### 2. ModularCharacterSprite (Node2D)
- Container for all gear slots
- Located at: `scenes/player/gear/modular_character_sprite.tscn`

#### 3. GearData & CosmeticSkinData (Resources)
- Gear data classes for base gear and cosmetic skins
- Located at: `scenes/player/gear/gear_data.gd` and `scenes/player/gear/cosmetic_skin_data.gd`

#### 4. GearRegistry (Singleton)
- Database of all available base gear and skins
- Located at: `autoloads/GearRegistry.gd`

#### 5. TransmogManager (Singleton)
- Manages current player loadout
- Located at: `autoloads/TransmogManager.gd`

## Usage

### Equipping Base Gear
```gdscript
TransmogManager.equip_base_gear("helm", "helm_dragon")
```

### Equipping Cosmetic Skins
```gdscript
TransmogManager.equip_skin("helm", "skin_helm_shadow")
```

### Getting Total Stats
```gdscript
var stats = TransmogManager.get_total_stats()
```

## Key Design Principles

1. **Stats from Base Gear Only**: Cosmetic skins never affect gameplay stats
2. **Skin Requirements**: Each skin can only be used with specific base gear
3. **Server-Authoritative**: All stat calculations happen server-side to prevent cheating
4. **Modular Design**: Each gear slot is independent

## File Structure

```
/
├── autoloads/
│   ├── GearRegistry.gd
│   └── TransmogManager.gd
├── assets/sprites/gear/
│   ├── base/
│   └── skins/
├── scenes/player/gear/
│   ├── gear_slot.*
│   ├── gear_data.gd
│   ├── cosmetic_skin_data.gd
│   └── modular_character_sprite.*
└── scenes/ui/gear_preview/
    └── gear_system_demo.*
```
