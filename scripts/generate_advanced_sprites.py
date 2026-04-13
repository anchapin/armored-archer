#!/usr/bin/env python3
"""
Advanced Pixel Art Generator for Armored Archer
Generates high-quality equipment and enhanced character sprites
"""

import os

from PIL import Image

# Enhanced 16-color palettes
PALETTES = {
    'player': [
        (0, 0, 0),          # Black (bg)
        (255, 200, 150),    # Skin
        (139, 69, 19),      # Brown (hair)
        (34, 139, 34),      # Green (tunic)
        (255, 255, 255),    # White (highlights)
        (200, 150, 100),    # Light brown
        (100, 100, 100),    # Gray
        (255, 165, 0),      # Orange
        (184, 134, 11),     # Gold
        (139, 35, 35),      # Dark red
        (220, 220, 220),    # Light gray
        (169, 169, 169),    # Dim gray
        (205, 92, 92),      # Red
        (210, 180, 140),    # Tan
        (160, 82, 45),      # Sienna
        (255, 218, 185),    # Peach
    ],
    'bow_wooden': [
        (0, 0, 0),          # Black
        (139, 69, 19),      # Dark brown
        (160, 82, 45),      # Sienna
        (205, 133, 63),     # Peru
        (210, 180, 140),    # Tan
        (188, 143, 143),    # Rosy brown
        (218, 165, 32),     # Goldenrod
        (184, 134, 11),     # Dark gold
        (255, 228, 181),    # Bisque
        (240, 230, 200),    # Linen
        (220, 200, 100),    # Sandy
        (192, 192, 192),    # Silver
        (255, 255, 255),    # White
        (169, 169, 169),    # Gray
        (128, 128, 128),    # Dark gray
        (100, 100, 100),    # Darker gray
    ],
    'bow_elven': [
        (0, 0, 0),          # Black
        (34, 139, 34),      # Dark green
        (50, 205, 50),      # Lime green
        (144, 238, 144),    # Light green
        (173, 255, 47),     # Green-yellow
        (255, 215, 0),      # Gold
        (218, 165, 32),     # Goldenrod
        (184, 134, 11),     # Dark gold
        (192, 192, 192),    # Silver
        (255, 255, 255),    # White
        (200, 255, 200),    # Very light green
        (100, 200, 100),    # Medium green
        (255, 228, 181),    # Bisque
        (169, 169, 169),    # Gray
        (128, 128, 128),    # Dark gray
        (85, 107, 47),      # Dark olive
    ],
    'bow_dragon': [
        (0, 0, 0),          # Black
        (255, 0, 0),        # Red
        (255, 165, 0),      # Orange
        (255, 215, 0),      # Gold
        (255, 255, 0),      # Yellow
        (192, 0, 0),        # Dark red
        (128, 128, 128),    # Gray
        (255, 192, 203),    # Pink
        (255, 218, 185),    # Peach
        (240, 128, 128),    # Light coral
        (205, 92, 92),      # Indian red
        (178, 34, 34),      # Fire brick
        (255, 255, 255),    # White
        (220, 20, 60),      # Crimson
        (100, 100, 100),    # Dark gray
        (50, 50, 50),       # Very dark gray
    ],
    'ui_icons': [
        (0, 0, 0),          # Black
        (255, 255, 255),    # White
        (255, 0, 0),        # Red
        (0, 0, 255),        # Blue
        (255, 255, 0),      # Yellow
        (255, 165, 0),      # Orange
        (0, 255, 0),        # Green
        (200, 0, 200),      # Magenta
        (0, 200, 200),      # Cyan
        (200, 200, 200),    # Light gray
        (100, 100, 100),    # Dark gray
        (139, 69, 19),      # Brown
        (255, 192, 203),    # Pink
        (128, 0, 128),      # Purple
        (165, 42, 42),      # Brown red
        (34, 139, 34),      # Forest green
    ],
}

