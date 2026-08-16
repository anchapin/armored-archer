## Shows projected season rewards for current and next tiers.
## Lets players preview what they earn at each rank tier (Standing-based).
extends PanelContainer

signal closed()

# --- UI References ---
@onready var title_label: Label = $VBoxContainer/TitleLabel
@onready var current_tier_label: Label = $VBoxContainer/CurrentSection/TierLabel
@onready var current_coins_label: Label = $VBoxContainer/CurrentSection/CoinsLabel
@onready var current_gems_label: Label = $VBoxContainer/CurrentSection/GemsLabel
@onready var current_cosmetics_label: Label = $VBoxContainer/CurrentSection/CosmeticsLabel
@onready var next_section: VBoxContainer = $VBoxContainer/NextSection
@onready var next_tier_label: Label = $VBoxContainer/NextSection/NextTierLabel
@onready var next_coins_label: Label = $VBoxContainer/NextSection/NextCoinsLabel
@onready var next_gems_label: Label = $VBoxContainer/NextSection/NextGemsLabel
@onready var next_cosmetics_label: Label = $VBoxContainer/NextSection/NextCosmeticsLabel
@onready var next_message_label: Label = $VBoxContainer/NextSection/NextMessageLabel
@onready var close_button: Button = $VBoxContainer/CloseButton

# --- Manager References ---
var season_manager: Node
var season_messenger: Node
var design_tokens: Node

func _ready() -> void:
	hide()
	close_button.pressed.connect(_on_close_pressed)
	season_manager = get_node_or_null("/root/SeasonManager")
	season_messenger = get_node_or_null("/root/SeasonMessenger")
	design_tokens = get_node_or_null("/root/ArcherDesignTokens")

func show_for_rank(standing: int) -> void:
	if not season_messenger:
		_fallback_show(standing)
		return

	var current_rewards: Dictionary = season_messenger.get_projected_rewards(standing)
	_display_current_rewards(current_rewards)

	var next_info: Dictionary = season_messenger.get_next_tier_info(standing)
	if next_info.get("threshold", 0) > 0 and standing > 0:
		var next_rewards: Dictionary = season_messenger.get_projected_rewards(next_info.threshold - 1)
		_display_next_rewards(next_rewards, next_info)
		next_section.visible = true
	else:
		next_section.visible = standing <= 0 or standing <= 10
		if standing <= 10 and standing > 0:
			next_tier_label.text = "Legendary (Max Tier)"
			next_message_label.text = "You're at the highest tier! Defend your position!"
			next_coins_label.text = ""
			next_gems_label.text = ""
			next_cosmetics_label.text = ""

	show()

func _fallback_show(standing: int) -> void:
	var tier: String = "Common"
	if season_manager:
		tier = season_manager.get_rank_tier(standing)
	current_tier_label.text = "Current Tier: %s" % tier
	current_coins_label.text = ""
	current_gems_label.text = ""
	current_cosmetics_label.text = ""
	next_section.visible = false
	show()

func _display_current_rewards(rewards: Dictionary) -> void:
	var tier: String = rewards.get("tier", "Common")
	current_tier_label.text = "Current Tier: %s" % tier
	current_tier_label.modulate = _get_tier_color(tier)

	var coins: int = rewards.get("coins", 0)
	var gems: int = rewards.get("gems", 0)
	var cosmetics: Dictionary = rewards.get("cosmetics", {})

	current_coins_label.text = "Coins: %d" % coins
	current_gems_label.text = "Gems: %d" % gems if gems > 0 else ""

	if cosmetics.is_empty():
		current_cosmetics_label.text = ""
	else:
		var parts: Array = []
		if cosmetics.has("title"):
			parts.append("Title: %s" % cosmetics.title)
		if cosmetics.has("aura"):
			parts.append("Aura: %s" % cosmetics.aura)
		current_cosmetics_label.text = "\n".join(parts)

func _display_next_rewards(rewards: Dictionary, next_info: Dictionary) -> void:
	var tier: String = rewards.get("tier", "Common")
	next_tier_label.text = "Next Tier: %s" % tier
	next_tier_label.modulate = _get_tier_color(tier)

	var coins: int = rewards.get("coins", 0)
	var gems: int = rewards.get("gems", 0)
	var cosmetics: Dictionary = rewards.get("cosmetics", {})

	next_coins_label.text = "Coins: %d" % coins
	next_gems_label.text = "Gems: %d" % gems if gems > 0 else ""

	if cosmetics.is_empty():
		next_cosmetics_label.text = ""
	else:
		var parts: Array = []
		if cosmetics.has("title"):
			parts.append("Title: %s" % cosmetics.title)
		if cosmetics.has("aura"):
			parts.append("Aura: %s" % cosmetics.aura)
		next_cosmetics_label.text = "\n".join(parts)

	next_message_label.text = next_info.get("message", "")

func _get_tier_color(tier: String) -> Color:
	match tier:
		"Legendary":
			return Color.ORANGE
		"Epic":
			return Color.MAGENTA
		"Rare":
			return Color.BLUE
		"Uncommon":
			return Color.GREEN
		_:
			return Color.GRAY

func _on_close_pressed() -> void:
	hide()
	closed.emit()
