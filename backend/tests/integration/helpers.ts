import { Client } from '@heroiclabs/nakama-js';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_HOST = process.env.NAKAMA_HOST || 'localhost';
const TEST_PORT = parseInt(process.env.NAKAMA_PORT || '7350');
const TEST_DB_NAME = 'armored_archer_test';
const TEST_ADMIN_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';

export interface TestAccount {
  client: Client;
  session: any;
  userId: string;
  username: string;
  sessionToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class IntegrationTestHelper {
  private static instance: IntegrationTestHelper | null = null;
  private adminClient: Client | null = null;
  private adminSession: any = null;
  private testDbInitialized: boolean = false;
  private clients: Client[] = [];

  private constructor() {}

  static getInstance(): IntegrationTestHelper {
    if (!IntegrationTestHelper.instance) {
      IntegrationTestHelper.instance = new IntegrationTestHelper();
    }
    return IntegrationTestHelper.instance;
  }

  /**
   * Initialize the test environment. Should be called once before all tests.
   * Ensures the test database exists and is clean.
   */
  async initialize(): Promise<void> {
    await this.ensureTestDatabase();
    await this.cleanAllTestData();
    this.testDbInitialized = true;
  }

  /**
   * Clean up after all tests are complete.
   * This now ensures all tracked clients are properly disconnected.
   */
  async cleanup(): Promise<void> {
    // Disconnect admin client
    if (this.adminClient) {
      try {
        // Use a generic disconnect method if it exists, otherwise clear it
        if (typeof (this.adminClient as any).disconnect === 'function') {
          await (this.adminClient as any).disconnect();
        }
      } catch (error) {
        // Silently ignore disconnect errors for admin client
      } finally {
        this.adminClient = null;
        this.adminSession = null;
      }
    }

    // Disconnect all tracked clients sequentially to avoid race conditions
    for (const client of this.clients) {
      try {
        if (typeof (client as any).disconnect === 'function') {
          await (client as any).disconnect();
        }
      } catch (error) {
        // Ignore errors during mass disconnect
      }
    }

    this.clients = [];
    this.testDbInitialized = false;
  }

  /**
   * Create a new test account. Each test should use a unique account.
   */
  async createTestAccount(prefix: string = 'test'): Promise<TestAccount> {
    if (!this.testDbInitialized) {
      throw new Error('Test environment not initialized. Call initialize() first.');
    }

    const username = `${prefix}_${uuidv4().slice(0, 8)}`;
    const password = 'TestPassword123!';
    const email = `${username}@test.local`;

    const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);

    // Track the client for cleanup
    this.clients.push(client);

    try {
      // Authenticate (this will create the account if it doesn't exist)
      const session = await client.authenticateEmail(email, password, true, username);

      return {
        client,
        session,
        userId: session.user_id || '',
        username: session.username || '',
        sessionToken: session.token,
        refreshToken: session.refresh_token || '',
        expiresAt: session.expires_at || 0,
      };
    } catch (error) {
      if (typeof (client as any).disconnect === 'function') {
        await (client as any).disconnect();
      }
      throw error;
    }
  }

