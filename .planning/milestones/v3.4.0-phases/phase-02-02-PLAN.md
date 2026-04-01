---
phase: "02-campaign-encounters"
plan: "02"
type: execute
wave: 2
depends_on:
  - "02-01"
files_modified:
  - autoloads/EnemyAIManager.gd
  - scenes/ui/combat_menu.gd
  - autoloads/CombatSyncManager.gd
  - scenes/ui/game_over.gd
  - autoloads/CampaignManager.gd
autonomous: true
requirements:
  - PVE-03
  - PVE-04

must_haves:
  truths:
    - "Clicking an encounter transitions to combat with correct enemy stats loaded"
    - "Enemies take turns automatically after the player (no manual input for enemy)"
    - "Enemy AI uses difficulty-based tactics (random at tier 1, adaptive at tier 3)"
    - "Combat log shows both player and enemy moves with damage values"
    - "Campaign progress (completed encounters) persists across sessions"
  artifacts:
    - path: "autoloads/EnemyAIManager.gd"
      provides: "Enemy decision logic per difficulty tier"
      min_lines: 100
    - path: "scenes/ui/combat_menu.gd"
      provides: "PvE combat mode with local enemy turns"
    - path: "autoloads/CombatSyncManager.gd"
      provides: "PvE mode flag to skip opponent polling"
    - path: "scenes/ui/game_over.gd"
      provides: "Victory flow: show loot summary, return to campaign map"
  key_links:
    - from: "scenes/ui/combat_menu.gd"
      to: "autoloads/EnemyAIManager.gd"
      via: "call enemy AI on player turn end"
      pattern: "enemy_ai_manager\\.get_enemy_action"
    - from: "scenes/ui/combat_menu.gd"
      to: "autoloads/GameManager.gd"
      via: "read encounter data and enemy stats"
      pattern: "GameManager\\.current_encounter_data"
    - from: "scenes/ui/game_over.gd"
      to: "autoloads/CampaignManager.gd"
      via: "complete_stage on victory"
      pattern: "campaign_manager\\.complete_stage"
---

<objective>
Create EnemyAIManager with difficulty-based enemy decision logic. Modify combat_menu to support PvE mode where enemies take turns locally. Update game_over to show victory flow and persist campaign progress.

Purpose: Phase 02 requires PvE combat where enemies take turns automatically, use difficulty-based tactics, and combat progress persists. The existing combat_menu.gd is PvP-only (opponents are other players via network polling). EnemyAIManager.gd doesn't exist yet. game_over.gd needs to complete stages on victory and return to campaign map.
Output: New EnemyAIManager autoload, PvE-aware combat_menu, enhanced game_over with campaign persistence
</objective>

<execution_context>
@/home/alex/.agents/get-shit-done/workflows/execute-plan.md
@/home/alex/.agents/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v3.4.0-ROADMAP.md
@.planning/milestones/v3.4.0-REQUIREMENTS.md
@.planning/milestones/v3.4.0-phases/phase-01-SUMMARY.md
@.planning/milestones/v3.4.0-phases/phase-02-01-PLAN.md

<interfaces>
From autoloads/CampaignManager.gd (after phase-02-01):
```gdscript
func get_enemy_data(stage_id: String) -> Dictionary
func get_difficulty_tier(stage_id: String) -> int
func get_loot_config(stage_id: String) -> Dictionary
func complete_stage(stage_id: String) -> void
func is_stage_completed(stage_id: String) -> bool
```

From autoloads/GameManager.gd (after phase-02-01):
```gdscript
signal player_died()
signal game_won()
signal health_changed(new_health: int, max_health: int)
var current_stage_id: String
var current_encounter_data: Dictionary  # added in phase-02-01
var current_difficulty: int             # added in phase-02-01
var boss_id: String
var player_current_health: int
var player_max_health: int
func start_game() -> void
func end_game(won: bool) -> void
func take_player_damage(damage: int) -> void
```

