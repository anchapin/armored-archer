## Global constants for Armored Archer.
## Contains centralized constants used across multiple autoloads and scenes.
## Avoid duplicating constants here - only add constants used in 3+ files.

extends Node

# --- Game Configuration ---
const DEFAULT_PLAYER_HEALTH: int = 100
const DEFAULT_PLAYER_SPEED: float = 300.0
const MAX_STAGES: int = 50
const WAVES_PER_STAGE: int = 3

# --- Network ---
const DEFAULT_SERVER_URL: String = "http://localhost:7350"
const API_VERSION: String = "v2"
const REQUEST_TIMEOUT: float = 10.0
# Bounded timeout for the entire login/auth sequence (issue #908 acceptance: ≤15s)
const MAX_AUTH_DURATION_SEC: float = 12.0
# Exponential backoff retry delays (issue #908 acceptance: 1s/2s/4s — 3 attempts)
const AUTH_RETRY_DELAYS: Array = [1.0, 2.0, 4.0]
# Bound on the pre-auth health probe (issue #908 health-gate)
const HEALTH_CHECK_TIMEOUT_SEC: float = 4.0
const HEALTH_GATE_PATH: String = "/v2/health"
const DEVICE_AUTH_PATH: String = "/v2/account/authenticate/device"
const SESSION_REFRESH_PATH: String = "/v2/account/session/refresh"
# Default server key — must match backend/data/nakama.yml runtime.http_key
const DEFAULT_SERVER_KEY: String = "defaultkey"

# --- Combat ---
const CRITICAL_HIT_CHANCE: float = 0.15
const CRITICAL_HIT_MULTIPLIER: float = 2.0
const BASE_DAMAGE: int = 10

# --- UI ---
const DEFAULT_ANIMATION_DURATION: float = 0.3
const FAST_ANIMATION_DURATION: float = 0.15
const SLOW_ANIMATION_DURATION: float = 0.5
const UI_TRANSITION_DURATION: float = 0.25

# --- MVP gating (issue #909) ---
# When true, the MVP-PvE slice hides PvP/Shop/BuyGems from main menu and
# gates any other UI path that reaches PvP, Seasons, Leaderboard, or Shop
# flows (kept reachable for MVP-2 by flipping the flag).
const MVP_PVE_ONLY: bool = true

# --- Effects ---
const DAMAGE_POPUP_DURATION: float = 1.0
const SCREEN_SHAKE_DURATION: float = 0.3
const HIT_EFFECT_DURATION: float = 0.5

# --- Equipment Slots ---
const EQUIPMENT_SLOTS: Array = ["helm", "armor", "bow", "arrow", "amulet"]

# --- Gear Rarities ---
const GEAR_RARITIES: Array = ["common", "rare", "epic", "legendary"]

# --- Input Deadzone ---
const JOYSTICK_DEADZONE: float = 0.1

# --- Performance ---
const MAX_FPS: int = 60
const TARGET_FRAME_TIME: float = 1.0 / MAX_FPS

# --- Animation Names (issue #913) ---
# Used by 7 Ch1 characters (player, 4 archetypes, 2 bosses) — see SpriteFrames .tres
const ANIM_IDLE: StringName = &"idle"
const ANIM_WALK: StringName = &"walk"
const ANIM_ATTACK: StringName = &"attack"
const ANIM_DEATH: StringName = &"death"
const ANIM_DRAW: StringName = &"draw"
const ANIM_RELEASE: StringName = &"release"
const ANIM_INTRO: StringName = &"intro"
const DEFAULT_ANIM_FPS: float = 8.0
const DEATH_ANIM_FPS: float = 6.0

# --- Sound event names (issue #914) ---
# Centralized event-name strings routed through AudioManager.play_event().
# Used by callers in base_enemy, boss scripts, spawner, GameManager,
# CombatJuiceManager, and ArcheryBaseButton so the inventory never goes silent.
const SOUND_ARROW_SHOT: String = "arrow_shot"
const SOUND_ARROW_HIT: String = "arrow_hit"
const SOUND_ARROW_KILL: String = "arrow_kill"
const SOUND_ARCHETYPE_DEATH_GOBLIN: String = "archetype_death_goblin"
const SOUND_ARCHETYPE_DEATH_WOLF: String = "archetype_death_wolf"
const SOUND_ARCHETYPE_DEATH_GUARDIAN: String = "archetype_death_guardian"
const SOUND_ARCHETYPE_DEATH_ELEMENTAL: String = "archetype_death_elemental"
const SOUND_BOSS_INTRO: String = "boss_intro"
const SOUND_BOSS_DEATH: String = "boss_death"
const SOUND_WAVE_CLEAR: String = "wave_clear"
const SOUND_STAGE_WIN: String = "stage_win"
const SOUND_STAGE_LOSE: String = "stage_lose"
const SOUND_LOOT_PICKUP: String = "loot_pickup"
const SOUND_UI_CLICK: String = "ui_click"

# --- Default music tracks (issue #914) ---
# Files are procurement-pending (issue #912). When missing, AudioManager logs
# a warning and skips playback — silence is acceptable while pending.
const MENU_MUSIC_PATH: String = "res://assets/audio/music/menu_loop.ogg"
const COMBAT_MUSIC_PATH: String = "res://assets/audio/music/combat_loop.ogg"
const INTRO_ANIM_FPS: float = 4.0