  /**
   * Get a client authenticated as admin for administrative tasks.
   * Returns an augmented object with test-helper methods for operations
   * not directly available on the nakama-js Client (leaderboard writes,
   * storage deletes, etc.).
   */
  async getAdminClient(): Promise<{
    client: Client;
    session: any;
    /**
     * Write a leaderboard record directly for a specific owner.
     * Wraps nk.leaderboardRecordWrite() via the SeasonAdminWriteLeaderboardRecord RPC.
     * @param seasonId The leaderboard/season ID
     * @param ownerId The user ID who owns this record
     * @param username The username for this record
     * @param score The score value
     * @param subscore The subscore value
     * @param metadata Optional extra metadata
     */
    leaderboardRecordWrite(
      seasonId: string,
      ownerId: string,
      username: string,
      score: number,
      subscore: number,
      metadata?: Record<string, any>
    ): Promise<any>;
    /**
     * Delete leaderboard records for one or more owners.
     * Uses deleteTournamentRecord RPC under the hood.
     * @param seasonId The leaderboard/season ID
     * @param ownerIds Array of owner user IDs to delete records for
     */
    leaderboardDelete(seasonId: string, ownerIds: string[]): Promise<any>;
    /**
     * Delete storage objects by collection/key/userId.
     * NOTE: client.deleteStorageObjects hangs in nakama-js 2.x, so we use
     * the test.cleanup_user_storage RPC instead.
     * @param keys Array of { collection, key, userId } to delete
     */
    storageDelete(keys: Array<{ collection: string; key: string; userId: string }>): Promise<any>;
  }> {
    if (!this.adminClient || !this.adminSession) {
      this.adminClient = new Client(
        TEST_ADMIN_KEY,
        TEST_HOST,
        TEST_PORT.toString(),
        false,
        10000,
        false
      );

      // Fixed: Use individual arguments as expected by nakama-js v2.x
      this.adminSession = await this.adminClient.authenticateEmail(
        'admin@test.local',
        'admin123',
        true,
        'admin'
      );
    }

    const { client, session } = this;

    return {
      client,
      session,
      async leaderboardRecordWrite(
        seasonId: string,
        ownerId: string,
        username: string,
        score: number,
        subscore: number,
        metadata?: Record<string, any>
      ): Promise<any> {
        return client.rpc(session, 'SeasonAdminWriteLeaderboardRecord', {
          season_id: seasonId,
          owner_id: ownerId,
          username,
          score,
          subscore,
          metadata: metadata ?? {},
        });
      },
      async leaderboardDelete(_seasonId: string, _ownerIds: string[]): Promise<void> {
        // No-op: Nakama server API does not support deleting individual leaderboard records.
        // Only nk.leaderboardDelete(id) exists, which deletes the ENTIRE leaderboard.
        // Tests should use a fresh season_id per test run to avoid record pollution.
      },
      async storageDelete(
        keys: Array<{ collection: string; key: string; userId: string }>
      ): Promise<any> {
        const results = [];
        for (const { collection, key, userId } of keys) {
          const r = await client.rpc(session, 'test.cleanup_user_storage', {
            collection,
            key,
            user_id: userId,
          });
          results.push(r);
        }
        return results;
      },
    };
  }