From scenes/ui/combat_menu.gd (current PvP state):
```gdscript
extends Control
var combat_manager: Node
var match_id: String
var is_initialized: bool
var current_match_state: Dictionary
func set_match_id(new_match_id: String) -> void
func initialize_combat() -> void
func _on_shoot_pressed() -> void
func _on_match_state_updated(match_state: Dictionary) -> void
func _on_turn_changed(is_my_turn: bool) -> void
func _on_combat_ended(winner: String) -> void
# Signals connected from CombatManager:
# combat_action_submitted, match_state_updated, turn_changed, combat_ended
```

From autoloads/CombatSyncManager.gd:
```gdscript
signal opponent_moved(move_data: Dictionary)
signal health_changed(player_health: int, opponent_health: int)
signal combat_ended(winner: String)
signal combat_started(match_id: String)
var player_health: int = 100
var opponent_health: int = 100
var is_my_turn: bool
var is_combat_active: bool
func start_combat(match_id: String) -> void
func send_move(angle: float, power: float) -> void
func end_combat(winner: String) -> void
```

From scenes/ui/game_over.gd:
```gdscript
extends Control
signal player_died()     # from GameManager
signal game_won()        # from GameManager
func _on_player_died() -> void
func _on_game_won() -> void
func _on_restart_button_pressed() -> void
# On victory: navigates to campaign_map if current_stage_id != ""
```

From autoloads/const.gd:
```gdscript
const DEFAULT_PLAYER_HEALTH: int = 100
const BASE_DAMAGE: int = 10
const CRITICAL_HIT_CHANCE: float = 0.15
const CRITICAL_HIT_MULTIPLIER: float = 2.0
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create EnemyAIManager autoload with difficulty-based tactics</name>
  <files>autoloads/EnemyAIManager.gd</files>
  <action>
    Create a new EnemyAIManager autoload that provides enemy decision logic for PvE combat. Follow project autoload conventions (extends Node, signals, type hints, `# --- Section ---` comments).

    ```gdscript
    extends Node

    # --- Signals ---
    signal enemy_action_decided(action: Dictionary)

    # --- Enums ---
    enum Difficulty { EASY = 1, MEDIUM = 2, HARD = 3 }

    # --- State ---
    var _enemy_stats: Dictionary = {}
    var _difficulty: int = 1
    var _turn_count: int = 0
    var _last_action: String = ""

    # --- Public API ---

    ## Initialize enemy for a PvE encounter
    func setup_enemy(enemy_data: Dictionary, difficulty: int) -> void:
      _enemy_stats = enemy_data.duplicate()
      _difficulty = difficulty
      _turn_count = 0
      _last_action = ""

    ## Get enemy stats
    func get_enemy_stats() -> Dictionary:
      return _enemy_stats

    ## Get current enemy health
    func get_enemy_health() -> int:
      return _enemy_stats.get("health", 0)

    ## Reduce enemy health by damage amount
    func take_damage(damage: int) -> void:
      _enemy_stats["health"] = max(0, _enemy_stats.get("health", 0) - damage)

    ## Check if enemy is defeated
    func is_defeated() -> bool:
      return get_enemy_health() <= 0

    ## Decide enemy action based on difficulty and current state
    ## Returns: {"action": "attack"|"defend"|"power_attack", "damage": int}
    func decide_action(player_health: int, player_defense: int) -> Dictionary:
      _turn_count += 1
      var action: Dictionary = {}

      match _difficulty:
        1:
          action = _easy_ai()
        2:
          action = _medium_ai(player_health)
        3:
          action = _hard_ai(player_health, player_defense)
        _:
          action = _easy_ai()

      _last_action = action.get("action", "attack")
      enemy_action_decided.emit(action)
      return action

    # --- AI Implementations ---

    ## Difficulty 1: Random — 60% attack, 40% defend
    func _easy_ai() -> Dictionary:
      var roll = randf()
      if roll < 0.6:
        return {"action": "attack", "damage": _calculate_damage()}
      else:
        return {"action": "defend", "damage": 0}

    ## Difficulty 2: Basic — aggressive when player healthy, defensive when player low
    func _medium_ai(player_health: int) -> Dictionary:
      var health_ratio = float(player_health) / float(DEFAULT_PLAYER_HEALTH)
      if health_ratio > 0.6:
        return {"action": "attack", "damage": _calculate_damage()}
      elif health_ratio < 0.3:
        return {"action": "power_attack", "damage": _calculate_damage() * 1.5}
      else:
        return {"action": "defend", "damage": 0}

    ## Difficulty 3: Adaptive — considers player defense, self health, turn pattern
    func _hard_ai(player_health: int, player_defense: int) -> Dictionary:
      var self_ratio = float(get_enemy_health()) / float(_enemy_stats.get("max_health", 100))

      # Low self health? Defend or power attack
      if self_ratio < 0.3:
        if _last_action != "defend":
          return {"action": "defend", "damage": 0}
        else:
          return {"action": "power_attack", "damage": _calculate_damage() * 1.5}

      # Player has high defense? Power attack to break through
      if player_defense > 15:
        return {"action": "power_attack", "damage": _calculate_damage() * 1.5}

      # Repeat last action if it worked (adaptive)
      if _last_action == "attack":
        return {"action": "attack", "damage": _calculate_damage()}

      # Default: attack
      return {"action": "attack", "damage": _calculate_damage()}

    # --- Helpers ---

    ## Calculate damage from enemy attack stat
    func _calculate_damage() -> int:
      var base_atk = _enemy_stats.get("attack", 10)
      var variance = randi_range(-2, 2)
      return max(1, base_atk + variance)
    ```

    Register EnemyAIManager as an autoload in project.godot. Find the autoload section and add:
    ```
    EnemyAIManager="*res://autoloads/EnemyAIManager.gd"
    ```

    Also add `_enemy_stats["max_health"]` in `setup_enemy()` to track max health for AI decisions:
    ```gdscript
    func setup_enemy(enemy_data: Dictionary, difficulty: int) -> void:
      _enemy_stats = enemy_data.duplicate()
      _enemy_stats["max_health"] = enemy_data.get("health", 100)
      _difficulty = difficulty
      _turn_count = 0
      _last_action = ""
    ```
  </action>
  <verify>
    <automated>gdlint autoloads/EnemyAIManager.gd</automated>
  </verify>
  <done>EnemyAIManager autoload created with 3 difficulty tiers (easy=random, medium=basic, hard=adaptive), damage calculation, health tracking, and signal for action decisions.</done>
