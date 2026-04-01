---
phase: "02-campaign-encounters"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - data/campaigns.json
  - autoloads/CampaignManager.gd
  - scenes/ui/campaign_map.gd
autonomous: true
requirements:
  - PVE-01
  - PVE-02
  - PVE-03

must_haves:
  truths:
    - "Campaign map displays encounters with enemy names, difficulty indicators, and biome labels"
    - "Locked encounters show as visually unavailable until prerequisite stages are cleared"
    - "Clicking an unlocked encounter stores enemy stats in GameManager for combat consumption"
    - "Campaign map reads progression state from CampaignManager (completed/unlocked/locked)"
  artifacts:
    - path: "data/campaigns.json"
      provides: "Enriched encounter data with enemy stats, difficulty, biome, loot tiers"
    - path: "autoloads/CampaignManager.gd"
      provides: "Enemy data API: get_enemy_data(), get_difficulty_tier(), get_biome()"
    - path: "scenes/ui/campaign_map.gd"
      provides: "Encounter display with difficulty icons, lock state visuals, enemy preview"
  key_links:
    - from: "scenes/ui/campaign_map.gd"
      to: "autoloads/CampaignManager.gd"
      via: "get_enemy_data() + get_stage_data()"
      pattern: "campaign_manager\\.get_(enemy_data|stage_data)"
    - from: "scenes/ui/campaign_map.gd"
      to: "autoloads/GameManager.gd"
      via: "set encounter data on stage select"
      pattern: "GameManager\\.(current_stage_id|current_encounter_data)"
---

<objective>
Enrich campaign data with enemy stats, difficulty tiers, and biome metadata. Update CampaignManager to expose enemy data API. Enhance campaign map UI to show difficulty indicators, lock states, and pass encounter data to GameManager for PvE combat.

Purpose: Phase 02 requires players to navigate a campaign map with 8+ encounters across difficulty tiers, see lock states, and select encounters that load correct enemy stats into combat. The existing campaigns.json has basic stage data (name, waves, boss) but lacks enemy stats, difficulty tiers, and biome metadata. CampaignManager needs new query methods. The campaign map needs visual updates for difficulty and lock state.
Output: Enriched data/campaigns.json, updated CampaignManager with enemy API, enhanced campaign_map.gd
</objective>

<execution_context>
@/home/alex/.agents/get-shit-done/workflows/execute-plan.md
@/home/alex/.agents/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v3.4.0-ROADMAP.md
@.planning/milestones/v3.4.0-REQUIREMENTS.md
@.planning/milestones/v3.4.0-phases/phase-01-SUMMARY.md

<interfaces>
From autoloads/CampaignManager.gd:
```gdscript
signal stage_unlocked(stage_id: String)
signal stage_completed(stage_id: String)
signal campaign_progress_updated(chapter_id: String, progress: float)
var campaigns_data: Dictionary
var unlocked_stages: Array        # e.g. ["1_1"]
var completed_stages: Array       # e.g. ["1_1", "1_2"]
func load_campaigns_data() -> void
func get_stage_data(stage_id: String) -> Dictionary
func complete_stage(stage_id: String) -> void
func is_stage_unlocked(stage_id: String) -> bool
func is_stage_completed(stage_id: String) -> bool
func save_progress() -> void
func load_progress() -> void
```

From autoloads/GameManager.gd:
```gdscript
signal health_changed(new_health: int, max_health: int)
signal player_died()
signal game_won()
signal stage_completed(stage_id: String)
var current_stage_id: String
var current_waves: int
var boss_id: String
var player_current_health: int
var player_max_health: int
func start_game() -> void
func end_game(won: bool) -> void
func take_player_damage(damage: int) -> void
func complete_stage() -> void
```

From scenes/ui/campaign_map.gd:
```gdscript
extends Control
var current_chapter: String
var available_chapters: Array
func load_available_chapters() -> void     # reads CampaignManager.campaigns_data
func update_chapter_display() -> void
func build_stage_buttons() -> void
func create_stage_button(stage_data: Dictionary) -> Button
func _on_stage_pressed(stage_id: String) -> void  # sets GameManager.current_stage_id, loads main.tscn
```