  /**
   * Clean all test data from storage collections.
   * This should be called between test runs to ensure isolation.
   */
  /**
   * Clean Nakama storage for a specific user via direct PostgreSQL access.
   * This is needed because admin client cannot see other users' storage in Nakama 3.21.
   * NOTE: Uses a fresh Pool per call to avoid connection-state issues. This is
   * intentionally NOT reused to prevent lingering connections between tests.
   */
  async cleanupUserStorage(userId: string): Promise<void> {
    const dbHost = process.env.TEST_DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.TEST_DB_PORT || '5433');
    const dbUser = process.env.TEST_DB_USER || 'postgres';
    const dbPassword = process.env.TEST_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'armoredarcher';
    const dbName = process.env.TEST_DB_NAME || 'nakama';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      try {
        // Delete all storage records for this user
        await client.query('DELETE FROM storage WHERE user_id = $1', [userId]).catch(() => {});
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  /**
   * Clean a specific Nakama storage collection for a user via direct PostgreSQL access.
   * Uses a fresh Pool per call. Safe for use in beforeEach hooks (no Nakama JS client).
   */
  async cleanupStorageCollection(userId: string, collection: string): Promise<void> {
    const dbHost = process.env.TEST_DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.TEST_DB_PORT || '5433');
    const dbUser = process.env.TEST_DB_USER || 'postgres';
    const dbPassword = process.env.TEST_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'armoredarcher';
    const dbName = process.env.TEST_DB_NAME || 'nakama';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      try {
        await client
          .query('DELETE FROM storage WHERE user_id = $1 AND collection = $2', [userId, collection])
          .catch(() => {});
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  async cleanAllTestData(): Promise<void> {
    const dbHost = process.env.TEST_DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.TEST_DB_PORT || '5433');
    const dbUser = process.env.TEST_DB_USER || 'postgres';
    const dbPassword = process.env.TEST_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'armoredarcher';
    const dbName = process.env.TEST_DB_NAME || 'nakama';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      try {
        // Clean all Nakama storage records (game data from JS modules)
        await client.query('DELETE FROM storage').catch(() => {});

        // Clean PostgreSQL game tables (if they exist after migrations)
        await client.query('DELETE FROM unlocked_modifier_pools').catch(() => {});
        await client.query('DELETE FROM boss_defeats').catch(() => {});
        await client.query('DELETE FROM player_stats').catch(() => {});
        await client.query('DELETE FROM catalog').catch(() => {});
        await client.query('DELETE FROM inventory').catch(() => {});
        await client.query('DELETE FROM loadout').catch(() => {});
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  /**
   * Ensure a test database exists. This uses the default database that
   * docker-compose sets up. We assume the database is already created.
   */
  private async ensureTestDatabase(): Promise<void> {
    // For now, we assume the database from docker-compose is used for tests.
    // In a more advanced setup, we could create a separate test database.
    console.log('Test database initialization check - using existing database from docker-compose');
  }

  /**
   * Wait for Nakama to be ready.
   */
  async waitForNakamaReady(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const client = new Client(TEST_ADMIN_KEY, TEST_HOST, TEST_PORT.toString(), false, 10000, false);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Use authenticateEmail for healthcheck
        const session = await client.authenticateEmail(
          'healthcheck@test.local',
          'healthcheck',
          false,
          'healthcheck'
        );
        return !!session;
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return false;
  }

  /**
   * Delete a specific storage object using the user's own session.
   * This is the preferred method for cleanup as admin client cannot delete user storage.
   *
   * Note: Nakama 3.21's storage delete HTTP API may return 400 "not found" if the object
   * doesn't exist, which is expected during cleanup. We catch and ignore this error.
   */
  async deleteStorageObject(collection: string, key: string, user_id: string, session: any): Promise<void> {
    if (!session) {
      console.warn('No session provided for deleteStorageObject, skipping cleanup');
      return;
    }
    try {
      // Use the session's associated client - we need to get it from somewhere
      // For now, try to get admin client but this won't work for user storage
      const { client } = await this.getAdminClient();
      // Actually, we need the client that matches the session. Let's create one.
      const userClient = new Client(
        TEST_ADMIN_KEY,
        TEST_HOST,
        TEST_PORT.toString(),
        false,
        10000,
        false
      );
      const request = { object_ids: [{ collection, key }] };
      await userClient.deleteStorageObjects(session, request as any);
    } catch (error: any) {
      // Ignore "not found" errors during cleanup - they're expected when object doesn't exist
      if (error.status === 400) {
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get storage object directly.
   */
  async getStorageObject(collection: string, key: string, user_id: string): Promise<any | null> {
    const { client, session } = await this.getAdminClient();
    const request = { object_ids: [{ collection, key, user_id }] };
    const results = await client.readStorageObjects(session, request as any);
    return results.objects && results.objects.length > 0 ? results.objects[0] : null;
  }

  /**
   * Write storage object directly (for test setup).
   */
  async writeStorageObject(
    collection: string,
    key: string,
    user_id: string,
    value: any
  ): Promise<void> {
    const { client, session } = await this.getAdminClient();
    // nakama-js v2.x writeStorageObjects expects an array
    const objectValue = typeof value === 'string' ? JSON.parse(value) : value;
    const objects = [{ collection, key, value: objectValue, version: '', user_id }];
    await client.writeStorageObjects(session, objects as any);
  }

  /**
   * Clean up PostgreSQL tables for a user (boss_defeats, unlocked_modifier_pools)
   * AND Nakama's storage table.
   * Nakama storage is stored in the 'storage' table in PostgreSQL.
   */
  async cleanupDatabaseForUser(userId: string, opts?: { tablesToClean?: string[] }): Promise<void> {
    const dbHost = process.env.TEST_DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.TEST_DB_PORT || '5433');
    const dbUser = process.env.TEST_DB_USER || 'postgres';
    // Use POSTGRES_PASSWORD from .env (loaded by jest.integration.setup.env.js) as fallback
    const dbPassword = process.env.TEST_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'armoredarcher';
    const dbName = process.env.TEST_DB_NAME || 'nakama';

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      try {
        const tablesToClean = opts?.tablesToClean;
        const clean = (table: string) => tablesToClean ? tablesToClean.includes(table) : true;

        // Clean Nakama storage table (core game data stored by JS modules)
        if (clean('storage')) await client.query('DELETE FROM storage WHERE user_id = $1', [userId]).catch(() => {});

        // Clean PostgreSQL game tables (if they exist after migrations)
        if (clean('unlocked_modifier_pools')) await client.query('DELETE FROM unlocked_modifier_pools WHERE user_id = $1', [userId]).catch(() => {});
        if (clean('boss_defeats')) await client.query('DELETE FROM boss_defeats WHERE user_id = $1', [userId]).catch(() => {});
        if (clean('inventory_items')) await client.query('DELETE FROM inventory_items WHERE user_id = $1', [userId]).catch(() => {});
        if (clean('inventory')) await client.query('DELETE FROM inventory WHERE user_id = $1', [userId]).catch(() => {});
        if (clean('loadout')) await client.query('DELETE FROM loadout WHERE user_id = $1', [userId]).catch(() => {});
        if (clean('player_stats')) await client.query('DELETE FROM player_stats WHERE user_id = $1', [userId]).catch(() => {});
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }
}

export const testHelper = IntegrationTestHelper.getInstance();
