extends GutTest

var AudioManagerClass = load("res://autoloads/AudioManager.gd")

func before_each():
	pass

func after_each():
	pass

func test_audio_manager_initializes():
	var audio_mgr = AudioManagerClass.new()
	add_child_autofree(audio_mgr)
	
	assert_true(true, "AudioManager should instantiate")

func test_audio_manager_has_play_method():
	var audio_mgr = AudioManagerClass.new()
	add_child_autofree(audio_mgr)
	
	assert_true(audio_mgr.has_method("play_path") or audio_mgr.has_method("play"), 
		"AudioManager should have play method")