class AdvancedSpriteGenerator:
    def __init__(self):
        self.generated = []
        self.failed = []

    def create_image(self, size=32):
        """Create transparent PNG"""
        return Image.new('RGBA', (size, size), (0, 0, 0, 0))

    def set_pixel(self, img, x, y, palette, color_idx):
        """Set pixel with palette color"""
        if 0 <= x < img.width and 0 <= y < img.height and 0 <= color_idx < len(palette):
            c = palette[color_idx]
            img.putpixel((x, y), c + (255,))

    def fill_rect(self, img, x, y, w, h, palette, color_idx):
        """Draw filled rectangle"""
        for py in range(max(0, y), min(img.height, y + h)):
            for px in range(max(0, x), min(img.width, x + w)):
                self.set_pixel(img, px, py, palette, color_idx)

    def fill_circle(self, img, cx, cy, r, palette, color_idx):
        """Draw filled circle"""
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx*dx + dy*dy <= r*r:
                    self.set_pixel(img, cx + dx, cy + dy, palette, color_idx)

    def generate_bow(self, bow_type, palette_name):
        """Generate 48x48 bow sprite"""
        img = self.create_image(48)
        palette = PALETTES[palette_name]

        if bow_type == 'wooden':
            # Bow limbs (curved)
            self.fill_rect(img, 22, 4, 4, 40, palette, 1)
            # Bowstring
            self.fill_rect(img, 24, 6, 1, 36, palette, 12)
            # Grip
            self.fill_circle(img, 24, 22, 3, palette, 2)

        elif bow_type == 'composite':
            # Layered bow
            self.fill_rect(img, 21, 4, 6, 40, palette, 1)
            self.fill_rect(img, 22, 5, 4, 38, palette, 2)
            # String
            self.fill_rect(img, 24, 6, 1, 36, palette, 8)
            # Grip accent
            self.fill_circle(img, 24, 22, 4, palette, 3)

        elif bow_type == 'elven':
            # Graceful elven bow
            for y in range(4, 44):
                offset = abs(20 - y) // 8
                self.set_pixel(img, 22 + offset, y, palette, 2)
                self.set_pixel(img, 26 - offset, y, palette, 2)
            # Glowing string
            self.fill_rect(img, 24, 6, 1, 36, palette, 4)

        elif bow_type == 'dragon':
            # Dragon-themed bow
            self.fill_rect(img, 20, 4, 8, 40, palette, 0)  # Red body
            self.fill_rect(img, 21, 5, 6, 38, palette, 4)  # Fire orange
            self.fill_circle(img, 24, 8, 3, palette, 4)  # Dragon head
            # String
            self.fill_rect(img, 24, 6, 1, 36, palette, 12)

        return img

    def generate_arrow(self, arrow_type):
        """Generate 32x32 arrow sprite"""
        img = self.create_image(32)
        palette = PALETTES['bow_wooden']

        arrow_colors = {
            'wooden': (2, 12),    # Brown shaft, black tip
            'iron': (11, 14),     # Gray shaft, dark gray tip
            'steel': (9, 15),     # Silver shaft, dark tip
            'silver': (12, 11),   # White shaft, gray tip
            'enchanted': (6, 4),  # Gold shaft, blue tip
        }

        shaft_c, tip_c = arrow_colors.get(arrow_type, (2, 12))

        # Arrow shaft
        self.fill_rect(img, 4, 14, 20, 4, palette, shaft_c)
        # Arrowhead
        for x in range(24, 29):
            self.set_pixel(img, x, 16, palette, tip_c)

        # Fletching
        self.fill_rect(img, 4, 10, 4, 2, palette, 4)
        self.fill_rect(img, 4, 18, 4, 2, palette, 4)

        return img

    def generate_armor(self, armor_type):
        """Generate 32x32 armor icon"""
        img = self.create_image(32)
        palette = PALETTES['bow_wooden']

        armor_colors = {
            'leather': (2, 5),     # Brown
            'chain': (11, 9),      # Gray, dark gray
            'plate': (9, 11),      # Dark gray, gray
            'dragon': (0, 4),      # Red, orange
        }

        main_c, accent_c = armor_colors.get(armor_type, (2, 5))

        # Chest plate
        self.fill_rect(img, 8, 6, 16, 14, palette, main_c)
        # Shoulder pieces
        self.fill_circle(img, 6, 10, 3, palette, main_c)
        self.fill_circle(img, 26, 10, 3, palette, main_c)
        # Detail lines
        self.fill_rect(img, 10, 12, 12, 2, palette, accent_c)

        return img

    def generate_helm(self, helm_type):
        """Generate 32x32 helmet icon"""
        img = self.create_image(32)
        palette = PALETTES['bow_wooden']

        helm_colors = {
            'leather': (2, 5),
            'chain': (11, 9),
            'plate': (9, 11),
            'dragon': (0, 4),
        }

        main_c, accent_c = helm_colors.get(helm_type, (2, 5))

        # Dome
        self.fill_circle(img, 16, 12, 7, palette, main_c)
        # Face guard
        self.fill_rect(img, 12, 16, 8, 4, palette, main_c)
        # Eyes
        self.set_pixel(img, 13, 17, palette, 4)
        self.set_pixel(img, 19, 17, palette, 4)

        return img

    def generate_amulet(self, amulet_type):
        """Generate 32x32 amulet sprite"""
        img = self.create_image(32)
        palette = PALETTES['ui_icons']

        amulet_colors = {
            'health': 2,      # Red
            'mana': 3,        # Blue
            'speed': 4,       # Yellow
            'strength': 5,    # Orange
        }

        color_idx = amulet_colors.get(amulet_type, 2)

        # Gem
        self.fill_circle(img, 16, 15, 6, palette, color_idx)
        # Glow
        self.fill_circle(img, 16, 15, 4, palette, 1)
        # Chain
        self.fill_rect(img, 15, 4, 2, 8, palette, 11)

        return img

    def save(self, img, path):
        """Save sprite"""
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            img.save(path, 'PNG')
            self.generated.append(path)
            return True
        except Exception as e:
            self.failed.append((path, str(e)))
            return False

    def generate_all_equipment(self):
        """Generate all equipment sprites"""
        # Bows (48x48)
        bow_palette_map = {
            'wooden': 'bow_wooden',
            'composite': 'bow_wooden',
            'elven': 'bow_elven',
            'dragon': 'bow_dragon',
        }
        for bow_type in ['wooden', 'composite', 'elven', 'dragon']:
            palette_name = bow_palette_map[bow_type]
            img = self.generate_bow(bow_type, palette_name)
            self.save(img, f'/home/alex/armored-archer/assets/sprites/equipment/bows/{bow_type}.png')

        # Arrows (32x32)
        for arrow_type in ['wooden', 'iron', 'steel', 'silver', 'enchanted']:
            img = self.generate_arrow(arrow_type)
            self.save(img, f'/home/alex/armored-archer/assets/sprites/equipment/arrows/{arrow_type}.png')

        # Armor (32x32)
        for armor_type in ['leather', 'chain', 'plate', 'dragon']:
            img = self.generate_armor(armor_type)
            self.save(img, f'/home/alex/armored-archer/assets/sprites/equipment/armor/{armor_type}.png')

        # Helms (32x32)
        for helm_type in ['leather', 'chain', 'plate', 'dragon']:
            img = self.generate_helm(helm_type)
            self.save(img, f'/home/alex/armored-archer/assets/sprites/equipment/helms/{helm_type}.png')

        # Amulets (32x32)
        for amulet_type in ['health', 'mana', 'speed', 'strength']:
            img = self.generate_amulet(amulet_type)
            self.save(img, f'/home/alex/armored-archer/assets/sprites/equipment/amulets/{amulet_type}.png')

def main():
    print("🎨 Advanced Equipment Sprite Generator")
    print("=" * 50)

    gen = AdvancedSpriteGenerator()

    print("\n🏹 Generating bows...")
    print("🏹 Generating arrows...")
    print("🛡️  Generating armor...")
    print("⚔️  Generating helms...")
    print("✨ Generating amulets...")

    gen.generate_all_equipment()

    print("\n" + "=" * 50)
    print(f"✅ Generated: {len(gen.generated)} equipment sprites")
    print(f"❌ Failed: {len(gen.failed)}")

    if gen.failed:
        for path, error in gen.failed:
            print(f"  {path}: {error}")

if __name__ == '__main__':
    main()
