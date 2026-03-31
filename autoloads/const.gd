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

# --- Combat ---
const CRITICAL_HIT_CHANCE: float = 0.15
const CRITICAL_HIT_MULTIPLIER: float = 2.0
const BASE_DAMAGE: int = 10

# --- UI ---
const DEFAULT_ANIMATION_DURATION: float = 0.3
const FAST_ANIMATION_DURATION: float = 0.15
const SLOW_ANIMATION_DURATION: float = 0.5
const UI_TRANSITION_DURATION: float = 0.25

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
