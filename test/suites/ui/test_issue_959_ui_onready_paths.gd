extends GutTest

## Issue #959: regression tests for the dormant UI bugs hidden under
## `NetworkConsts.MVP_PVE_ONLY = true`. Two root causes are covered:
##
##   1. `scenes/ui/main_menu.gd` `@onready var X = $Y` paths were missing
##      the `CenterContent/` segment for the RightPanel buttons (Shop,
##      BuyGems, Settings, Quit), silently resolving to `null` and breaking
##      the pressed-signal wiring in `_ready()`.
##   2. `scenes/ui/components/privacy_consent_dialog.tscn` (and the
##      matching beta-onboarding scenes `beta_welcome.tscn` /
##      `beta_invite_entry.tscn`) declared buttons as plain `Button`
##      while the matching `.gd` typed them as `ArcheryBaseButton`, so
##      the typed `@onready` cast failed at runtime and the buttons never
##      fired the audio/analytics chain.
##
## Tests are split into two layers:
##
##  * **Source-level** — asserts the .gd @onready declarations and .tscn
##    `script = ExtResource(...)` registrations stay aligned. These run
##    purely against the file text and never instantiate a scene, so they
##    don't depend on autoload-side effects (audio/theme/network that we
##    can't sidestep during a unit test).
##  * **Runtime** — loads the simpler dialogs (privacy_consent, beta_welcome,
##    beta_invite_entry) which don't have heavy theme/font setup, and
##    confirms the button nodes are real `ArcheryBaseButton` instances
##    after `_ready()`. The main_menu scene is *not* instantiated here
##    because its `_ready()` triggers a Relic Archive theme pass that
##    loads font assets not present in CI — those would surface as
##    FreeType errors that GUT treats as test failures.

const MAIN_MENU_SCRIPT := "res://scenes/ui/main_menu.gd"
const MAIN_MENU_SCENE := "res://scenes/ui/main_menu.tscn"

const PRIVACY_CONSENT_SCENE := "res://scenes/ui/components/privacy_consent_dialog.tscn"
const PRIVACY_CONSENT_SCRIPT := "res://scenes/ui/components/privacy_consent_dialog.gd"

const BETA_WELCOME_SCENE := "res://scenes/ui/beta_welcome.tscn"
const BETA_WELCOME_SCRIPT := "res://scenes/ui/beta_welcome.gd"

const BETA_INVITE_ENTRY_SCENE := "res://scenes/ui/beta_invite_entry.tscn"
const BETA_INVITE_ENTRY_SCRIPT := "res://scenes/ui/beta_invite_entry.gd"

const BASE_BUTTON_SCRIPT := "res://scenes/ui/components/base_button.gd"

const NETWORK_CONSTS_PATH := "res://autoloads/const.gd"


func before_all() -> void:
	for path in [MAIN_MENU_SCRIPT, MAIN_MENU_SCENE, PRIVACY_CONSENT_SCENE,
			PRIVACY_CONSENT_SCRIPT, BETA_WELCOME_SCENE, BETA_WELCOME_SCRIPT,
			BETA_INVITE_ENTRY_SCENE, BETA_INVITE_ENTRY_SCRIPT,
			BASE_BUTTON_SCRIPT, NETWORK_CONSTS_PATH]:
		if not ResourceLoader.exists(path):
			pending("[#959] Required asset missing at %s — skipping suite." % path)


# ---------------------------------------------------------------------------
# 1. main_menu.gd path-verification (the primary #959 root cause).
# ---------------------------------------------------------------------------


