extends GutTest

## Issue #909: MVP_PVE_ONLY build const.
##
## With `NetworkConsts.MVP_PVE_ONLY == true`, main_menu.gd must collapse the
## PvP, Shop, and BuyGems buttons so the MVP-PvE slice is exposed. Play /
## Loadout / Settings / Quit must stay visible. Flipping the const back to
## false must restore visibility.
##
## These tests bypass main_menu.gd's full _ready() (which triggers unrelated
## pre-existing privacy-consent / theme-animation paths) and exercise the
## gating function directly with all six button slots wired up, mirroring
## the @onready assignments the scene provides.

const MAIN_MENU_SCRIPT_PATH := "res://scenes/ui/main_menu.gd"
const NETWORK_CONSTS_PATH := "res://autoloads/const.gd"
const ARCHERY_BUTTON_PATH := "res://scenes/ui/components/base_button.gd"


func _make_menu_with_buttons() -> Array:
	## Returns [menu Control, dict_of_buttons]. Mirrors the @onready slot
	## assignment without entering the tree, so we can drive the gating
	## function deterministically. Uses ArcheryBaseButton instances to
	## satisfy the typed property slots in main_menu.gd (plain Button would
	## type-mismatch on assignment under @onready static typing).
	var ArcheryButton := load(ARCHERY_BUTTON_PATH)
	var menu: Control = load(MAIN_MENU_SCRIPT_PATH).new()

	# Auto-free queue the menu so each test cleans up its own tree.
	autofree(menu)

	var buttons := {
		"play": ArcheryButton.new(),
		"loadout": ArcheryButton.new(),
		"pvp": ArcheryButton.new(),
		"shop": ArcheryButton.new(),
		"buy_gems": ArcheryButton.new(),
		"settings": ArcheryButton.new(),
		"quit": ArcheryButton.new(),
	}
	for key in buttons.keys():
		var btn: Button = buttons[key]
		btn.name = key.capitalize()
		autofree(btn)

	# Map every slot main_menu._ready() expects. Use the same property
	# names as the @onready vars in main_menu.gd.
	menu.set("play_button", buttons["play"])
	menu.set("loadout_button", buttons["loadout"])
	menu.set("pvp_button", buttons["pvp"])
	menu.set("shop_button", buttons["shop"])
	menu.set("buy_gems_button", buttons["buy_gems"])
	menu.set("settings_button", buttons["settings"])
	menu.set("quit_button", buttons["quit"])

	return [menu, buttons]


func before_all():
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		pending("Main menu script not found at %s — skipping issue #909 suite." % MAIN_MENU_SCRIPT_PATH)
	if not ResourceLoader.exists(NETWORK_CONSTS_PATH):
		pending("autoloads/const.gd not found at %s — skipping issue #909 suite." % NETWORK_CONSTS_PATH)


# --- Source-level guards -----------------------------------------------------

func test_const_file_declares_mvp_pve_only() -> void:
	## Source-level: autoloads/const.gd MUST define the MVP_PVE_ONLY
	## constant under an explicit "MVP gating (issue #909)" section so the
	## build flag is greppable and visible in code review.
	var file := FileAccess.open(NETWORK_CONSTS_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % NETWORK_CONSTS_PATH)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()

	assert_true(
		text.contains("MVP_PVE_ONLY"),
		"autoloads/const.gd must declare MVP_PVE_ONLY (issue #909)."
	)
	assert_true(
		text.contains("MVP gating") and text.contains("issue #909"),
		"autoloads/const.gd must place MVP_PVE_ONLY under an 'MVP gating (issue #909)' section header."
	)


