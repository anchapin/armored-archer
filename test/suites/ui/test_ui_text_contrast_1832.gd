extends GutTest

## Issue #1832: dark text was rendered on dark surfaces in two screens.
##
##   1. `scenes/ui/game_over.tscn` — the result heading ("Stage Complete" /
##      `ResultLabel`) sits on the dark `Panel`; `_apply_theme()` tinted it
##      with the dark Tactile Heroism `on_surface` (#383833), i.e. dark text
##      on a dark panel.
##   2. `scenes/ui/matchmaking_menu.tscn` — the Power Rating status label,
##      the opponent entry title and the opponent power-rating metadata were
##      tinted with the same dark colours while sitting on dark panels.
##
## The fix keeps the Relic Archive (dark) palette constants that the rest of
## the project already uses for readable text on these surfaces:
##   * `ArcherDesignTokens.RA_ON_SURFACE` (#ffffff) — primary text
##   * `ArcherDesignTokens.RA_ON_SURFACE_VARIANT` (#adaaaa) — secondary text
##
## The suite has two layers:
##   1. **Static** — the two scripts must not fall back to the dark
##      `colors["on_surface"]` / `get_text_color()` text colours any more.
##   2. **Runtime** — applying the theme to the real scenes must resolve the
##      named labels to the light colours, with a WCAG AA (4.5:1) contrast
##      ratio against the dark surface they are drawn on.

const GAME_OVER_SCENE_PATH := "res://scenes/ui/game_over.tscn"
const GAME_OVER_SCRIPT_PATH := "res://scenes/ui/game_over.gd"
const MATCHMAKING_SCENE_PATH := "res://scenes/ui/matchmaking_menu.tscn"
const MATCHMAKING_SCRIPT_PATH := "res://scenes/ui/matchmaking_menu.gd"

## Dark surface the labels are drawn on (Relic Archive base layer).
const DARK_SURFACE := Color("#0e0e0e")

## WCAG AA minimum for normal sized text.
const MIN_CONTRAST_RATIO := 4.5