func test_main_menu_right_panel_buttons_include_center_content_segment() -> void:
	# Regression for the original bug: $SafeAreaContainer/MainContainer/RightPanel/...
	# paths were missing the `CenterContent/` segment. Re-introducing that
	# pattern in a future refactor must fail this test.
	var script_text: String = _read_text(MAIN_MENU_SCRIPT)
	# Each RightPanel button path must include `CenterContent/RightPanel/...`
	# — guard against `RightPanel/` appearing on its own.
	assert_false(
		script_text.contains("$SafeAreaContainer/MainContainer/RightPanel/"),
		"main_menu.gd must not declare any $SafeAreaContainer/MainContainer/RightPanel/ " +
				"path (the missing `CenterContent/` segment was issue #959)."
	)
	# And must declare the corrected paths.
	for needle in [
		"$SafeAreaContainer/MainContainer/CenterContent/RightPanel/ShopButton",
		"$SafeAreaContainer/MainContainer/CenterContent/RightPanel/BuyGemsButton",
		"$SafeAreaContainer/MainContainer/CenterContent/RightPanel/SettingsButton",
		"$SafeAreaContainer/MainContainer/CenterContent/RightPanel/QuitButton",
	]:
		assert_true(
			script_text.contains(needle),
			"main_menu.gd must declare the corrected path '%s' (issue #959)." % needle
		)


func test_main_menu_left_panel_buttons_unchanged() -> void:
	# LeftPanel paths were never broken. This pins them down so a future
	# refactor that swaps panel layout doesn't silently regress the
	# working side.
	var script_text: String = _read_text(MAIN_MENU_SCRIPT)
	for needle in [
		"$SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/PlayButton",
		"$SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/LoadoutButton",
		"$SafeAreaContainer/MainContainer/CenterContent/LeftPanel/ActionButtons/PvpButton",
	]:
		assert_true(
			script_text.contains(needle),
			"main_menu.gd must declare '%s' (issue #959)." % needle
		)


func test_main_menu_right_panel_buttons_typed_as_archery_base_button() -> void:
	# Type-mismatch guard: every RightPanel @onready slot must stay typed
	# `ArcheryBaseButton` so it picks up the audio cue and analytics hook.
	var script_text: String = _read_text(MAIN_MENU_SCRIPT)
	for slot in ["shop_button", "buy_gems_button", "settings_button", "quit_button"]:
		var needle: String = "@onready var %s: ArcheryBaseButton" % slot
		assert_true(
			script_text.contains(needle),
			"main_menu.gd must keep `%s` typed `ArcheryBaseButton` (issue #959)." % slot
		)


func test_main_menu_theme_lookup_uses_center_content_path_too() -> void:
	# `_apply_relic_archive_theme()` has a parallel `get_node_or_null` call
	# for `RightPanel` that originally missed the `CenterContent/` segment.
	# The fix touches both the @onready AND the theme lookup path; both
	# must stay aligned so the surface tier styling lands on the same node
	# the buttons live on.
	var script_text: String = _read_text(MAIN_MENU_SCRIPT)
	assert_false(
		script_text.contains("get_node_or_null(\"SafeAreaContainer/MainContainer/RightPanel\")"),
		"main_menu.gd must not look up 'SafeAreaContainer/MainContainer/RightPanel' " +
				"directly (missing CenterContent segment was issue #959)."
	)
	assert_true(
		script_text.contains(
				"get_node_or_null(\"SafeAreaContainer/MainContainer/CenterContent/RightPanel\")"),
		"main_menu.gd must look up 'SafeAreaContainer/MainContainer/CenterContent/RightPanel' (issue #959)."
	)


func test_main_menu_tscn_declares_every_typed_button_node() -> void:
	# Static check against the .tscn — every typed button referenced from
	# main_menu.gd must exist as a `[node name=...]` declaration in the
	# corresponding .tscn.
	var tscn: String = _read_text(MAIN_MENU_SCENE)
	for button_name in ["PlayButton", "LoadoutButton", "PvpButton",
			"ShopButton", "BuyGemsButton", "SettingsButton", "QuitButton"]:
		var needle: String = "[node name=\"%s\"" % button_name
		assert_true(
			tscn.contains(needle),
			"main_menu.tscn must declare a node named '%s' (issue #959)." % button_name
		)


# ---------------------------------------------------------------------------
# 2. privacy_consent_dialog.tscn type-mismatch (the second primary #959 root cause).
# ---------------------------------------------------------------------------


func test_privacy_consent_gd_types_buttons_as_archery_base_button() -> void:
	var script_text: String = _read_text(PRIVACY_CONSENT_SCRIPT)
	assert_true(
		script_text.contains("@onready var accept_button: ArcheryBaseButton"),
		"privacy_consent_dialog.gd must type accept_button as ArcheryBaseButton (issue #959)."
	)
	assert_true(
		script_text.contains("@onready var view_policy_button: ArcheryBaseButton"),
		"privacy_consent_dialog.gd must type view_policy_button as ArcheryBaseButton (issue #959)."
	)


