import { Runtime } from '../src/types/nakama';
import { OfficialNakamaMethod } from '../src/types/nakama-api-methods';
import { createMockNakama } from '../src/__mocks__/nakama';

// Compile-only regressions. An unused @ts-expect-error fails this check.
const mock = createMockNakama();
mock.sqlQuery('SELECT 1');
mock.sqlExec('UPDATE example SET value = 1');
// @ts-expect-error Nakama has sqlQuery/sqlExec, never dbQuery.
mock.dbQuery('SELECT 1');
// @ts-expect-error The official method is plural.
mock.leaderboardRecordList('season');
// @ts-expect-error Invented methods must not enter the official API surface.
const invented: OfficialNakamaMethod = 'dbQuery';
const valid: OfficialNakamaMethod = 'leaderboardRecordsList';
const complete: Record<keyof Runtime.Nakama, unknown> = mock;
const extra = {
  ...mock,
  // @ts-expect-error The same exact key contract checks the shared factory.
  dbQuery: () => [],
} satisfies Record<keyof Runtime.Nakama, unknown>;
void [invented, valid, complete, extra];
