extends Control

## Warning dialog for high-risk punch-up challenges.
## Shows the Power Rating gap (what gates punch-up eligibility) and the
## Ladder Rating stake (what a punch-up actually wagers).
## Loss copy reflects the server-verified consequence model (issue #862):
## an amplified Ladder Rating deduction plus a reduced, always-positive
## XP grant — never an XP penalty or XP subtraction.
## Players can accept or decline the challenge.

signal warning_accepted(match_data: Dictionary)
signal warning_declined(match_data: Dictionary)

# --- UI References ---
@onready var title_label: Label = $DialogPanel/MarginContainer/VBoxContainer/TitleLabel
@onready var risk_level_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/RiskLevelLabel
@onready var rank_difference_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/RankDifferenceLabel
@onready var explanation_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/ExplanationLabel
@onready var win_bonus_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/RewardsContainer/WinRewards/WinBonusLabel
@onready var lose_penalty_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/RewardsContainer/LoseRewards/LosePenaltyLabel
@onready var warning_label: Label = $DialogPanel/MarginContainer/VBoxContainer/ContentContainer/WarningLabel
@onready var decline_button: Button = $DialogPanel/MarginContainer/VBoxContainer/ButtonContainer/DeclineButton
@onready var accept_button: Button = $DialogPanel/MarginContainer/VBoxContainer/ButtonContainer/AcceptButton

# --- Theme Manager Reference ---
var theme_manager: Node

# --- Design Tokens Reference ---
var design_tokens: Node

# --- State ---
var _match_data: Dictionary = {}
var _player_rank: int = 0

# --- Punch-Up Constants (matching backend: gap 5-15, min Power Rating 20) ---
const PUNCH_UP_RANK_DIFF_THRESHOLD = 5
const PUNCH_UP_MAX_RANK_DIFF = 15
const PUNCH_UP_MIN_RANK = 20

# --- Reward Constants (matching backend) ---
const PUNCH_UP_XP_MULTIPLIER_MIN = 1.2
const PUNCH_UP_XP_MULTIPLIER_MAX = 2.0
const PUNCH_UP_GEM_BONUS_MIN = 3
const PUNCH_UP_GEM_BONUS_MAX = 10

# --- Risk Level Thresholds ---
const RISK_LEVEL_LOW_THRESHOLD = 7   # Rank diff 5-7 = Low risk
const RISK_LEVEL_MEDIUM_THRESHOLD = 11 # Rank diff 8-11 = Medium risk
const RISK_LEVEL_HIGH_THRESHOLD = 15  # Rank diff 12-15 = High risk

# --- Initialization ---
func _ready() -> void:
	# Get ThemeManager reference
	theme_manager = get_node_or_null("/root/ThemeManager")

	# Get DesignTokens reference
	design_tokens = get_node_or_null("/root/DesignTokens")

	# Apply theme if available
	if theme_manager:
		_apply_theme()
		theme_manager.theme_changed.connect(_on_theme_changed)

	decline_button.pressed.connect(_on_decline_pressed)
	accept_button.pressed.connect(_on_accept_pressed)

# --- Public Methods ---

func set_match_data(match_data: Dictionary, player_rank: int) -> void:
	"""Sets the match data and player rank to calculate risk.

	Parameters:
		match_data: Dictionary containing match information
		player_rank: Current player's rank
	"""
	_match_data = match_data
	_player_rank = player_rank
	_update_dialog_content()

func get_match_data() -> Dictionary:
	"""Returns the current match data.

	Returns:
		Dictionary: The match data being warned about
	"""
	return _match_data

# --- Content Updates ---

func _update_dialog_content() -> void:
	"""Updates the dialog content based on match risk level."""
	var opponent_rank: int = _match_data.get("creator_rank", 0)
	var rank_diff: int = abs(opponent_rank - _player_rank)

	# Determine risk level
	var risk_level: String = _calculate_risk_level(rank_diff)
	var risk_color: Color = _get_risk_color(risk_level)

	# Update title and risk level
	risk_level_label.text = "Risk Level: %s" % risk_level.to_upper()
	risk_level_label.modulate = risk_color

	# Update Power Rating gap info (eligibility keys on Power Rating,
	# never on Ladder Rating — issue #862)
	if opponent_rank > _player_rank:
		rank_difference_label.text = "Opponent's Power Rating is %d above yours" % rank_diff
	else:
		rank_difference_label.text = "Opponent's Power Rating is %d below yours" % rank_diff

	# Update explanation based on risk level
	explanation_label.text = _get_risk_explanation(risk_level, rank_diff)

	# Calculate and display server-verified rewards only.
	# Win: XP multiplier (1.2x-2.0x by gap) plus gem bonus (3-10).
	# Loss: amplified Ladder Rating deduction (2x K-factor); the XP grant
	# is reduced but always positive — no XP penalty exists to advertise.
	var xp_multiplier: float = _calculate_xp_multiplier(rank_diff)
	var gem_bonus: int = _calculate_gem_bonus(rank_diff)

	win_bonus_label.text = "+%.0f%% XP, +%d Gems" % [(xp_multiplier - 1.0) * 100.0, gem_bonus]
	lose_penalty_label.text = "2× Ladder Rating loss; XP reduced, still earned"

	# Update warning message
	warning_label.text = _get_warning_message(risk_level)

	# Style accept button based on risk
	var accept_color: Color = _get_risk_color(risk_level)
	accept_button.modulate = accept_color

# --- Risk Calculation ---

