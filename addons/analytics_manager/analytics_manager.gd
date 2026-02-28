extends Node

signal analytics_initialized
signal analytics_error(message: String)

var is_initialized: bool = false
var is_crashlytics_enabled: bool = true
var firebase_project_id: String = ""
var measurement_id: String = ""
var app_id: String = ""

var user_id: String = ""
var user_properties: Dictionary = {}

func _ready() -> void:
	if OS.has_feature("android") or OS.has_feature("ios"):
		_initialize_firebase()
	else:
		push_warning("AnalyticsManager: Firebase Analytics only works on Android/iOS platforms")

func _initialize_firebase() -> void:
	var config_path: String = ""
	if OS.has_feature("android"):
		config_path = "res://firebase_config/google-services.json"
	elif OS.has_feature("ios"):
		config_path = "res://firebase_config/GoogleService-Info.plist"
	
	if not FileAccess.file_exists(config_path):
		push_error("AnalyticsManager: Firebase config file not found at " + config_path)
		analytics_error.emit("Firebase config file not found")
		return
	
	_load_firebase_config(config_path)
	_setup_crashlytics()
	is_initialized = true
	analytics_initialized.emit()

func _load_firebase_config(config_path: String) -> void:
	var config_file: FileAccess = FileAccess.open(config_path, FileAccess.READ)
	if config_file:
		var config_content: String = config_file.get_as_text()
		config_file.close()
		
		if OS.has_feature("android"):
			_parse_android_config(config_content)
		elif OS.has_feature("ios"):
			_parse_ios_config(config_content)

func _parse_android_config(config_content: String) -> void:
	var json: JSON = JSON.new()
	var error: Error = json.parse(config_content)
	if error == OK:
		var config_data: Dictionary = json.data
		firebase_project_id = config_data.get("project_info", {}).get("project_number", "")
		measurement_id = config_data.get("project_info", {}).get("firebase_url", "")
		app_id = config_data.get("client", [{}])[0].get("client_info", {}).get("mobilesdk_app_id", "")
	else:
		push_error("AnalyticsManager: Failed to parse Firebase Android config")

func _parse_ios_config(config_content: String) -> void:
	var config_data: Dictionary = _parse_plist(config_content)
	firebase_project_id = config_data.get("PROJECT_ID", "")
	measurement_id = config_data.get("GCM_SENDER_ID", "")
	app_id = config_data.get("GOOGLE_APP_ID", "")

func _parse_plist(plist_content: String) -> Dictionary:
	var result: Dictionary = {}
	var lines: PackedStringArray = plist_content.split("\n")
	
	for line: String in lines:
		var key_regex: RegEx = RegEx.new()
		key_regex.compile("<key>(.*?)</key>")
		var string_regex: RegEx = RegEx.new()
		string_regex.compile("<string>(.*?)</string>")
		
		var key_match: RegExMatch = key_regex.search(line)
		var string_match: RegExMatch = string_regex.search(line)
		
		if key_match and string_match:
			result[key_match.get_string(1)] = string_match.get_string(1)
	
	return result

func _setup_crashlytics() -> void:
	if not is_crashlytics_enabled:
		return
	
	if OS.has_feature("android"):
		_setup_android_crashlytics()
	elif OS.has_feature("ios"):
		_setup_ios_crashlytics()

func _setup_android_crashlytics() -> void:
	pass

func _setup_ios_crashlytics() -> void:
	pass

func set_user_id(user_identifier: String) -> void:
	user_id = user_identifier
	_log_event("set_user_id", {"user_id": user_identifier})

func set_user_property(property_name: String, property_value: String) -> void:
	user_properties[property_name] = property_value
	_log_event("set_user_property", {
		"property_name": property_name,
		"property_value": property_value
	})

func log_stage_completed(stage_id: String, stage_name: String, time_taken_seconds: float, stars_earned: int, difficulty: String = "normal") -> void:
	if not is_initialized:
		return
	
	_log_event("stage_completed", {
		"stage_id": stage_id,
		"stage_name": stage_name,
		"time_taken_seconds": time_taken_seconds,
		"stars_earned": stars_earned,
		"difficulty": difficulty,
		"platform": OS.get_name()
	})

func log_stage_failed(stage_id: String, stage_name: String, time_taken_seconds: float, failure_reason: String, difficulty: String = "normal") -> void:
	if not is_initialized:
		return
	
	_log_event("stage_failed", {
		"stage_id": stage_id,
		"stage_name": stage_name,
		"time_taken_seconds": time_taken_seconds,
		"failure_reason": failure_reason,
		"difficulty": difficulty,
		"platform": OS.get_name()
	})