func _read_text(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	assert_not_null(file, "Could not open %s" % path)
	if file == null:
		return ""
	var text := file.get_as_text()
	file.close()
	return text


func _relative_luminance(color: Color) -> float:
	var channels: Array = [color.r, color.g, color.b]
	var luminance := 0.0
	for channel in channels:
		var value: float = channel
		if value <= 0.03928:
			value = value / 12.92
		else:
			value = pow((value + 0.055) / 1.055, 2.4)
		luminance += value
	return luminance / 3.0


func _contrast_ratio(fg: Color, bg: Color) -> float:
	var fg_luminance := _relative_luminance(fg)
	var bg_luminance := _relative_luminance(bg)
	var lighter := maxf(fg_luminance, bg_luminance)
	var darker := minf(fg_luminance, bg_luminance)
	return (lighter + 0.05) / (darker + 0.05)


# ---------------------------------------------------------------------------
# Layer 1: static source guards.
# ---------------------------------------------------------------------------

func test_game_over_script_has_no_dark_on_surface_text_colour() -> void:
	## The dark Tactile Heroism "on_surface" (#383833) must not be used for the
	## heading any more.
	var text := _read_text(GAME_OVER_SCRIPT_PATH)
	assert_false(
		text.contains("colors[\"on_surface\"]"),
		"game_over.gd must not colour the result heading with the dark on_surface colour (issue #1832)."
	)


func test_matchmaking_script_has_no_dark_on_surface_text_colour() -> void:
	## Neither the palette lookup nor the ThemeManager helper (both resolve to
	## the dark #383833) may be used for the matchmaking labels.
	var text := _read_text(MATCHMAKING_SCRIPT_PATH)
	assert_false(
		text.contains("colors[\"on_surface\"]"),
		"matchmaking_menu.gd must not colour its labels with the dark on_surface colour (issue #1832)."
	)
	assert_false(
		text.contains("get_text_color()"),
		"matchmaking_menu.gd must not colour its labels with the dark ThemeManager text colour (issue #1832)."
	)


func test_both_scripts_use_the_light_relic_archive_colours() -> void:
	for path in [GAME_OVER_SCRIPT_PATH, MATCHMAKING_SCRIPT_PATH]:
		var text := _read_text(path)
		assert_true(
			text.contains("ArcherDesignTokens.RA_ON_SURFACE"),
			"%s must use the light Relic Archive on-surface colour (issue #1832)." % path
		)


# ---------------------------------------------------------------------------
# Layer 2: runtime colour resolution.
# ---------------------------------------------------------------------------

func test_game_over_heading_resolves_to_a_light_readable_colour() -> void:
	if not ResourceLoader.exists(GAME_OVER_SCENE_PATH):
		pending("Game over scene not found at %s" % GAME_OVER_SCENE_PATH)
		return
	var theme_manager := get_node_or_null("/root/ThemeManager")
	if theme_manager == null:
		pending("ThemeManager autoload not available — skipping issue #1832 runtime check.")
		return

	var screen = load(GAME_OVER_SCENE_PATH).instantiate()
	screen.set("theme_manager", theme_manager)

	var result_label := Label.new()
	var loot_label := Label.new()
	screen.set("result_label", result_label)
	screen.set("loot_label", loot_label)

	screen._apply_theme()

	var heading_color: Color = result_label.get_theme_color("font_color")
	assert_eq(
		heading_color,
		ArcherDesignTokens.RA_ON_SURFACE,
		"The game over heading must use the light Relic Archive on-surface colour (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(heading_color, DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The game over heading must meet WCAG AA contrast against the dark panel (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(loot_label.get_theme_color("font_color"), DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The game over loot label must meet WCAG AA contrast against the dark panel (issue #1832)."
	)

	result_label.free()
	loot_label.free()
	screen.free()


func test_matchmaking_status_and_opponent_labels_resolve_to_light_colours() -> void:
	if not ResourceLoader.exists(MATCHMAKING_SCENE_PATH):
		pending("Matchmaking scene not found at %s" % MATCHMAKING_SCENE_PATH)
		return
	var theme_manager := get_node_or_null("/root/ThemeManager")
	if theme_manager == null:
		pending("ThemeManager autoload not available — skipping issue #1832 runtime check.")
		return

	var menu = load(MATCHMAKING_SCENE_PATH).instantiate()
	menu.set("theme_manager", theme_manager)

	var rank_label := Label.new()
	var punch_up_stats_label := Label.new()
	var loading_label := Label.new()
	menu.set("rank_label", rank_label)
	menu.set("punch_up_stats_label", punch_up_stats_label)
	menu.set("loading_label", loading_label)

	menu._apply_theme()

	assert_eq(
		rank_label.get_theme_color("font_color"),
		ArcherDesignTokens.RA_ON_SURFACE,
		"The Power Rating status label must use the light Relic Archive on-surface colour (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(rank_label.get_theme_color("font_color"), DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The Power Rating status label must meet WCAG AA contrast on the dark surface (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(punch_up_stats_label.get_theme_color("font_color"), DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The punch-up stats label must meet WCAG AA contrast on the dark surface (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(loading_label.get_theme_color("font_color"), DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The loading label must meet WCAG AA contrast on the dark surface (issue #1832)."
	)

	rank_label.free()
	punch_up_stats_label.free()
	loading_label.free()
	menu.free()


func test_matchmaking_opponent_entry_labels_use_light_colours() -> void:
	## The opponent entry title and the opponent power-rating metadata are
	## created at runtime by `_create_match_item()`.
	if not ResourceLoader.exists(MATCHMAKING_SCENE_PATH):
		pending("Matchmaking scene not found at %s" % MATCHMAKING_SCENE_PATH)
		return

	var menu = load(MATCHMAKING_SCENE_PATH).instantiate()
	menu.set("theme_manager", get_node_or_null("/root/ThemeManager"))

	var item = menu._create_match_item({"match_type": "ranked", "creator_rank": 1200})
	var labels: Array = item.get_child(0).get_children()
	assert_true(labels.size() >= 2, "The match entry must expose its title and power rating labels.")

	var title_color: Color = labels[0].get_theme_color("font_color")
	var rating_color: Color = labels[1].get_theme_color("font_color")
	assert_eq(
		title_color,
		ArcherDesignTokens.RA_ON_SURFACE,
		"The opponent entry title must use the light Relic Archive on-surface colour (issue #1832)."
	)
	assert_eq(
		rating_color,
		ArcherDesignTokens.RA_ON_SURFACE,
		"The opponent power-rating metadata must use the light Relic Archive on-surface colour (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(title_color, DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The opponent entry title must meet WCAG AA contrast on the dark surface (issue #1832)."
	)
	assert_gte(
		_contrast_ratio(rating_color, DARK_SURFACE),
		MIN_CONTRAST_RATIO,
		"The opponent power-rating metadata must meet WCAG AA contrast on the dark surface (issue #1832)."
	)

	item.free()
	menu.free()
