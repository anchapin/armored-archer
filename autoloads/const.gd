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