func log_pvp_match_started(match_id: String, opponent_id: String, season_id: int) -> void:
	if not is_initialized:
		return
	
	_log_event("pvp_match_started", {
		"match_id": match_id,
		"opponent_id": opponent_id,
		"season_id": season_id,
		"platform": OS.get_name()
	})

func log_pvp_match_completed(match_id: String, result: String, opponent_id: String, season_id: int, match_duration_seconds: float, score: int, opponent_score: int) -> void:
	if not is_initialized:
		return
	
	_log_event("pvp_match_completed", {
		"match_id": match_id,
		"result": result,
		"opponent_id": opponent_id,
		"season_id": season_id,
		"match_duration_seconds": match_duration_seconds,
		"score": score,
		"opponent_score": opponent_score,
		"platform": OS.get_name()
	})

func log_purchase(item_id: String, item_name: String, item_type: String, price_cents: int, currency: String = "USD") -> void:
	if not is_initialized:
		return
	
	_log_event("purchase", {
		"item_id": item_id,
		"item_name": item_name,
		"item_type": item_type,
		"price_cents": price_cents,
		"currency": currency,
		"platform": OS.get_name()
	})

func log_gem_purchased(gems_amount: int, price_cents: int, currency: String = "USD", purchase_type: String = "iap") -> void:
	if not is_initialized:
		return
	
	_log_event("gem_purchased", {
		"gems_amount": gems_amount,
		"price_cents": price_cents,
		"currency": currency,
		"purchase_type": purchase_type,
		"platform": OS.get_name()
	})

func log_cosmetic_purchased(cosmetic_id: String, cosmetic_name: String, cosmetic_type: String, rarity: String, price_cents: int, currency: String = "USD") -> void:
	if not is_initialized:
		return
	
	_log_event("cosmetic_purchased", {
		"cosmetic_id": cosmetic_id,
		"cosmetic_name": cosmetic_name,
		"cosmetic_type": cosmetic_type,
		"rarity": rarity,
		"price_cents": price_cents,
		"currency": currency,
		"platform": OS.get_name()
	})

func log_gear_obtained(gear_id: String, gear_name: String, gear_type: String, rarity: String, source: String) -> void:
	if not is_initialized:
		return
	
	_log_event("gear_obtained", {
		"gear_id": gear_id,
		"gear_name": gear_name,
		"gear_type": gear_type,
		"rarity": rarity,
		"source": source,
		"platform": OS.get_name()
	})

func log_custom_event(event_name: String, parameters: Dictionary) -> void:
	if not is_initialized:
		return
	
	_log_event(event_name, parameters)

func _log_event(event_name: String, parameters: Dictionary) -> void:
	if OS.has_feature("android"):
		_log_android_event(event_name, parameters)
	elif OS.has_feature("ios"):
		_log_ios_event(event_name, parameters)
	
	print("Analytics: Logged event '", event_name, "' with parameters: ", parameters)

func _log_android_event(event_name: String, parameters: Dictionary) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase.has_method("logEvent"):
			firebase.logEvent(event_name, parameters)

func _log_ios_event(event_name: String, parameters: Dictionary) -> void:
	if Engine.has_singleton("GodotFirebase"):
		var firebase: Object = Engine.get_singleton("GodotFirebase")
		if firebase.has_method("logEvent"):
			firebase.logEvent(event_name, parameters)

func record_custom_error(message: String, stack_trace: String = "") -> void:
	if not is_initialized or not is_crashlytics_enabled:
		return
	
	_log_crashlytics_error(message, stack_trace)
	print("Analytics: Recorded custom error: ", message)

func _log_crashlytics_error(message: String, stack_trace: String) -> void:
	if OS.has_feature("android"):
		_log_android_crashlytics_error(message, stack_trace)
	elif OS.has_feature("ios"):
		_log_ios_crashlytics_error(message, stack_trace)

func _log_android_crashlytics_error(message: String, stack_trace: String) -> void:
	pass

func _log_ios_crashlytics_error(message: String, stack_trace: String) -> void:
	pass

func set_crashlytics_collection_enabled(enabled: bool) -> void:
	is_crashlytics_enabled = enabled
	print("Analytics: Crashlytics collection ", "enabled" if enabled else "disabled")

func test_crash() -> void:
	push_error("AnalyticsManager: Test crash triggered!")
	if OS.has_feature("android") or OS.has_feature("ios"):
		var test_dict: Dictionary = {}
		test_dict["invalid_key"]
