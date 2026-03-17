/**
 * Player statistics data structure used across the game.
 *
 * @property level - Current player level
 * @property xp - Current experience points
 * @property stats - Player combat statistics
 */
export interface PlayerStats {
    level: number;
    xp: number;
    stats: {
        attack: number;
        defense: number;
        dodge: number;
        crit_rate: number;
    };
}
/**
 * Generic turn data structure for match state.
 *
 * @property [key: string] - Dynamic properties for turn-specific data
 */
export interface TurnData {
    [key: string]: unknown;
}
