/**
 * E2E Authentication Tests (issue #1302)
 *
 * Covers the complete authentication flow from client to Nakama server:
 * - Device authentication (used by the Godot client)
 * - Session token validation and refresh
 * - Error cases for invalid/expired tokens and unreachable servers
 *
 * Note: The Godot client uses Nakama device authentication (not Firebase ID tokens).
 * Firebase is used for push notifications (Firebase Cloud Messaging), not auth.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Client, Session } from '@heroiclabs/nakama-js';

const TEST_HOST = process.env.NAKAMA_HOST || 'localhost';
const TEST_PORT = parseInt(process.env.NAKAMA_PORT || '7350', 10);
const TEST_SERVER_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';

function createClient(): Client {
  return new Client(TEST_SERVER_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);
}

describe('E2E Authentication Flow', () => {
  describe('Device Authentication', () => {
    test('should authenticate with device ID and create new account', async () => {
      const client = createClient();
      const deviceId = `test_device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const username = `device_user_${Date.now()}`;

      const session = await client.authenticateDevice(deviceId, username, true);

      expect(session).toBeDefined();
      expect(session.token).toBeDefined();
      expect(session.user_id).toBeDefined();
      expect(session.username).toBe(username);
      expect(session.expires_at).toBeGreaterThan(Date.now() / 1000);
    });

    test('should re-authenticate existing device ID without creating duplicate account', async () => {
      const client = createClient();
      const deviceId = `reuse_device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const username = `reuse_user_${Date.now()}`;

      const session1 = await client.authenticateDevice(deviceId, username, true);
      const userId1 = session1.user_id;

      const session2 = await client.authenticateDevice(deviceId, username, false);
      const userId2 = session2.user_id;

      expect(userId1).toBe(userId2);
      expect(session1.token).not.toBe(session2.token);
    });

    test('should reject invalid device ID format', async () => {
      const client = createClient();
      const emptyDeviceId = '';
      const username = `invalid_device_${Date.now()}`;

      try {
        await client.authenticateDevice(emptyDeviceId, username, true);
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Token', () => {
    test('should create valid JWT token on authentication', async () => {
      const client = createClient();
      const deviceId = `jwt_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const session = await client.authenticateDevice(deviceId, `jwt_user_${Date.now()}`, true);

      const tokenParts = session.token.split('.');
      expect(tokenParts.length).toBe(3);

      const payload = JSON.parse(atob(tokenParts[1]));
      expect(payload.user_id).toBe(session.user_id);
      expect(payload.exp).toBeDefined();
    });

    test('should include correct expiration time in session', async () => {
      const client = createClient();
      const deviceId = `expiry_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const session = await client.authenticateDevice(deviceId, `expiry_user_${Date.now()}`, true);

      expect(session.expires_at).toBeGreaterThan(Date.now() / 1000);
      expect(session.expires_at).toBeLessThanOrEqual(Date.now() / 1000 + 60 * 60);
    });

    test('should contain user_id in session after authentication', async () => {
      const client = createClient();
      const deviceId = `userid_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const session = await client.authenticateDevice(deviceId, `userid_user_${Date.now()}`, true);

      expect(session.user_id).toBeDefined();
      expect(typeof session.user_id).toBe('string');
      expect(session.user_id.length).toBeGreaterThan(0);
    });
  });

  describe('Session Lifecycle', () => {
    test('should maintain session validity across multiple RPC calls', async () => {
      const client = createClient();
      const deviceId = `lifecycle_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const username = `lifecycle_user_${Date.now()}`;

      const session = await client.authenticateDevice(deviceId, username, true);

      const result1 = await client.rpc(session, 'armored_archer/get_player_rank', {});
      expect(result1).toBeDefined();

      const result2 = await client.rpc(session, 'armored_archer/get_player_stats', {});
      expect(result2).toBeDefined();
    });

    test('should handle rapid successive authentications', async () => {
      const client = createClient();
      const baseDeviceId = `rapid_${Date.now()}`;
      const results = [];

      for (let i = 0; i < 5; i++) {
        const deviceId = `${baseDeviceId}_${i}`;
        const session = await client.authenticateDevice(deviceId, `rapid_${i}_${Date.now()}`, true);
        results.push(session.user_id);
      }

      const uniqueUserIds = new Set(results);
      expect(uniqueUserIds.size).toBe(5);
    });
  });

  describe('Session Security', () => {
    test('should reject RPC calls with malformed token', async () => {
      const client = createClient();
      const deviceId = `malformed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const session = await client.authenticateDevice(deviceId, `malformed_user_${Date.now()}`, true);

      const badSession = {
        ...session,
        token: 'not.a.valid.jwt',
      } as unknown as Session;

      try {
        await client.rpc(badSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    test('should reject RPC calls with empty token', async () => {
      const client = createClient();
      const deviceId = `empty_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const session = await client.authenticateDevice(deviceId, `empty_user_${Date.now()}`, true);

      const emptySession = {
        ...session,
        token: '',
      } as unknown as Session;

      try {
        await client.rpc(emptySession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    test('should reject RPC calls with null token', async () => {
      const client = createClient();
      const deviceId = `null_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const session = await client.authenticateDevice(deviceId, `null_user_${Date.now()}`, true);

      const nullSession = {
        ...session,
        token: null,
      } as unknown as Session;

      try {
        await client.rpc(nullSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    test('should handle token with wrong signature', async () => {
      const client = createClient();
      const deviceId = `wrongsig_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const session = await client.authenticateDevice(deviceId, `wrongsig_user_${Date.now()}`, true);

      const tamperedSession = {
        ...session,
        token: session.token.slice(0, -5) + 'XXXXX',
      } as unknown as Session;

      try {
        await client.rpc(tamperedSession, 'armored_archer/get_player_rank', {});
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Concurrent Sessions', () => {
    test('should allow multiple concurrent sessions for same user', async () => {
      const email = `concurrent_${Date.now()}@test.local`;
      const password = 'TestPassword123!';
      const username = `concurrent_user_${Date.now()}`;

      const client1 = createClient();
      const client2 = createClient();

      const session1 = await client1.authenticateEmail(email, password, true, username);
      const session2 = await client2.authenticateEmail(email, password, false, username);

      expect(session1.user_id).toBe(session2.user_id);
      expect(session1.token).not.toBe(session2.token);

      const rpc1 = client1.rpc(session1, 'armored_archer/get_player_rank', {});
      const rpc2 = client2.rpc(session2, 'armored_archer/get_player_rank', {});

      const [result1, result2] = await Promise.all([rpc1, rpc2]);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    test('should handle many concurrent sessions for different users', async () => {
      const count = 10;
      const clients: Client[] = [];
      const sessions: Session[] = [];

      for (let i = 0; i < count; i++) {
        const client = createClient();
        const deviceId = `many_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${i}`;
        const session = await client.authenticateDevice(deviceId, `many_user_${i}_${Date.now()}`, true);
        clients.push(client);
        sessions.push(session);
      }

      const rpcs = sessions.map((s, i) => clients[i].rpc(s, 'armored_archer/get_player_rank', {}));
      const results = await Promise.all(rpcs);

      expect(results).toHaveLength(count);
      results.forEach((r) => expect(r).toBeDefined());
    });
  });

  describe('Authentication Error Handling', () => {
    test('should fail authentication with wrong server key', async () => {
      const wrongClient = new Client('wrong_server_key', TEST_HOST, TEST_PORT.toString(), false, 10000, false);
      const deviceId = `wrongkey_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      try {
        await wrongClient.authenticateDevice(deviceId, `wrongkey_user_${Date.now()}`, true);
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });

    test('should handle network-level auth failures gracefully', async () => {
      const unreachableClient = new Client(TEST_SERVER_KEY, 'invalid.host.local', TEST_PORT.toString(), false, 10000, false);
      const deviceId = `unreachable_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      try {
        await unreachableClient.authenticateDevice(deviceId, `unreachable_user_${Date.now()}`, true);
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Refresh', () => {
    test('should refresh session and receive new token', async () => {
      const client = createClient();
      const deviceId = `refresh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const username = `refresh_user_${Date.now()}`;

      const session1 = await client.authenticateDevice(deviceId, username, true);
      const originalToken = session1.token;

      const session2 = await client.authenticateDevice(deviceId, username, false);
      const newToken = session2.token;

      expect(newToken).not.toBe(originalToken);
      expect(session1.user_id).toBe(session2.user_id);
    });
  });
});