func _calculate_risk_level(rank_diff: int) -> String:
	"""Calculates the risk level based on rank difference.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		String: Risk level ("low", "medium", or "high")
	"""
	if rank_diff >= RISK_LEVEL_HIGH_THRESHOLD:
		return "high"
	elif rank_diff >= RISK_LEVEL_MEDIUM_THRESHOLD:
		return "medium"
	else:
		return "low"

func _get_risk_color(risk_level: String) -> Color:
	"""Returns the color for a given risk level.

	Parameters:
		risk_level: The risk level

	Returns:
		Color: The appropriate color for the risk level
	"""
	if design_tokens:
		match risk_level:
			"low":
				return ArcherDesignTokens.COLOR_SUCCESS
			"medium":
				return ArcherDesignTokens.COLOR_WARNING
			"high":
				return ArcherDesignTokens.COLOR_ERROR
			_:
				return ArcherDesignTokens.COLOR_INFO
	else:
		# Fallback colors
		match risk_level:
			"low": return Color.GREEN
			"medium": return Color.ORANGE
			"high": return Color.RED
			_: return Color.BLUE

func _get_risk_explanation(risk_level: String, rank_diff: int) -> String:
	"""Returns the explanation text for a given risk level.

	Parameters:
		risk_level: The calculated risk level
		rank_diff: The rank difference

	Returns:
		String: Explanation text
	"""
	match risk_level:
		"low":
			return "A mild punch-up: small Power Rating gap, modest Ladder Rating swing."
		"medium":
			return "A moderate punch-up: a wider Power Rating gap means a bigger Ladder Rating swing."
		"high":
			return "A steep punch-up: losing to a much stronger build costs double Ladder Rating."
		_:
			return "A punch-up stakes Ladder Rating; the Power Rating gap set the terms."

func _get_warning_message(risk_level: String) -> String:
	"""Returns the warning message based on risk level.

	Parameters:
		risk_level: The calculated risk level

	Returns:
		String: Warning message
	"""
	match risk_level:
		"low":
			return "Ladder Rating is what's staked. Continue?"
		"medium":
			return "You're staking Ladder Rating against a stronger opponent. Prepared?"
		"high":
			return "A loss here costs double Ladder Rating. Are you sure?"
		_:
			return "Proceed with caution — Ladder Rating is at stake."

# --- Reward Calculations ---

func _calculate_xp_multiplier(rank_diff: int) -> float:
	"""Calculates XP multiplier based on rank difference.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		float: XP multiplier (1.0 = normal, higher = bonus)
	"""
	var multiplier_range: float = PUNCH_UP_XP_MULTIPLIER_MAX - PUNCH_UP_XP_MULTIPLIER_MIN
	var rank_diff_range: float = float(PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD)
	var normalized_diff: float = clampf(
		(float(rank_diff) - float(PUNCH_UP_RANK_DIFF_THRESHOLD)) / rank_diff_range,
		0.0,
		1.0
	)
	return PUNCH_UP_XP_MULTIPLIER_MIN + multiplier_range * normalized_diff

func _calculate_gem_bonus(rank_diff: int) -> int:
	"""Calculates gem bonus based on rank difference.

	Parameters:
		rank_diff: Absolute difference in ranks

	Returns:
		int: Number of bonus gems
	"""
	var gem_range: float = float(PUNCH_UP_GEM_BONUS_MAX - PUNCH_UP_GEM_BONUS_MIN)
	var rank_diff_range: float = float(PUNCH_UP_MAX_RANK_DIFF - PUNCH_UP_RANK_DIFF_THRESHOLD)
	var normalized_diff: float = clampf(
		(float(rank_diff) - float(PUNCH_UP_RANK_DIFF_THRESHOLD)) / rank_diff_range,
		0.0,
		1.0
	)
	return int(PUNCH_UP_GEM_BONUS_MIN + gem_range * normalized_diff)

# --- Button Callbacks ---

func _on_decline_pressed() -> void:
	"""Called when the decline button is pressed."""
	warning_declined.emit(_match_data)
	queue_free()

func _on_accept_pressed() -> void:
	"""Called when the accept button is pressed."""
	warning_accepted.emit(_match_data)
	queue_free()

# --- Theme Support ---

func _apply_theme() -> void:
	"""Applies the current theme to the dialog."""
	if not theme_manager:
		return

	var colors: Dictionary = theme_manager.get_theme_colors()

	# Apply background
	$DialogPanel.modulate = colors["surface"]

	# Apply text colors
	if title_label:
		title_label.modulate = colors["on_surface"]
	if rank_difference_label:
		rank_difference_label.modulate = colors["on_surface"]
	if explanation_label:
		explanation_label.modulate = colors["on_surface"]
	if win_bonus_label:
		win_bonus_label.modulate = colors.get("on_surface_variant", colors.get("on_surface", Color.WHITE))
	if lose_penalty_label:
		lose_penalty_label.modulate = colors.get("on_surface_variant", colors.get("on_surface", Color.WHITE))
	if warning_label:
		warning_label.modulate = colors["on_surface"]

	# Apply button colors
	if decline_button:
		decline_button.modulate = colors.get("on_surface_variant", colors.get("on_surface", Color.WHITE))
	if accept_button:
		accept_button.modulate = colors["primary"]

func _on_theme_changed(is_dark: bool) -> void:
	"""Called when the theme changes.

	Parameters:
		is_dark: Whether dark mode is active
	"""
	_apply_theme()
	_update_dialog_content()

# --- Cleanup ---

func _exit_tree() -> void:
	"""Clean up resources when the dialog is destroyed."""
	if theme_manager and theme_manager.theme_changed.is_connected(_on_theme_changed):
		theme_manager.theme_changed.disconnect(_on_theme_changed)
