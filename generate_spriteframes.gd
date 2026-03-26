# name, fps, loop
var animations = [
    ["idle_down", 8.0, true],
    ["idle_up", 8.0, true],
    ["idle_left", 8.0, true],
    ["idle_right", 8.0, true],
    ["walk_down", 12.0, true],
    ["walk_up", 12.0, true],
    ["walk_left", 12.0, true],
    ["walk_right", 12.0, true],
    ["attack_down", 10.0, false],
    ["attack_up", 10.0, false],
    ["attack_left", 10.0, false],
    ["attack_right", 10.0, false],
    ["bow_draw_down", 8.0, true],
    ["bow_draw_up", 8.0, true],
    ["bow_draw_left", 8.0, true],
    ["bow_draw_right", 8.0, true],
    ["hit_down", 10.0, false],
    ["hit_up", 10.0, false],
    ["hit_left", 10.0, false],
    ["hit_right", 10.0, false],
    ["death_down", 8.0, false],
    ["death_up", 8.0, false],
    ["death_left", 8.0, false],
    ["death_right", 8.0, false]
]

var sprite_frames = SpriteFrames.new()

for a in animations:
    var name = a[0]
    var fps = a[1]
    var loop = a[2]
    sprite_frames.add_animation(name)
    sprite_frames.set_animation_speed(name, fps)
    sprite_frames.set_animation_loop(name, loop)
    
    for i in range(6):
        var frame_path = "res://assets/sprites/player/" + name + "_" + str(i) + ".tres"
        var texture = load(frame_path)
        if texture:
            sprite_frames.add_frame(name, texture)
        else:
            push_warning("Could not load texture: " + frame_path)

var save_path = "res://assets/sprites/player/player_sprites.tres"
ResourceSaver.save(sprite_frames, save_path)
print("Saved SpriteFrames to " + save_path)
print("Created " + str(animations.size()) + " animations")

get_tree().quit()']]