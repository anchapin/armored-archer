/**
 * Player statistics data structure used across the game.
 *
 * @property level - Current player level
 * @property xp - Current experience points
 * @property ability_points - Available ability points for stat upgrades
 * @property stats - Player combat statistics
 */
export interface PlayerStats {
  level: number;
  xp: number;
  ability_points?: number;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
}

/**
 * Turn data structure for match state.
 *
 * @property action_type - Type of action (e.g., "shoot")
 * @property angle - Shot angle in radians
 * @property power - Shot power (0-1)
 * @property [key: string] - Additional dynamic properties for turn-specific data
 */
export interface TurnData {
  action_type: string;
  angle: number;
  power: number;
  [key: string]: unknown;
}
