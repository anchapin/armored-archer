import { Runtime } from '../types/nakama';
import { getStorageRawValue, toStorageValue } from './storage-helpers';

const SYSTEM_OWNER = '00000000-0000-0000-0000-000000000000';
const DURATION_MS = 28 * 24 * 60 * 60 * 1000;

export interface CurrentSeason {
  season_id: string;
  season_number: number;
  start_time: number;
  end_time: number;
  status: string;
  duration_weeks: number;
}

/** Use the published season, including an in-flight rollover, across all VMs. */
export function resolveCurrentSeason(nk?: Runtime.Nakama): CurrentSeason {
  if (nk) {
    const objects = nk.storageRead([
      { collection: 'season_state', key: 'current', userId: SYSTEM_OWNER },
    ]);
    if (objects.length) {
      const raw = getStorageRawValue(objects[0].value);
      const season = raw ? (JSON.parse(raw) as CurrentSeason) : null;
      if (
        !season ||
        !/^season_\d+$/.test(season.season_id) ||
        !Number.isInteger(season.season_number)
      ) {
        throw new Error('Invalid current season state');
      }
      return season;
    }
  }
  // Bootstrap only. Once a rollover publishes state, wall clock cannot undo it.
  const number = Math.floor(Date.now() / DURATION_MS) + 1;
  const start = (number - 1) * DURATION_MS;
  return {
    season_id: `season_${number}`,
    season_number: number,
    start_time: start,
    end_time: start + DURATION_MS,
    status: 'active',
    duration_weeks: 4,
  };
}

/** Publish only after the successor's leaderboard and seed writes complete. */
export function publishCurrentSeason(nk: Runtime.Nakama, season: CurrentSeason): void {
  nk.storageWrite([
    {
      collection: 'season_state',
      key: 'current',
      userId: SYSTEM_OWNER,
      value: toStorageValue(season),
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
}

/** Store season metadata under the operator's existing record ownership. */
export function saveSeasonInfo(nk: Runtime.Nakama, ownerId: string, season: CurrentSeason): void {
  nk.storageWrite([
    {
      collection: 'seasons',
      key: season.season_id,
      userId: ownerId,
      value: toStorageValue(season),
    },
  ]);
}