</task>

<task type="auto">
  <name>Task 2: Add PvE combat mode to combat_menu</name>
  <files>scenes/ui/combat_menu.gd, autoloads/CombatSyncManager.gd</details>
  <action>
    Modify combat_menu.gd to support a PvE combat mode alongside the existing PvP mode. When launched from campaign (GameManager.current_encounter_data is non-empty), use EnemyAIManager instead of network polling.

    Changes to combat_menu.gd:

    1. Add PvE mode detection and state variables:
    ```gdscript
    var _is_pve_mode: bool = false
    var _enemy_health: int = 0
    var _enemy_max_health: int = 0
    ```

    2. Add reference to EnemyAIManager at top:
    ```gdscript
    @onready var enemy_ai_manager: Node = EnemyAIManager
    ```

    3. Update `initialize_combat()` to detect PvE mode:
    ```gdscript
    func initialize_combat() -> void:
      var encounter_data = GameManager.current_encounter_data
      if encounter_data.size() > 0:
        _init_pve_combat(encounter_data)
      else:
        _init_pvp_combat()
    ```

    4. Add PvE initialization method:
    ```gdscript
    func _init_pve_combat(encounter_data: Dictionary) -> void:
      _is_pve_mode = true
      _enemy_health = encounter_data.get("health", 30)
      _enemy_max_health = _enemy_health
      var difficulty = GameManager.current_difficulty

      enemy_ai_manager.setup_enemy(encounter_data, difficulty)

      # Update UI with enemy stats
      opponent_health_bar.max_value = _enemy_max_health
      opponent_health_bar.value = _enemy_health
      opponent_health_label.text = str(_enemy_health) + " / " + str(_enemy_max_health)
      turn_label.text = "Your Turn"
      shoot_button.disabled = false
      is_initialized = true

      # Hide loading, show stats
      if loading_label:
        loading_label.visible = false
    ```

    5. Rename existing PvP init logic to `_init_pvp_combat()` (just wrap existing code).

    6. Update `_on_shoot_pressed()` to handle PvE:
    ```gdscript
    func _on_shoot_pressed() -> void:
      if _is_pve_mode:
        _handle_pve_shoot()
      else:
        _handle_pvp_shoot()
    ```

    7. Add PvE shoot handler:
    ```gdscript
    func _handle_pve_shoot() -> void:
      var angle = angle_slider.value
      var player_atk = GameManager.player_stats.get("attack", BASE_DAMAGE) if GameManager.player_stats.has("attack") else BASE_DAMAGE

      # Calculate player damage to enemy
      var enemy_def = enemy_ai_manager.get_enemy_stats().get("defense", 0)
      var damage = max(1, player_atk - enemy_def)

      # Critical hit check
      if randf() < CRITICAL_HIT_CHANCE:
        damage = int(damage * CRITICAL_HIT_MULTIPLIER)

      # Apply to enemy
      enemy_ai_manager.take_damage(damage)
      _enemy_health = enemy_ai_manager.get_enemy_health()
      opponent_health_bar.value = _enemy_health
      opponent_health_label.text = str(_enemy_health) + " / " + str(_enemy_max_health)

      _append_combat_log("You dealt " + str(damage) + " damage!")

      # Check enemy defeated
      if enemy_ai_manager.is_defeated():
        _on_pve_combat_ended("player")
        return

      # Enemy turn
      turn_label.text = "Enemy Turn"
      shoot_button.disabled = true

      # Small delay for feel, then enemy acts
      await get_tree().create_timer(0.5).timeout
      _handle_pve_enemy_turn()
    ```

    8. Add PvE enemy turn handler:
    ```gdscript
    func _handle_pve_enemy_turn() -> void:
      var player_def = GameManager.player_stats.get("defense", 0) if GameManager.player_stats.has("defense") else 0
      var action = enemy_ai_manager.decide_action(GameManager.player_current_health, player_def)

      var enemy_damage = action.get("damage", 0)
      if action.get("action") == "defend":
        _append_combat_log("Enemy defends!")
      else:
        var actual_damage = max(1, enemy_damage - player_def)
        GameManager.take_player_damage(actual_damage)
        my_health_bar.value = GameManager.player_current_health
        my_health_label.text = str(GameManager.player_current_health) + " / " + str(GameManager.player_max_health)
        _append_combat_log("Enemy " + action.get("action", "attacks") + " for " + str(actual_damage) + " damage!")

      # Check player defeated
      if GameManager.player_current_health <= 0:
        _on_pve_combat_ended("enemy")
        return

      # Back to player turn
      turn_label.text = "Your Turn"
      shoot_button.disabled = false
    ```

    9. Add PvE combat end handler:
    ```gdscript
    func _on_pve_combat_ended(winner: String) -> void:
      shoot_button.disabled = true
      if winner == "player":
        GameManager.end_game(true)  # triggers game_won signal → CampaignManager.complete_stage
        _append_combat_log("Victory!")
      else:
        GameManager.end_game(false)  # triggers player_died signal
        _append_combat_log("Defeat!")
    ```

    10. Rename existing `_on_combat_ended` to `_on_pvp_combat_ended` and update signal connection.

    11. Add `_append_combat_log(message)` helper if not present:
    ```gdscript
    func _append_combat_log(message: String) -> void:
      if combat_log:
        combat_log.text += message + "\n"
    ```

    Changes to CombatSyncManager.gd:
    - No changes needed. PvE mode bypasses CombatSyncManager entirely (combat_menu handles PvE locally). CombatSyncManager is only used for PvP.

    Changes to PlayerStatsManager or GameManager:
    - GameManager needs `player_stats: Dictionary` if not present. Check if it exists. If not, add `var player_stats: Dictionary = {}` and populate in `_ready()` from PlayerStatsManager. Alternatively, read attack/defense directly from PlayerStatsManager in combat_menu.
  </action>
  <verify>
    <automated>gdlint scenes/ui/combat_menu.gd</automated>
  </verify>
  <done>combat_menu detects PvE mode from GameManager.current_encounter_data, uses EnemyAIManager for enemy turns, handles player shoot → enemy turn → player turn loop, and ends combat on health reaching 0.</done>