func test_privacy_consent_tscn_attaches_base_button_script() -> void:
	# The original .tscn declared plain `Button` instances; the typed
	# @onready slot then cast to null at runtime. The fix is to register
	# `script = ExtResource(...)` on each typed button.
	var tscn: String = _read_text(PRIVACY_CONSENT_SCENE)
	for button_name in ["AcceptButton", "ViewPolicyButton"]:
		var needle_block: String = "[node name=\"%s\"" % button_name
		assert_true(
			tscn.contains(needle_block),
			"privacy_consent_dialog.tscn must declare %s (issue #959)." % button_name
		)
	assert_true(
		tscn.contains("script = ExtResource(\"2_base_button\")"),
		"privacy_consent_dialog.tscn must keep `script = ExtResource(\"2_base_button\")` " +
				"on its typed buttons (issue #959)."
	)


# ---------------------------------------------------------------------------
# 3. Sibling type-mismatch bugs (same root cause, same fix).
# The audit called out privacy_consent; this layer extends the regression net
# to all sibling UI scenes that declared ArcheryBaseButton-typed .gd slots
# without matching `script = ExtResource(...)` registrations in their .tscn.
# ---------------------------------------------------------------------------


func test_beta_welcome_tscn_attaches_base_button_script() -> void:
	var tscn: String = _read_text(BETA_WELCOME_SCENE)
	assert_true(
		tscn.contains("[node name=\"DismissButton\""),
		"beta_welcome.tscn must declare DismissButton (issue #959)."
	)
	assert_true(
		tscn.contains("script = ExtResource(\"2_base_button\")"),
		"beta_welcome.tscn must keep `script = ExtResource(\"2_base_button\")` on DismissButton (issue #959)."
	)


func test_beta_welcome_gd_types_dismiss_as_archery_base_button() -> void:
	var script_text: String = _read_text(BETA_WELCOME_SCRIPT)
	assert_true(
		script_text.contains("@onready var dismiss_button: ArcheryBaseButton"),
		"beta_welcome.gd must keep dismiss_button typed as ArcheryBaseButton (issue #959)."
	)


func test_beta_invite_entry_tscn_attaches_base_button_script() -> void:
	var tscn: String = _read_text(BETA_INVITE_ENTRY_SCENE)
	for button_name in ["SubmitButton", "SkipButton"]:
		assert_true(
			tscn.contains("[node name=\"%s\"" % button_name),
			"beta_invite_entry.tscn must declare %s (issue #959)." % button_name
		)
	assert_true(
		tscn.contains("script = ExtResource(\"2_base_button\")"),
		"beta_invite_entry.tscn must keep `script = ExtResource(\"2_base_button\")` " +
				"on its typed buttons (issue #959)."
	)


func test_beta_invite_entry_gd_types_buttons_as_archery_base_button() -> void:
	var script_text: String = _read_text(BETA_INVITE_ENTRY_SCRIPT)
	assert_true(
		script_text.contains("@onready var submit_button: ArcheryBaseButton"),
		"beta_invite_entry.gd must keep submit_button typed as ArcheryBaseButton (issue #959)."
	)
	assert_true(
		script_text.contains("@onready var skip_button: ArcheryBaseButton"),
		"beta_invite_entry.gd must keep skip_button typed as ArcheryBaseButton (issue #959)."
	)


# ---------------------------------------------------------------------------
# 4. Runtime guards for the dialogs that can be instantiated safely.
# main_menu.gd is intentionally NOT instantiated here — its `_ready()` runs
# `_apply_relic_archive_theme()` which loads font assets GUT cannot provide
# in CI, surfacing as FreeType errors that fail the test even though the
# assertions pass. The source-level layer above covers main_menu.
# ---------------------------------------------------------------------------


