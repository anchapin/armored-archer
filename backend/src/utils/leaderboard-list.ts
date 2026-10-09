/**
 * Leaderboard listing helpers.
 *
 * The Nakama JS runtime exposes `nk.leaderboardRecordsList` (plural), which
 * returns `{ records, ownerRecords, nextCursor }` and caps `limit` at 1000.
 * Older code called a non-existent `leaderboardRecordList` that only the Jest
 * mocks implemented, so every leaderboard read threw
 * "Object has no member 'leaderboardRecordList'" on a real server. These
 * helpers call the real API and still accept the legacy array shape the unit
 * test mocks return.
 */
import { Runtime } from '../types/nakama';
import { LeaderboardRecord } from '../types/shared';

const MAX_PAGE = 1000;

interface LeaderboardPage {
  records: LeaderboardRecord[];
  nextCursor: string;
}

type ListFn = (
  id: string,
  owners: string[],
  limit: number,
  cursor: string,
  expiry: number
) => unknown;

function resolveListFn(nk: Runtime.Nakama): ListFn {
  const anyNk = nk as unknown as Record<string, ListFn | undefined>;
  const fn = anyNk.leaderboardRecordsList ?? anyNk.leaderboardRecordList;
  if (!fn) {
    throw new Error('Nakama runtime has no leaderboardRecordsList');
  }
  return (id, owners, limit, cursor, expiry) => fn.call(nk, id, owners, limit, cursor, expiry);
}

function toPage(res: unknown, ownerIds: string[], limit: number): LeaderboardPage {
  if (Array.isArray(res)) {
    // Legacy mock shape: plain array, rank-based cursor.
    const last = res[res.length - 1] as LeaderboardRecord | undefined;
    const nextCursor = res.length >= limit ? String(last?.rank || '') : '';
    return { records: res as LeaderboardRecord[], nextCursor };
  }
  const list = (res || {}) as {
    records?: LeaderboardRecord[] | null;
    ownerRecords?: LeaderboardRecord[] | null;
    nextCursor?: string | null;
  };
  const records = ownerIds.length > 0 ? list.ownerRecords : list.records;
  return { records: records || [], nextCursor: list.nextCursor || '' };
}

/** One page of leaderboard records (or the given owners' records). */
export function listLeaderboardRecords(
  nk: Runtime.Nakama,
  leaderboardId: string,
  ownerIds: string[] = [],
  limit = 100,
  cursor = '',
  expiry = 0
): LeaderboardPage {
  const pageLimit = Math.max(1, Math.min(limit, MAX_PAGE));
  let res: unknown;
  try {
    res = resolveListFn(nk)(leaderboardId, ownerIds, pageLimit, cursor, expiry);
  } catch (e) {
    // A season whose leaderboard has not been created yet simply has no records.
    if (/leaderboard not found/i.test(String((e as Error)?.message ?? e))) {
      return { records: [], nextCursor: '' };
    }
    throw e;
  }
  return toPage(res, ownerIds, pageLimit);
}

/** Leaderboard records up to `maxRecords`, following cursors page by page. */
export function listAllLeaderboardRecords(
  nk: Runtime.Nakama,
  leaderboardId: string,
  maxRecords = 10000,
  pageSize = 500
): LeaderboardRecord[] {
  let all: LeaderboardRecord[] = [];
  let cursor = '';
  do {
    const page = listLeaderboardRecords(nk, leaderboardId, [], pageSize, cursor, 0);
    all = all.concat(page.records);
    cursor = page.records.length > 0 ? page.nextCursor : '';
  } while (cursor !== '' && all.length < maxRecords);
  return all.slice(0, maxRecords);
}
