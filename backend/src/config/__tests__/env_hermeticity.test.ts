/**
 * Regression guard for issue #1427: jest results must depend only on the
 * committed tree, never on a developer's local `backend/.env`.
 *
 * `src/config/index.ts` calls `loadEnvironment()` at module import, which
 * reads `.env` off disk and backfills every *falsy* key (`if (!process.env[key])`).
 * A local `.env` therefore supplied `HMAC_SECRET` / `REVENUECAT_*` and flipped
 * the 4 tests that assert behaviour when those secrets are absent. CI provisions
 * no `.env`, so the coupling was invisible from CI evidence alone and #1171 was
 * previously closed on it.
 *
 * `jest.setup.js` sets `SKIP_ENV_LOADING` to make `loadEnvironment()` inert.
 * The first assertion is the one that matters: if that line is ever removed,
 * the assertions below start depending on the developer's machine again.
 */

describe('jest environment hermeticity (issue #1427)', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('sets SKIP_ENV_LOADING so config loadEnvironment() is inert', () => {
    expect(process.env.SKIP_ENV_LOADING).toBe('true');
  });

  it('does not inherit secrets from the developer environment', () => {
    // Absent rather than a placeholder: tests that need a value set it
    // themselves so the "not configured" path stays genuinely exercised.
    expect(process.env.HMAC_SECRET).toBeUndefined();
    expect(process.env.REVENUECAT_SECRET_KEY).toBeUndefined();
    expect(process.env.REVENUECAT_WEBHOOK_SECRET).toBeUndefined();
  });

  it('importing the config module cannot backfill secrets from a .env on disk', () => {
    // The falsy `''` matters: loadEnvironment() backfills empty strings too,
    // which is what made `validateRequiredConfig` silently pass locally.
    process.env.HMAC_SECRET = '';
    process.env.REVENUECAT_SECRET_KEY = '';

    jest.resetModules();
    require('../index');

    expect(process.env.HMAC_SECRET).toBe('');
    expect(process.env.REVENUECAT_SECRET_KEY).toBe('');

    delete process.env.HMAC_SECRET;
    delete process.env.REVENUECAT_SECRET_KEY;
  });
});
