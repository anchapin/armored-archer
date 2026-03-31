import { Runtime } from '../types/nakama';
export interface PlayerStats {
    user_id: string;
    level: number;
    xp: number;
    ability_points: number;
    stats: {
        attack: number;
        defense: number;
        dodge: number;
        crit_rate: number;
    };
}
export declare function batchGetPlayerStats(nk: Runtime.Nakama, userIds: string[], logger: Runtime.Logger): Map<string, PlayerStats>;
export declare function getPlayerStatsWithCache(nk: Runtime.Nakama, userId: string, logger: Runtime.Logger): PlayerStats;
export declare function invalidatePlayerStatsCache(userId: string, logger: Runtime.Logger): void;
