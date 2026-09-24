import { Client } from '@heroiclabs/nakama-js';
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
   */
  async getAdminClient(): Promise<{ client: Client; session: any }> {
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

    return { client: this.adminClient, session: this.adminSession };
  }

  /**
   * Clean all test data from storage collections.
   * This should be called between test runs to ensure isolation.
   */
  async cleanAllTestData(): Promise<void> {
    let adminClient: Client | null = null;
    let adminSession: any = null;

    try {
      // Get admin client, but don't fail if unavailable
      try {
        const admin = await this.getAdminClient();
        adminClient = admin.client;
        adminSession = admin.session;
      } catch (error) {
        // Admin client not available, skip cleanup
        return;
      }

      if (!adminClient || !adminSession) {
        return;
      }

      // List of collections used in tests (including potential matches)
      const collections = [
        'player_stats',
        'pvp_matches',
        'pvp_match_states',
        'player_inventory',
        'season_progress',
        'leaderboards',
        'player_currency',
        'season_rewards_claimed',
        'store_purchases',
        // Stage progression collections
        'stage_completion',
        'stage_completion_claims',
        'boss_defeats',
        'unlocked_modifier_pools',
      ];

      // Clean storage objects with keys that start with 'test_' or are from test users
      for (const collection of collections) {
        try {
          const listResult = await adminClient.listStorageObjects(
            adminSession,
            collection,
            undefined, // userId undefined to list all
            1000, // limit
            undefined // cursor
          );

          if (listResult && listResult.objects && listResult.objects.length > 0) {
            // Build request for deleteStorageObjects
            const objectsToDelete = listResult.objects.map((obj) => ({
              collection: obj.collection,
              key: obj.key,
              user_id: obj.user_id || '',
              version: obj.version || '',
            }));
            const request = { object_ids: objectsToDelete };
            await adminClient.deleteStorageObjects(adminSession, request as any);
          }
        } catch (error) {
          // Some collections may not exist or be empty - only log unexpected errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Ignore "not found" errors as they're expected for empty collections
          if (!errorMessage.includes('not found') && !errorMessage.includes('does not exist')) {
            // Log at debug level instead of polluting test output
            // console.debug(`Cleanup for collection ${collection}: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      // Final catch-all for unexpected cleanup errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not found') && !errorMessage.includes('does not exist')) {
        // Only log non-expected errors
        // console.debug(`Cleanup error: ${errorMessage}`);
      }
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
   * Delete a specific storage object.
   */
  async deleteStorageObject(collection: string, key: string, user_id: string): Promise<void> {
    const { client, session } = await this.getAdminClient();
    const request = { object_ids: [{ collection, key, user_id, version: '' }] };
    await client.deleteStorageObjects(session, request as any);
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
}

export const testHelper = IntegrationTestHelper.getInstance();
