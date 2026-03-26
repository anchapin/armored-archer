#!/usr/bin/env python3
"""Generate equipment and UI placeholder sprite resources for Godot."""

import os
import sys

# Get project root (parent of .planning directory)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))

# Base path for sprites
BASE_PATH = os.path.join(project_root, "assets", "sprites")

# Equipment types and their sprites
EQUIPMENT = {
    "bow": {
        "size": (48, 48),
        "sprites": {
            "wooden_bow": {"rarity": "common", "color": "#8B4513"},      # Brown
            "composite_bow": {"rarity": "rare", "color": "#B22222"},     # Brown with red
            "elven_bow": {"rarity": "epic", "color": "#228B22"},         # Green with gold accent
            "dragon_bow": {"rarity": "legendary", "color": "#FF4500"},   # Red with orange
        }
    },
    "arrow": {
        "size": (32, 32),
        "sprites": {
            "wooden_arrow": {"rarity": "common", "color": "#DEB887"},    # Wood brown
            "iron_arrow": {"rarity": "common", "color": "#708090"},      # Gray
            "steel_arrow": {"rarity": "rare", "color": "#C0C0C0"},       # Silver
            "silver_arrow": {"rarity": "rare", "color": "#E8E8E8"},       # Silver with blue
            "enchanted_arrow": {"rarity": "epic", "color": "#9400D3"},   # Purple glow
        }
    },
    "armor": {
        "size": (48, 48),
        "sprites": {
            "leather_armor": {"rarity": "common", "color": "#8B4513"},   # Brown
            "chain_armor": {"rarity": "rare", "color": "#A9A9A9"},        # Silver/gray
            "plate_armor": {"rarity": "epic", "color": "#4682B4"},        # Silver with blue
            "dragon_armor": {"rarity": "legendary", "color": "#FFD700"}, # Red with gold
        }
    },
    "helm": {
        "size": (32, 32),
        "sprites": {
            "leather_helm": {"rarity": "common", "color": "#8B4513"},     # Brown
            "chain_helm": {"rarity": "rare", "color": "#A9A9A9"},         # Silver/gray
            "plate_helm": {"rarity": "epic", "color": "#4682B4"},         # Silver with blue
            "dragon_helm": {"rarity": "legendary", "color": "#FFD700"},   # Red with gold
        }
    },
    "amulet": {
        "size": (32, 32),
        "sprites": {
            "health_amulet": {"rarity": "common", "color": "#FF0000"},    # Red
            "mana_amulet": {"rarity": "common", "color": "#0000FF"},      # Blue
            "speed_amulet": {"rarity": "rare", "color": "#FFD700"},       # Yellow
            "strength_amulet": {"rarity": "epic", "color": "#FF4500"},    # Red/orange
        }
    },
}

# UI Icons
UI_ICONS = {
    "size": (32, 32),
    "icons": {
        "health_icon": {"color": "#FF0000"},     # Red heart
        "mana_icon": {"color": "#4169E1"},       # Blue orb
        "speed_icon": {"color": "#FFD700"},       # Yellow lightning
        "strength_icon": {"color": "#FF4500"},   # Red fist
        "inventory_icon": {"color": "#8B4513"},  # Brown bag
        "equipment_icon": {"color": "#C0C0C0"},  # Armor symbol
        "quest_icon": {"color": "#DAA520"},       # Scroll
        "map_icon": {"color": "#228B22"},         # Map symbol
        "settings_icon": {"color": "#696969"},   # Gear
        "close_icon": {"color": "#FF6347"},       # X mark
    }
}

def generate_tres_content(width: int, height: int, color: str) -> str:
    """Generate Godot .tres file content for a placeholder texture."""
    return f'''[gd_resource type="PlaceholderTexture2D" load_steps=2 format=3]

[ext_resource type="PlaceholderTexture2D" id="1"]

[resource]
size = Vector2({width}, {height})
'''

def create_sprites():
    """Create all equipment and UI sprite placeholder files."""
    total_created = 0
    
    # Create equipment sprites
    for equip_type, data in EQUIPMENT.items():
        dir_path = os.path.join(BASE_PATH, "equipment", equip_type)
        width, height = data["size"]
        
        for sprite_name, sprite_data in data["sprites"].items():
            file_path = os.path.join(dir_path, f"{sprite_name}.tres")
            content = generate_tres_content(width, height, sprite_data["color"])
            
            with open(file_path, "w") as f:
                f.write(content)
            total_created += 1
            print(f"Created: {file_path}")
    
    # Create UI icons
    ui_dir = os.path.join(BASE_PATH, "ui")
    width, height = UI_ICONS["size"]
    
    for icon_name, icon_data in UI_ICONS["icons"].items():
        file_path = os.path.join(ui_dir, f"{icon_name}.tres")
        content = generate_tres_content(width, height, icon_data["color"])
        
        with open(file_path, "w") as f:
            f.write(content)
        total_created += 1
        print(f"Created: {file_path}")
    
    print(f"\nTotal sprites created: {total_created}")

if __name__ == "__main__":
    create_sprites()