</task>

<task type="auto">
  <name>Task 3: Update game_over for victory flow and campaign persistence</name>
  <files>scenes/ui/game_over.gd</files>
  <action>
    Enhance game_over.gd to show loot/XP summary on victory and properly persist campaign progress when returning to the campaign map.

    Changes:

    1. Add references to CampaignManager and loot display:
    ```gdscript
    @onready var campaign_manager: Node = CampaignManager
    @onready var loot_label: Label = $LootLabel  # add this node or use existing labels
    ```

    2. Update `_on_game_won()` to display loot summary:
    ```gdscript
    func _on_game_won() -> void:
      result_label.text = "Victory!"
      result_label.add_theme_color_override("font_color", VICTORY_COLOR)
      visible = true

      # Show loot summary if PvE encounter
      var encounter_data = GameManager.current_encounter_data
      if encounter_data.size() > 0:
        var loot_config = campaign_manager.get_loot_config(GameManager.current_stage_id)
        var xp = loot_config.get("xp", 50)
        var gold = loot_config.get("gold", 25)

        if loot_label:
          loot_label.text = "+" + str(xp) + " XP  +" + str(gold) + " Gold"
          loot_label.visible = true

      # Complete the stage (persists progress)
      if GameManager.current_stage_id != "":
        campaign_manager.complete_stage(GameManager.current_stage_id)
    ```

    3. Update `_on_restart_button_pressed()` to handle victory return:
    ```gdscript
    func _on_restart_button_pressed() -> void:
      if GameManager.current_stage_id != "":
        # Return to campaign map
        get_tree().change_scene_to_file("res://scenes/ui/campaign_map.tscn")
      else:
        # Generic restart (non-campaign)
        GameManager.reset_stage()
        get_tree().reload_current_scene()
    ```

    4. If the game_over.tscn scene doesn't have a LootLabel, add a note in the action to create one as a child of the root Control node with appropriate positioning below the result_label.

    5. Ensure the button text changes contextually: "Continue" for victory, "Try Again" for defeat:
    ```gdscript
    func _on_game_won() -> void:
      # ... existing code ...
      restart_button.text = "Continue"

    func _on_player_died() -> void:
      # ... existing code ...
      restart_button.text = "Try Again"
    ```
  </action>
  <verify>
    <automated>gdlint scenes/ui/game_over.gd</automated>
  </verify>
  <done>game_over shows loot summary (XP + Gold) on victory, completes stage via CampaignManager, button text is contextual (Continue/Try Again), returns to campaign map.</done>
