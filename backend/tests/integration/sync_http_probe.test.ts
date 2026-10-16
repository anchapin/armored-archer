import { testHelper, TestAccount } from './helpers';

/**
 * Issue #1423 spike: prove that `nk.httpRequest` works synchronously on the
 * real Nakama goja runtime. ADR-0008 rules out fetch/async I/O; the merged
 * RevenueCat server-side verification (receipt validation, restore,
 * subscription/refund checks) depends on the sync host call actually
 * working in production. The fixture RPC `armored_archer/diag_http_probe`
 * (registered only under TEST_FIXTURE_RPCS_ENABLED=true) GETs Nakama's own
 * loopback healthcheck and returns the HTTP status code.
 */
describe('Sync HTTP on the goja runtime (#1423 spike)', () => {
  let player: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    player = await testHelper.createTestAccount('diag_http_probe');
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  test('diag_http_probe returns a real HTTP status from a synchronous call', async () => {
    const response = await player.client.rpc(player.session, 'armored_archer/diag_http_probe', {});
    const result: any = response.payload;

    expect(result.success).toBe(true);
    // Nakama's /healthcheck answers 200; any real 2xx/4xx code still proves
    // the synchronous host call completed, but 200 is what we expect here.
    expect(result.code).toBe(200);
  }, 60000);
});
