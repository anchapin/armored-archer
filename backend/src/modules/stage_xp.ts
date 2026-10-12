/** Persist only server-calculated stage XP, after the completion claim. */
import { Runtime } from '../types/nakama';
import { invalidatePlayerStatsCache } from '../utils/db_optimizer';
import { getStorageRawValue, toStorageValue } from '../utils/storage-helpers';
import { incrementPlayerLevelUp } from './metrics';
import type { PlayerStats } from './rpg_system';
import { getLevelForXp } from './xp_manager';

export function grantStageXP(
  nk: Runtime.Nakama,
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  xp: number
): void {
  if (!Number.isSafeInteger(xp) || xp <= 0) throw new Error('Invalid server stage XP');
  // A version conflict fails closed. The claim remains consumed; never report
  // awarded XP when its storage write failed, or overwrite concurrent stats.
  const [stored] = nk.storageRead([
    { collection: 'player_stats', key: ctx.userId, userId: ctx.userId },
  ]);
  const stats: PlayerStats = stored
    ? JSON.parse(getStorageRawValue(stored.value) ?? '')
    : {
        ...initialStageStats(ctx.userId),
      };
  validateStats(stats, ctx.userId);
  stats.user_id = ctx.userId;
  const totalXP = stats.xp + xp;
  if (!Number.isSafeInteger(totalXP)) throw new Error('Player XP overflow');
  const levelsGained = Math.max(0, getLevelForXp(totalXP) - stats.level);
  stats.xp = totalXP;
  stats.level = getLevelForXp(totalXP);
  stats.ability_points += levelsGained;
  nk.storageWrite([
    {
      collection: 'player_stats',
      key: ctx.userId,
      userId: ctx.userId,
      value: toStorageValue(stats),
      version: stored?.version ?? '*',
      permissionRead: 1,
      permissionWrite: 0,
    },
  ]);
  invalidatePlayerStatsCache(ctx.userId, logger);
  for (let i = 0; i < levelsGained; i++) incrementPlayerLevelUp();
}

function validateStats(stats: PlayerStats, userId: string): void {
  if (
    (stats.user_id !== undefined && stats.user_id !== userId) ||
    !Number.isSafeInteger(stats.xp) ||
    stats.xp < 0 ||
    !Number.isSafeInteger(stats.level) ||
    stats.level < 1 ||
    !Number.isSafeInteger(stats.ability_points) ||
    stats.ability_points < 0 ||
    !stats.stats
  ) {
    throw new Error('Invalid stored player stats');
  }
}

function initialStageStats(userId: string): PlayerStats {
  return {
    user_id: userId,
    level: getLevelForXp(0),
    xp: 0,
    ability_points: 0,
    stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 },
  };
}