</task>

</tasks>

<verification>
1. Parse validation: `godot --headless --quit` exits with 0 errors
2. gdlint passes on all modified and new files
3. EnemyAIManager test: setup_enemy with difficulty 1 → decide_action returns attack or defend
4. EnemyAIManager test: setup_enemy with difficulty 3 → decide_action considers player defense
5. combat_menu PvE flow: encounter_data present → initializes with enemy health, shoot reduces enemy health
6. game_over victory: shows loot, calls complete_stage, navigates to campaign map
7. Campaign persistence: complete_stage → save_progress → reload → is_stage_completed returns true
</verification>

<success_criteria>
- [ ] EnemyAIManager created with 3 difficulty tiers and registered as autoload
- [ ] combat_menu detects PvE mode and uses EnemyAIManager for enemy turns
- [ ] Player shoot → enemy turn → player turn loop works without network calls
- [ ] Enemy AI uses different tactics per difficulty (random / basic / adaptive)
- [ ] Combat log shows both player and enemy moves with damage values
- [ ] Victory triggers CampaignManager.complete_stage() and shows loot summary
- [ ] Defeat allows retry, victory returns to campaign map with progress saved
- [ ] gdlint passes, godot parse validation passes
</success_criteria>

<output>
After completion, create `.planning/milestones/v3.4.0-phases/phase-02-02-SUMMARY.md`
</output>