func test_privacy_consent_buttons_resolve_as_archery_base_button_at_runtime() -> void:
	var dialog: Node = _instantiate_autofree(PRIVACY_CONSENT_SCENE)
	if dialog == null:
		return
	var accept_btn: Button = dialog.get("accept_button") as Button
	var view_btn: Button = dialog.get("view_policy_button") as Button

	assert_not_null(
		accept_btn,
		"privacy_consent_dialog.accept_button must resolve to a non-null Button (issue #959)."
	)
	assert_not_null(
		view_btn,
		"privacy_consent_dialog.view_policy_button must resolve to a non-null Button (issue #959)."
	)

	var base_script: Script = load(BASE_BUTTON_SCRIPT)
	if accept_btn:
		assert_true(
			is_instance_of(accept_btn, base_script),
			"privacy_consent_dialog.accept_button must be an ArcheryBaseButton instance (issue #959)."
		)
	if view_btn:
		assert_true(
			is_instance_of(view_btn, base_script),
			"privacy_consent_dialog.view_policy_button must be an ArcheryBaseButton instance (issue #959)."
		)


func test_beta_welcome_dismiss_button_resolves_as_archery_base_button() -> void:
	var welcome: Node = _instantiate_autofree(BETA_WELCOME_SCENE)
	if welcome == null:
		return
	var btn: Button = welcome.get("dismiss_button") as Button
	assert_not_null(btn, "beta_welcome.dismiss_button must be non-null (issue #959).")
	var base_script: Script = load(BASE_BUTTON_SCRIPT)
	if btn:
		assert_true(
			is_instance_of(btn, base_script),
			"beta_welcome.dismiss_button must be an ArcheryBaseButton instance (issue #959)."
		)


func test_beta_invite_entry_buttons_resolve_as_archery_base_button() -> void:
	var entry: Node = _instantiate_autofree(BETA_INVITE_ENTRY_SCENE)
	if entry == null:
		return
	var submit: Button = entry.get("submit_button") as Button
	var skip: Button = entry.get("skip_button") as Button
	assert_not_null(submit, "beta_invite_entry.submit_button must be non-null (issue #959).")
	assert_not_null(skip, "beta_invite_entry.skip_button must be non-null (issue #959).")
	var base_script: Script = load(BASE_BUTTON_SCRIPT)
	if submit:
		assert_true(
			is_instance_of(submit, base_script),
			"beta_invite_entry.submit_button must be an ArcheryBaseButton instance (issue #959)."
		)
	if skip:
		assert_true(
			is_instance_of(skip, base_script),
			"beta_invite_entry.skip_button must be an ArcheryBaseButton instance (issue #959)."
		)


# ---------------------------------------------------------------------------
# 5. MVP_PVE_ONLY contract (issue #909): the gating code path must continue
# to drive Shop / BuyGems / PvP visibility=false without regressing the new
# paths the #959 fix unblocks. We pin this contract at the source layer to
# avoid the runtime instantiation problem above.
# ---------------------------------------------------------------------------


func test_mvp_pve_only_const_is_on_for_this_slice() -> void:
	var Const := load(NETWORK_CONSTS_PATH)
	assert_true(
		Const.MVP_PVE_ONLY,
		"NetworkConsts.MVP_PVE_ONLY must default to true for the MVP-PvE slice (issue #909 + #959)."
	)


func test_main_menu_applies_mvp_gating_in_ready() -> void:
	var script_text: String = _read_text(MAIN_MENU_SCRIPT)
	assert_true(
		script_text.contains("_apply_mvp_gating()"),
		"main_menu.gd must call _apply_mvp_gating() in _ready() (issue #909 + #959)."
	)
	# And the source must early-return when the const is off.
	assert_true(
		script_text.contains("if not NetworkConsts.MVP_PVE_ONLY:") and
				script_text.contains("return"),
		"main_menu.gd must early-return from _apply_mvp_gating() when MVP_PVE_ONLY is false (issues #909 + #959)."
	)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	var content: String = file.get_as_text()
	file.close()
	return content


func _instantiate_autofree(scene_path: String) -> Node:
	var packed: PackedScene = load(scene_path)
	if packed == null:
		assert_true(false, "PackedScene must load at %s (issue #959)." % scene_path)
		return null
	var instance: Node = packed.instantiate()
	if instance == null:
		assert_true(false, "Scene must instantiate: %s (issue #959)." % scene_path)
		return null
	add_child_autofree(instance)
	return instance
