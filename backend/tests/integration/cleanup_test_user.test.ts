import { testHelper, TestAccount } from './helpers';
import { parseRpcPayload } from './rpc_payload';

const RPC = 'armored_archer/cleanup_test_user';

describe('test cleanup owner isolation and completed deletion', () => {
  let owner: TestAccount;
  let foreign: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    owner = await testHelper.createTestAccount('cleanup_owner');
    foreign = await testHelper.createTestAccount('cleanup_foreign');
    for (const account of [owner, foreign]) {
      await testHelper.writeStorageObject('player_stats', account.userId, account.userId, {
        level: 1,
      });
      await testHelper.sql(
        'INSERT INTO boss_defeats (user_id, boss_id, defeat_count) VALUES ($1, $2, 1)',
        [account.userId, 'cleanup_probe_boss']
      );
    }
  });

  afterAll(async () => {
    const ids = [owner?.userId, foreign?.userId].filter(Boolean);
    await testHelper.sql('DELETE FROM boss_defeats WHERE user_id = ANY($1::text[])', [ids]);
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  it('rejects another owner and completes own deletion before acknowledging success', async () => {
    const denied = await owner.client.rpc(owner.session, RPC, { user_id: foreign.userId });
    expect(parseRpcPayload(denied.payload)).toEqual({ success: false, error: 'not_authorized' });
    expect(
      await testHelper.sql('SELECT user_id FROM boss_defeats WHERE user_id = $1', [foreign.userId])
    ).toHaveLength(1);

    const result = await owner.client.rpc(owner.session, RPC, { user_id: owner.userId });
    expect(parseRpcPayload(result.payload)).toEqual({
      success: true,
      user_id: owner.userId,
      async: false,
    });
    expect(
      await testHelper.sql('SELECT user_id FROM boss_defeats WHERE user_id = $1', [owner.userId])
    ).toHaveLength(0);
    expect(
      await testHelper.sql('SELECT user_id FROM storage WHERE user_id = $1', [owner.userId])
    ).toHaveLength(0);
    expect(
      await testHelper.sql('SELECT user_id FROM boss_defeats WHERE user_id = $1', [foreign.userId])
    ).toHaveLength(1);
  });
});
