# name, fps, loop
var sprite_frames = SpriteFrames.new()
var save_path = "res://assets/sprites/player/test.tres"
ResourceSaver.save(sprite_frames, save_path)
print("Saved test SpriteFrames to " + save_path)
get_tree().quit()']]