From data/campaigns.json (current structure):
```json
{
  "campaigns": [{
    "id": "chapter_1",
    "name": "The Awakening",
    "stages": [{
      "id": "1_1",
      "name": "Forest Edge",
      "waves": 3,
      "boss": null
    }]
  }]
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enrich campaigns.json with enemy stats, difficulty, biome, and loot data</name>
  <files>data/campaigns.json</files>
  <action>
    Expand each stage in data/campaigns.json to include enemy stats, difficulty tier, biome, and loot configuration. Add a top-level `encounters` array for quick lookup by stage_id.

    Per stage, add:
    - `difficulty`: int (1=Forest, 2=Cavern, 3=Mountain/Dark)
    - `biome`: string ("forest", "cavern", "mountain")
    - `enemy`: { type, health, attack, defense, speed }
    - `loot`: { xp, gold, gear_rarity_weights: {common, rare, legendary} }

    Enemy stat scaling per difficulty:
    - Difficulty 1: health 25-40, attack 6-12, defense 1-3, speed 8-12
    - Difficulty 2: health 45-65, attack 14-20, defense 4-8, speed 6-10
    - Difficulty 3: health 75-120, attack 22-30, defense 10-16, speed 5-8

    Keep existing `campaigns` array structure (don't break CampaignManager.load_campaigns_data()). Add new fields alongside existing ones.

    Example enriched stage:
    ```json
    {
      "id": "1_1",
      "name": "Forest Edge",
      "waves": 3,
      "boss": null,
      "difficulty": 1,
      "biome": "forest",
      "enemy": {
        "type": "Goblin Scout",
        "health": 30,
        "attack": 8,
        "defense": 2,
        "speed": 10
      },
      "loot": {
        "xp": 50,
        "gold": 25,
        "rarity_weights": {"common": 100, "rare": 0, "legendary": 0}
      }
    }
    ```

    Also add top-level `difficulty_tiers` and `biomes` metadata for the campaign map to reference:
    ```json
    {
      "difficulty_tiers": {
        "1": {"name": "Starter", "color": "#4ADE80"},
        "2": {"name": "Challenging", "color": "#FACC15"},
        "3": {"name": "Endgame", "color": "#EF4444"}
      },
      "biomes": ["forest", "cavern", "mountain"]
    }
    ```

    Boss stages should have higher stats than regular stages at the same difficulty. Final chapter (chapter_3) maps to "mountain" biome and difficulty 3.

    Do NOT change existing field names or types — only ADD new fields.
  </action>
  <verify>
    <automated>python3 -c "import json; d=json.load(open('data/campaigns.json')); stages=[s for c in d['campaigns'] for s in c['stages']]; assert all('difficulty' in s for s in stages), 'missing difficulty'; assert all('enemy' in s for s in stages), 'missing enemy'; assert all('loot' in s for s in stages), 'missing loot'; print(f'All {len(stages)} stages enriched')"</automated>
  </verify>
  <done>All 12 stages in campaigns.json have difficulty, biome, enemy stats, and loot data. Existing fields (id, name, waves, boss) are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add enemy data query methods to CampaignManager</name>
  <files>autoloads/CampaignManager.gd</files>
  <action>
    Add new methods to CampaignManager to expose enemy and difficulty data from the enriched campaigns.json. Place them after the existing `get_stage_data()` method.

    New methods:
    ```gdscript
    ## Returns enemy stats dictionary for a stage
    func get_enemy_data(stage_id: String) -> Dictionary:
      var stage = get_stage_data(stage_id)
      return stage.get("enemy", {})

    ## Returns difficulty tier (1-3) for a stage
    func get_difficulty_tier(stage_id: String) -> int:
      var stage = get_stage_data(stage_id)
      return stage.get("difficulty", 1)

    ## Returns biome name for a chapter
    func get_biome(chapter_id: String) -> String:
      for chapter in campaigns_data.get("campaigns", []):
        if chapter.get("id") == chapter_id:
          var stages = chapter.get("stages", [])
          if stages.size() > 0:
            return stages[0].get("biome", "forest")
      return "forest"

    ## Returns loot configuration for a stage
    func get_loot_config(stage_id: String) -> Dictionary:
      var stage = get_stage_data(stage_id)
      return stage.get("loot", {})

    ## Returns difficulty tier metadata (name, color)
    func get_difficulty_metadata() -> Dictionary:
      return campaigns_data.get("difficulty_tiers", {})

    ## Returns stages filtered by difficulty
    func get_stages_by_difficulty(difficulty: int) -> Array:
      var result = []
      for chapter in campaigns_data.get("campaigns", []):
        for stage in chapter.get("stages", []):
          if stage.get("difficulty", 1) == difficulty:
            result.append(stage)
      return result
    ```

    Add type hints to all parameters and return types per GDScript style guide. Use `push_warning()` if stage_id not found (not `push_error()` — non-critical).
  </action>
  <verify>
    <automated>gdlint autoloads/CampaignManager.gd</automated>
  </verify>
  <done>CampaignManager exposes get_enemy_data(), get_difficulty_tier(), get_biome(), get_loot_config(), get_difficulty_metadata(), and get_stages_by_difficulty() with proper type hints.</done>
</task>

<task type="auto">
  <name>Task 3: Enhance campaign map with difficulty indicators, lock visuals, and encounter data passthrough</name>
  <files>scenes/ui/campaign_map.gd</files>
  <action>
    Update campaign_map.gd to display difficulty and lock state information on stage buttons, and pass encounter data to GameManager when selecting a stage.

    Changes:

    1. Add difficulty color lookup using CampaignManager.get_difficulty_metadata():
    ```gdscript
    var _difficulty_colors: Dictionary = {}
    ```

    2. In `load_available_chapters()` or `_ready()`, load difficulty metadata:
    ```gdscript
    _difficulty_colors = campaign_manager.get_difficulty_metadata()
    ```

    3. Update `create_stage_button(stage_data)` to:
       - Add difficulty indicator: prefix with difficulty number + color (e.g., "[1]" green, "[2]" yellow, "[3]" red)
       - Show lock state: if not unlocked, disable button and add "(Locked)" suffix, reduce alpha to 0.5
       - Show completed state: add checkmark prefix or different background color
       - Add tooltip with enemy name from `campaign_manager.get_enemy_data(stage_data.id)`

    4. Update `_on_stage_pressed(stage_id)` to store encounter data:
    ```gdscript
    func _on_stage_pressed(stage_id: String) -> void:
      if not campaign_manager.is_stage_unlocked(stage_id):
        return  # ignore locked stage clicks

      var enemy_data = campaign_manager.get_enemy_data(stage_id)
      var difficulty = campaign_manager.get_difficulty_tier(stage_id)

      GameManager.current_stage_id = stage_id
      GameManager.current_waves = get_campaign_stages(current_chapter).size()
      GameManager.current_encounter_data = enemy_data
      GameManager.current_difficulty = difficulty

      # existing boss logic
      var stage = campaign_manager.get_stage_data(stage_id)
      GameManager.boss_id = stage.get("boss", "")

      get_tree().change_scene_to_file(MAIN_SCENE)
    ```

    5. Add `GameManager.current_encounter_data` and `GameManager.current_difficulty` properties if they don't exist (check GameManager.gd first, add as `var current_encounter_data: Dictionary = {}` and `var current_difficulty: int = 1`).

    Keep existing chapter navigation and signal connections intact. Only enhance stage button creation and stage selection.
  </action>
  <verify>
    <automated>gdlint scenes/ui/campaign_map.gd && gdlint autoloads/GameManager.gd</automated>
  </verify>
  <done>Campaign map shows difficulty-colored stage buttons, lock/complete states, and passes enemy data + difficulty to GameManager on stage selection.</done>
</task>

</tasks>

<verification>
1. Parse validation: `godot --headless --quit` exits with 0 errors
2. gdlint passes on all modified files
3. campaigns.json validates with all 12 stages having difficulty, enemy, loot fields
4. CampaignManager methods return correct data for known stage IDs
5. Campaign map displays difficulty indicators and lock states
</verification>

<success_criteria>
- [ ] All 12 stages enriched with difficulty (1-3), biome, enemy stats, loot config
- [ ] CampaignManager exposes 6 new query methods with type hints
- [ ] Campaign map shows difficulty color per stage button
- [ ] Locked stages are visually distinct and non-clickable
- [ ] Selecting a stage stores enemy data in GameManager.current_encounter_data
- [ ] gdlint passes, godot parse validation passes
</success_criteria>

<output>
After completion, create `.planning/milestones/v3.4.0-phases/phase-02-01-SUMMARY.md`
</output>
