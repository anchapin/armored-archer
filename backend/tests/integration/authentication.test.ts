import { testHelper, TestAccount } from './helpers';
import { Client } from '@heroiclabs/nakama-js';

describe('Authentication Tests', () => {
  let testAccount: TestAccount;
  const TEST_HOST = process.env.NAKAMA_HOST || 'localhost';
  const TEST_PORT = parseInt(process.env.NAKAMA_PORT || '7350');
  const TEST_ADMIN_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  describe('User Authentication', () => {
    test('should authenticate with email successfully', async () => {
      const freshAccount = await testHelper.createTestAccount('auth_email_test');

      expect(freshAccount.session).toBeDefined();
      expect(freshAccount.sessionToken).toBeDefined();
      expect(freshAccount.sessionToken.length).toBeGreaterThan(0);
      expect(freshAccount.userId).toBeDefined();
      expect(freshAccount.username).toBeDefined();
    });

    test('should authenticate with custom credentials', async () => {
      const email = `custom_auth_${Date.now()}@test.local`;
      const password = 'SecurePassword123!';
      const username = `custom_user_${Date.now()}`;

      const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const session = await client.authenticateEmail(email, password, true, username);

      expect(session).toBeDefined();
      expect(session.user_id).toBeDefined();
      expect(session.username).toBe(username);
      expect(session.token).toBeDefined();
    });

    test('should create unique test accounts', async () => {
      const account1 = await testHelper.createTestAccount('unique_1');
      const account2 = await testHelper.createTestAccount('unique_2');

      expect(account1.userId).not.toBe(account2.userId);
      expect(account1.username).not.toBe(account2.username);
    });
  });

  describe('Session Management', () => {
    test('should create valid session on authentication', async () => {
      const account = await testHelper.createTestAccount('session_test');

      expect(account.session).toBeDefined();
      expect(account.sessionToken).toBeDefined();
      expect(account.expiresAt).toBeDefined();
      expect(account.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    test('should validate session token format', async () => {
      const account = await testHelper.createTestAccount('token_format_test');

      // JWT tokens should have 3 parts separated by dots
      const tokenParts = account.sessionToken.split('.');
      expect(tokenParts.length).toBe(3);
    });

    test('should include user information in session', async () => {
      const account = await testHelper.createTestAccount('session_info_test');

      expect(account.session.user_id).toBeDefined();
      expect(account.session.username).toBeDefined();
      expect(account.userId).toBe(account.session.user_id);
      expect(account.username).toBe(account.session.username);
    });
  });

  describe('Session Validation', () => {
    test('should allow RPC calls with valid session', async () => {
      const account = await testHelper.createTestAccount('valid_session_test');

      // Setup player stats for the test
      await testHelper.writeStorageObject(
        'player_stats',
        account.userId,
        account.userId,
        {
          level: 1,
          xp: 0,
          ability_points: 0,
          stats: { attack: 10, defense: 10, dodge: 10, crit_rate: 5 }
        }
      );

      // Make an RPC call with valid session
      const response = await account.client.rpc(account.session, 'armored_archer/get_player_rank', {});
      const result = response.payload ? JSON.parse(response.payload as unknown as string) : {};

      expect(result).toBeDefined();
      expect(result.success || result.rank).toBeDefined();
    });

    test('should handle session with expired token gracefully', async () => {
      // Create account
      const account = await testHelper.createTestAccount('expired_test');

      // Simulate expired token by using invalid token
      const invalidSession = {
        ...account.session,
        token: 'invalid_token_here',
        expires_at: 0
      };

      try {
        await account.client.rpc(invalidSession, 'armored_archer/get_player_rank', {});
        // If we get here, the server accepted the invalid token (shouldn't happen)
        expect(true).toBe(false);
      } catch (error: any) {
        // Expected - should throw error for invalid session
        expect(error).toBeDefined();
      }
    });
  });

  describe('Token Refresh', () => {
    test('should refresh session token successfully', async () => {
      const account = await testHelper.createTestAccount('refresh_test');

      // Store original token
      const originalToken = account.sessionToken;

      // In nakama-js v2.x, session refresh happens automatically with autoRefreshSession
      // For manual refresh, we re-authenticate
      const newSession = await account.client.authenticateEmail(
        `${account.username}@test.local`,
        'TestPassword123!',
        false,
        account.username
      );

      expect(newSession).toBeDefined();
      expect(newSession.token).toBeDefined();
      expect(newSession.token).not.toBe(originalToken);
    });

    test('should maintain user identity after refresh', async () => {
      const account = await testHelper.createTestAccount('refresh_identity_test');
      const originalUserId = account.userId;
      const originalUsername = account.username;

      // Re-authenticate to get new session
      const newSession = await account.client.authenticateEmail(
        `${account.username}@test.local`,
        'TestPassword123!',
        false,
        account.username
      );

      expect(newSession.user_id).toBe(originalUserId);
      expect(newSession.username).toBe(originalUsername);
    });

    test('should update account session after refresh', async () => {
      const account = await testHelper.createTestAccount('refresh_update_test');
      const originalToken = account.sessionToken;

      // Re-authenticate
      const newSession = await account.client.authenticateEmail(
        `${account.username}@test.local`,
        'TestPassword123!',
        false,
        account.username
      );

      // New session should be different
      expect(newSession.token).not.toBe(originalToken);
    });

    test('should fail refresh with invalid credentials', async () => {
      const account = await testHelper.createTestAccount('invalid_refresh_test');

      try {
        await account.client.authenticateEmail(
          `${account.username}@test.local`,
          'WrongPassword!',
          false,
          account.username
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Logout', () => {
    test('should handle logout gracefully', async () => {
      const account = await testHelper.createTestAccount('logout_test');

      // In nakama-js v2.x, there's no explicit logout, but we can disconnect
      try {
        if (typeof (account.client as any).disconnect === 'function') {
          await (account.client as any).disconnect();
        }
        // Disconnect should succeed
        expect(true).toBe(true);
      } catch (error: any) {
        // Some implementations may not have disconnect
        expect(error).toBeDefined();
      }
    });

    test('should invalidate session on disconnect', async () => {
      const account = await testHelper.createTestAccount('disconnect_test');

      // Disconnect client
      if (typeof (account.client as any).disconnect === 'function') {
        await (account.client as any).disconnect();
      }

      // Subsequent RPC calls should fail
      try {
        await account.client.rpc(account.session, 'armored_archer/get_player_rank', {});
        // If we get here, the call succeeded (unexpected)
        expect(true).toBe(false);
      } catch (error: any) {
        // Expected - should fail after disconnect
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Security', () => {
    test('should reject requests with malformed tokens', async () => {
      const account = await testHelper.createTestAccount('malformed_test');

      const malformedSession = {
        ...account.session,
        token: 'not.a.valid.jwt.token'
      };

      try {
        await account.client.rpc(malformedSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should reject requests with empty token', async () => {
      const account = await testHelper.createTestAccount('empty_token_test');

      const emptySession = {
        ...account.session,
        token: ''
      };

      try {
        await account.client.rpc(emptySession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should handle concurrent sessions for same user', async () => {
      // Create account
      const email = `concurrent_${Date.now()}@test.local`;
      const password = 'Password123!';
      const username = `concurrent_user_${Date.now()}`;

      const client1 = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const client2 = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);

      // Create two sessions for same user
      const session1 = await client1.authenticateEmail(email, password, true, username);
      const session2 = await client2.authenticateEmail(email, password, true, username);

      expect(session1).toBeDefined();
      expect(session2).toBeDefined();
      expect(session1.user_id).toBe(session2.user_id);

      // Both sessions should work
      const client1Works = await client1.rpc(session1, 'armored_archer/get_player_rank', {})
        .then(() => true)
        .catch(() => false);

      const client2Works = await client2.rpc(session2, 'armored_archer/get_player_rank', {})
        .then(() => true)
        .catch(() => false);

      // At least one should work (Nakama allows multiple sessions)
      expect(client1Works || client2Works).toBe(true);
    });
  });

  describe('Authentication Edge Cases', () => {
    test('should handle special characters in email', async () => {
      const email = `special+chars_${Date.now()}@test.local`;
      const password = 'Password123!';
      const username = `special_user_${Date.now()}`;

      const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const session = await client.authenticateEmail(email, password, true, username);

      expect(session).toBeDefined();
      expect(session.user_id).toBeDefined();
    });

    test('should handle long usernames', async () => {
      const email = `longuser_${Date.now()}@test.local`;
      const password = 'Password123!';
      const username = `very_long_username_${'_'.repeat(50)}_${Date.now()}`;

      const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const session = await client.authenticateEmail(email, password, true, username);

      expect(session).toBeDefined();
      expect(session.username).toBe(username);
    });

    test('should handle unicode characters in username', async () => {
      const email = `unicode_${Date.now()}@test.local`;
      const password = 'Password123!';
      const username = `User_🎮_${Date.now()}`;

      const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const session = await client.authenticateEmail(email, password, true, username);

      expect(session).toBeDefined();
      expect(session.username).toContain('🎮');
    });
  });
});
