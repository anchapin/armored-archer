import { getRevenueCatApiBase } from '../store';

describe('receipt fixture route gating', () => {
  it.each([{}, { CI_RECEIPT_FIXTURE: 'true' }, { TEST_FIXTURE_RPCS_ENABLED: 'true' }])(
    'keeps the production provider without both disposable fixture gates: %j',
    (env) => {
      expect(getRevenueCatApiBase(env)).toBe('https://api.revenuecat.com/v1');
    }
  );
  it('uses only the fixed isolated service when both fixture gates are present', () => {
    expect(
      getRevenueCatApiBase({ TEST_FIXTURE_RPCS_ENABLED: 'true', CI_RECEIPT_FIXTURE: 'true' })
    ).toBe('https://receipt-fixture:8080/v1');
  });
});
