extends Control

## Settings screen — SFX/Music volume + mute controls (issue #911).
##
## Wires directly to the AudioManager autoload via /root/AudioManager. Every
## change is reflected immediately in the SFX/Music buses and persisted to
## user://audio_settings.cfg.

@onready var _sfx_slider: HSlider = $Layout/Content/SFXRow/VolumeSlider
@onready var _sfx_mute: CheckButton = $Layout/Content/SFXRow/MuteCheck
@onready var _sfx_value_label: Label = $Layout/Content/SFXRow/ValueLabel

@onready var _music_slider: HSlider = $Layout/Content/MusicRow/VolumeSlider
@onready var _music_mute: CheckButton = $Layout/Content/MusicRow/MuteCheck
@onready var _music_value_label: Label = $Layout/Content/MusicRow/ValueLabel

@onready var _back_button: Button = $Layout/Content/BackButton

const SFX_BUS: String = "SFX"
const MUSIC_BUS: String = "Music"

func _ready() -> void:
	# Initialize sliders with current bus values.
	var audio = get_node_or_null("/root/AudioManager")
	if audio == null:
		push_warning("[SettingsScreen] AudioManager autoload missing")
		return

	_sfx_slider.value = clampf(audio.get_bus_volume(SFX_BUS), 0.0, 1.0)
	_sfx_mute.button_pressed = audio.is_bus_muted(SFX_BUS)
	_refresh_sfx_label()

	_music_slider.value = clampf(audio.get_bus_volume(MUSIC_BUS), 0.0, 1.0)
	_music_mute.button_pressed = audio.is_bus_muted(MUSIC_BUS)
	_refresh_music_label()

	_sfx_slider.value_changed.connect(_on_sfx_volume_changed)
	_sfx_mute.toggled.connect(_on_sfx_mute_toggled)
	_music_slider.value_changed.connect(_on_music_volume_changed)
	_music_mute.toggled.connect(_on_music_mute_toggled)
	_back_button.pressed.connect(_on_back_pressed)

func _on_sfx_volume_changed(value: float) -> void:
	var audio = get_node_or_null("/root/AudioManager")
	if audio:
		audio.set_bus_volume(SFX_BUS, value)
	_refresh_sfx_label()

func _on_sfx_mute_toggled(pressed: bool) -> void:
	var audio = get_node_or_null("/root/AudioManager")
	if audio:
		audio.set_bus_mute(SFX_BUS, pressed)

func _on_music_volume_changed(value: float) -> void:
	var audio = get_node_or_null("/root/AudioManager")
	if audio:
		audio.set_bus_volume(MUSIC_BUS, value)
	_refresh_music_label()

func _on_music_mute_toggled(pressed: bool) -> void:
	var audio = get_node_or_null("/root/AudioManager")
	if audio:
		audio.set_bus_mute(MUSIC_BUS, pressed)

func _on_back_pressed() -> void:
	# Defer to caller — go back to wherever this was opened from.
	# Default: just free this scene.
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

func _refresh_sfx_label() -> void:
	_sfx_value_label.text = "%d%%" % int(round(_sfx_slider.value * 100.0))

func _refresh_music_label() -> void:
	_music_value_label.text = "%d%%" % int(round(_music_slider.value * 100.0))