func test_main_menu_preloads_const_and_calls_gating() -> void:
	## main_menu.gd must preload autoloads/const.gd as NetworkConsts and
	## invoke an MVP gating function in _ready() so the build flag actually
	## affects runtime behavior.
	var file := FileAccess.open(MAIN_MENU_SCRIPT_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % MAIN_MENU_SCRIPT_PATH)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()

	assert_true(
		text.contains("preload(\"res://autoloads/const.gd\")"),
		"main_menu.gd must preload autoloads/const.gd so it can read MVP_PVE_ONLY (issue #909)."
	)
	assert_true(
		text.contains("MVP_PVE_ONLY"),
		"main_menu.gd must reference NetworkConsts.MVP_PVE_ONLY (issue #909)."
	)
	assert_true(
		text.contains("_apply_mvp_gating") and text.contains("_apply_mvp_gating()"),
		"main_menu.gd must define and invoke _apply_mvp_gating() in _ready() (issue #909)."
	)


# --- Runtime behavior -------------------------------------------------------

func test_const_value_is_true_for_mvp_pve_slice() -> void:
	## The MVP gate MUST be on by default — the open issue 909 ships the
	## MVP-PvE slice and pinning the flag to true is the acceptance signal.
	var Const = load(NETWORK_CONSTS_PATH)
	assert_true(
		Const.MVP_PVE_ONLY,
		"NetworkConsts.MVP_PVE_ONLY must default to true for the MVP-PvE slice (issue #909)."
	)


func test_deferred_buttons_hidden_when_const_true() -> void:
	## With MVP_PVE_ONLY = true, _apply_mvp_gating() must hide PvP, Shop,
	## and BuyGems while leaving Play / Loadout / Settings / Quit visible.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	if not ResourceLoader.exists(NETWORK_CONSTS_PATH):
		return
	var Const = load(NETWORK_CONSTS_PATH)
	if not Const.MVP_PVE_ONLY:
		pending("MVP_PVE_ONLY is false in this build — deferred-hiding test skipped (issue #909).")
		return

	var pair: Array = _make_menu_with_buttons()
	var menu: Control = pair[0]
	var buttons: Dictionary = pair[1]

	menu._apply_mvp_gating()

	assert_false(buttons["pvp"].visible, "PvP button must be hidden when MVP_PVE_ONLY is true (issue #909).")
	assert_false(buttons["shop"].visible, "Shop button must be hidden when MVP_PVE_ONLY is true (issue #909).")
	assert_false(buttons["buy_gems"].visible, "BuyGems button must be hidden when MVP_PVE_ONLY is true (issue #909).")


func test_core_buttons_remain_visible_when_const_true() -> void:
	## Play / Loadout / Settings / Quit must stay usable under the
	## MVP-PvE slice — the gating is supposed to *restrict*, not break.
	if not ResourceLoader.exists(MAIN_MENU_SCRIPT_PATH):
		return
	if not ResourceLoader.exists(NETWORK_CONSTS_PATH):
		return
	var Const = load(NETWORK_CONSTS_PATH)
	if not Const.MVP_PVE_ONLY:
		pending("MVP_PVE_ONLY is false in this build — core-visibility test skipped (issue #909).")
		return

	var pair: Array = _make_menu_with_buttons()
	var menu: Control = pair[0]
	var buttons: Dictionary = pair[1]

	menu._apply_mvp_gating()

	assert_true(buttons["play"].visible, "Play button must remain visible when MVP_PVE_ONLY is true (issue #909).")
	assert_true(buttons["loadout"].visible, "Loadout button must remain visible when MVP_PVE_ONLY is true (issue #909).")
	assert_true(buttons["settings"].visible, "Settings button must remain visible when MVP_PVE_ONLY is true (issue #909).")
	assert_true(buttons["quit"].visible, "Quit button must remain visible when MVP_PVE_ONLY is true (issue #909).")


func test_gating_early_returns_when_const_false() -> void:
	## Flipping MVP_PVE_ONLY back to false is the MVP-2 escape hatch.
	## _apply_mvp_gating() must early-return so no button visibility is
	## mutated. We verify the source contract rather than mutating the
	## const file at runtime (which would leak across tests).
	var file := FileAccess.open(MAIN_MENU_SCRIPT_PATH, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % MAIN_MENU_SCRIPT_PATH)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()
	assert_true(
		text.contains("if not NetworkConsts.MVP_PVE_ONLY:") and text.contains("return"),
		"_apply_mvp_gating() must early-return when MVP_PVE_ONLY is false (issue #909)."
	)
