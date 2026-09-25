#!/usr/bin/env python3
"""
Pixel Art Generator for Armored Archer Game
Generates retro pixel art sprites with 16-color palettes
"""

import os

from PIL import Image

# Define 16-color palettes
PALETTES = {
    'player_archer': [
        (0, 0, 0),          # 0: Black (bg)
        (255, 200, 150),    # 1: Skin tone
        (139, 69, 19),      # 2: Brown (hair/bow)
        (34, 139, 34),      # 3: Green (clothes)
        (255, 255, 255),    # 4: White (highlights)
        (200, 150, 100),    # 5: Light brown
        (100, 100, 100),    # 6: Gray
        (255, 165, 0),      # 7: Orange (accents)
        (184, 134, 11),     # 8: Dark gold
        (139, 35, 35),      # 9: Dark red
        (220, 220, 220),    # 10: Light gray
        (169, 169, 169),    # 11: Dim gray
        (205, 92, 92),      # 12: Indian red
        (210, 180, 140),    # 13: Tan
        (160, 82, 45),      # 14: Sienna
        (255, 218, 185),    # 15: Peach
    ],
    'goblin': [
        (0, 0, 0),          # Black (bg)
        (34, 139, 34),      # Dark green
        (50, 180, 50),      # Green
        (100, 200, 80),     # Light green
        (255, 200, 100),    # Skin
        (200, 100, 50),     # Brown
        (100, 100, 100),    # Gray
        (255, 255, 100),    # Yellow
        (139, 69, 19),      # Dark brown
        (255, 165, 0),      # Orange
        (200, 200, 200),    # Light gray
        (255, 255, 255),    # White
        (255, 100, 100),    # Red
        (100, 150, 255),    # Blue
        (200, 150, 100),    # Tan
        (50, 100, 50),      # Dark green2
    ],
    'equipment_gold': [
        (0, 0, 0),          # Black (bg)
        (255, 215, 0),      # Gold
        (218, 165, 32),     # Goldenrod
        (184, 134, 11),     # Dark goldenrod
        (255, 245, 238),    # Floral white
        (255, 255, 255),    # White
        (200, 200, 150),    # Cream
        (150, 150, 100),    # Khaki
        (100, 100, 0),      # Olive
        (139, 69, 19),      # Saddle brown
        (160, 82, 45),      # Sienna
        (210, 180, 140),    # Tan
        (255, 228, 181),    # Bisque
        (240, 230, 200),    # Linen
        (220, 200, 100),    # Gold shade
        (180, 160, 80),     # Dark gold
    ],
    'ui': [
        (0, 0, 0),          # Black (bg)
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

class PixelArtGenerator:
    def __init__(self):
        self.generated_files = []
        self.failed_files = []

    def create_pixel_image(self, width: int, height: int, palette: list[tuple]) -> Image.Image:
        """Create a new pixel art image with transparent background.

        `palette` is accepted for API stability with previous callers; the
        per-pixel palette selection happens in `set_pixel` instead, so the
        image is initialized fully transparent here.
        """
        _ = palette  # accepted for caller compatibility; unused at this layer
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        return img

    def set_pixel(self, img: Image.Image, x: int, y: int, palette: list[tuple], color_idx: int):
        """Set a pixel to a specific color from palette"""
        if 0 <= x < img.width and 0 <= y < img.height and 0 <= color_idx < len(palette):
            color = palette[color_idx]
            img.putpixel((x, y), (*color, 255))  # Add alpha

    def draw_rectangle(self, img: Image.Image, x: int, y: int, w: int, h: int, palette: list[tuple], color_idx: int):
        """Draw a filled rectangle"""
        for py in range(max(0, y), min(img.height, y + h)):
            for px in range(max(0, x), min(img.width, x + w)):
                self.set_pixel(img, px, py, palette, color_idx)

    def draw_circle(self, img: Image.Image, cx: int, cy: int, r: int, palette: list[tuple], color_idx: int):
        """Draw a filled circle"""
        for y in range(max(0, cy - r), min(img.height, cy + r + 1)):
            for x in range(max(0, cx - r), min(img.width, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    self.set_pixel(img, x, y, palette, color_idx)

    def generate_player_idle(self, direction: str, frame: int) -> Image.Image:
        """Generate player idle animation frame"""
        img = self.create_pixel_image(32, 32, PALETTES['player_archer'])
        palette = PALETTES['player_archer']

        # Body
        self.draw_rectangle(img, 12, 8, 8, 12, palette, 3)  # Green tunic
        # Head
        self.draw_circle(img, 16, 6, 3, palette, 1)  # Skin
        # Legs
        self.draw_rectangle(img, 13, 20, 3, 7, palette, 2)  # Left leg
        self.draw_rectangle(img, 16, 20, 3, 7, palette, 2)  # Right leg
        # Bow
        self.draw_rectangle(img, 22, 10, 2, 10, palette, 2)  # Bow staff

        # Breathing animation sway (frame 0-5)
        int((frame / 6) * 2) - 1
        # Slight horizontal offset based on frame

        return img

    def generate_player_walk(self, direction: str, frame: int) -> Image.Image:
        """Generate player walk animation frame"""
        img = self.create_pixel_image(32, 32, PALETTES['player_archer'])
        palette = PALETTES['player_archer']

        # Body (slightly different each frame)
        self.draw_rectangle(img, 12, 8 + (frame % 2), 8, 12, palette, 3)
        # Head
        self.draw_circle(img, 16, 5, 3, palette, 1)
        # Legs - walking gait
        leg_offset = frame % 2
        self.draw_rectangle(img, 13, 20 + leg_offset, 3, 7, palette, 2)
        self.draw_rectangle(img, 16, 20 - leg_offset, 3, 7, palette, 2)
        # Bow
        self.draw_rectangle(img, 22, 10, 2, 10, palette, 2)

        return img

    def generate_player_attack(self, direction: str, frame: int) -> Image.Image:
        """Generate player attack/shoot animation (7 frames)"""
        img = self.create_pixel_image(32, 32, PALETTES['player_archer'])
        palette = PALETTES['player_archer']

        # Base body
        self.draw_rectangle(img, 12, 8, 8, 12, palette, 3)
        self.draw_circle(img, 16, 6, 3, palette, 1)

        # Bow draw progression (0-6 frames)
        draw_progress = frame / 6.0
        bow_x = 22 - int(draw_progress * 3)

        # Draw bow
        self.draw_rectangle(img, bow_x, 8, 2, 14, palette, 2)
        # Draw string (gets pulled back)
        string_x = bow_x + 2 + int(draw_progress * 3)
        self.draw_rectangle(img, string_x - 1, 9, 1, 12, palette, 7)

        # Legs
        self.draw_rectangle(img, 13, 20, 3, 7, palette, 2)
        self.draw_rectangle(img, 16, 20, 3, 7, palette, 2)

        return img

    def generate_enemy_idle(self, enemy_type: str, direction: str, frame: int) -> Image.Image:
        """Generate enemy idle animation"""
        palette = PALETTES.get(enemy_type, PALETTES['player_archer'])
        img = self.create_pixel_image(32, 32, palette)

        if enemy_type == 'goblin':
            # Green goblin body
            self.draw_rectangle(img, 12, 8, 8, 12, palette, 2)  # Body (dark green)
            self.draw_circle(img, 16, 6, 2, palette, 4)  # Head (skin)
            self.draw_rectangle(img, 13, 20, 3, 8, palette, 1)  # Legs
            self.draw_rectangle(img, 16, 20, 3, 8, palette, 1)
        else:
            # Generic enemy
            self.draw_rectangle(img, 12, 8, 8, 12, palette, 2)
            self.draw_circle(img, 16, 6, 3, palette, 4)

        return img

    def generate_ui_icon(self, icon_name: str) -> Image.Image:
        """Generate UI icon (32x32)"""
        img = self.create_pixel_image(32, 32, PALETTES['ui'])
        palette = PALETTES['ui']

        if icon_name == 'health':
            # Red heart
            self.draw_circle(img, 14, 12, 3, palette, 2)  # Left bump
            self.draw_circle(img, 18, 12, 3, palette, 2)  # Right bump
            self.draw_rectangle(img, 12, 14, 8, 8, palette, 2)  # Bottom triangle area
        elif icon_name == 'mana':
            # Blue orb
            self.draw_circle(img, 16, 16, 5, palette, 3)  # Blue circle
            self.set_pixel(img, 16, 14, palette, 1)  # Highlight
        elif icon_name == 'speed':
            # Yellow lightning
            self.draw_rectangle(img, 14, 8, 4, 6, palette, 4)  # Yellow bolt
            self.draw_rectangle(img, 12, 14, 4, 6, palette, 4)
        elif icon_name == 'strength':
            # Orange sword
            self.draw_rectangle(img, 15, 6, 2, 16, palette, 5)  # Blade
            self.draw_rectangle(img, 13, 20, 6, 3, palette, 5)  # Guard
        elif icon_name == 'inventory':
            # Brown bag
            self.draw_rectangle(img, 11, 10, 10, 12, palette, 11)  # Bag
            self.draw_rectangle(img, 12, 8, 8, 2, palette, 11)  # Top
        elif icon_name == 'equipment':
            # Chest
            self.draw_rectangle(img, 10, 12, 12, 12, palette, 10)  # Box
            self.draw_rectangle(img, 14, 16, 4, 8, palette, 2)  # Lock
        elif icon_name == 'map':
            # Brown scroll
            self.draw_rectangle(img, 8, 8, 16, 16, palette, 11)  # Scroll
            self.draw_rectangle(img, 10, 10, 12, 12, palette, 13)  # Interior
        elif icon_name == 'quest':
            # Golden star
            self.draw_circle(img, 16, 14, 4, palette, 1)  # Center
            for angle in range(8):
                x = 16 + int(5 * (angle % 2) * (1 if angle < 4 else -1))
                y = 14 + (5 * (1 if angle % 4 < 2 else -1))
                if 0 <= x < 32 and 0 <= y < 32:
                    self.set_pixel(img, x, y, palette, 1)
        elif icon_name == 'settings':
            # Gear
            self.draw_circle(img, 16, 16, 4, palette, 10)  # Center
            for i in range(8):
                angle = i * 45
                if i % 2 == 0:
                    x = 16 + int(6 * (i // 2 % 2))
                    y = 16 + (6 * (1 if i % 4 < 2 else -1))
                    self.draw_rectangle(img, x - 1, y - 1, 2, 2, palette, 10)
        elif icon_name == 'close':
            # Red X
            for i in range(6):
                self.set_pixel(img, 12 + i, 12 + i, palette, 2)
                self.set_pixel(img, 12 + i, 18 - i, palette, 2)

        return img

    def save_image(self, img: Image.Image, filepath: str) -> bool:
        """Save image to file"""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            img.save(filepath, 'PNG')
            self.generated_files.append(filepath)
            return True
        except Exception as e:
            self.failed_files.append((filepath, str(e)))
            return False

    def generate_all_player_sprites(self):
        """Generate all player animation frames"""
        directions = ['down', 'up', 'left', 'right']
        animations = {
            'idle': (6, self.generate_player_idle),
            'walk': (6, self.generate_player_walk),
            'attack': (7, self.generate_player_attack),
        }

        for anim_name, (frames, gen_func) in animations.items():
            for direction in directions:
                for frame in range(frames):
                    img = gen_func(direction, frame)
                    filepath = f'/home/alex/armored-archer/assets/sprites/player/{anim_name}_{direction}_{frame}.png'
                    self.save_image(img, filepath)

    def generate_all_enemy_sprites(self):
        """Generate enemy sprites"""
        enemy_types = ['goblin', 'skeleton', 'shadow_runner', 'brute']
        directions = ['down', 'up', 'left', 'right']

        for enemy_type in enemy_types:
            for direction in directions:
                for frame in range(4):  # Simple 4-frame idle
                    img = self.generate_enemy_idle(enemy_type, direction, frame)
                    filepath = f'/home/alex/armored-archer/assets/sprites/enemies/{enemy_type}_idle_{direction}_{frame}.png'
                    self.save_image(img, filepath)

    def generate_all_ui_icons(self):
        """Generate all UI icons"""
        icons = ['health', 'mana', 'speed', 'strength', 'inventory', 'equipment', 'map', 'quest', 'settings', 'close']

        for icon_name in icons:
            img = self.generate_ui_icon(icon_name)
            filepath = f'/home/alex/armored-archer/assets/sprites/ui/{icon_name}.png'
            self.save_image(img, filepath)

def main():
    print("🎨 Armored Archer Pixel Art Generator")
    print("=" * 50)

    generator = PixelArtGenerator()

    # Generate all sprites
    print("\n📦 Generating player sprites...")
    generator.generate_all_player_sprites()

    print("🌲 Generating enemy sprites...")
    generator.generate_all_enemy_sprites()

    print("🎯 Generating UI icons...")
    generator.generate_all_ui_icons()

    # Report results
    print("\n" + "=" * 50)
    print(f"✅ Generated: {len(generator.generated_files)} files")
    print(f"❌ Failed: {len(generator.failed_files)} files")

    if generator.failed_files:
        print("\nFailed files:")
        for filepath, error in generator.failed_files:
            print(f"  - {filepath}: {error}")

    print("\n📍 Sprite locations:")
    print("  - Player: assets/sprites/player/")
    print("  - Enemies: assets/sprites/enemies/")
    print("  - UI: assets/sprites/ui/")

if __name__ == '__main__':
    main()
