import { NakamaClient, NakamaTypes } from '@heroiclabs/nakama-js';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_HOST = process.env.NAKAMA_HOST || 'localhost';
const TEST_PORT = parseInt(process.env.NAKAMA_PORT || '7350');
const TEST_DB_NAME = 'armored_archer_test';
const TEST_ADMIN_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';

export interface TestAccount {
  client: NakamaClient;
  userId: string;
  username: string;
  sessionToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class IntegrationTestHelper {
  private static instance: IntegrationTestHelper | null = null;
  private adminClient: NakamaClient | null = null;
  private testDbInitialized: boolean = false;

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
   */
  async cleanup(): Promise<void> {
    if (this.adminClient) {
      await this.adminClient.disconnect();
    }
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

    const client = new NakamaClient({
      host: TEST_HOST,
      port: TEST_PORT,
      serverKey: TEST_ADMIN_KEY,
    });

    try {
      // Authenticate (this will create the account if it doesn't exist)
      const session = await client.authenticate(email, username, password, username);
      
      // Verify the account was created
      const account = await client.getAccount();
      
      return {
        client,
        userId: session.userId,
        username: session.username,
        sessionToken: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      await client.disconnect();
      throw error;
    }
  }

  /**
   * Get a client authenticated as admin for administrative tasks.
   */
  async getAdminClient(): Promise<NakamaClient> {
    if (this.adminClient && !this.adminClient.isConnected) {
      this.adminClient = null;
    }

    if (!this.adminClient) {
      this.adminClient = new NakamaClient({
        host: TEST_HOST,
        port: TEST_PORT,
        serverKey: TEST_ADMIN_KEY,
      });

      // Authenticate admin account (should exist from docker-compose)
      await this.adminClient.authenticate('admin@test.local', 'admin', 'admin123', 'admin');
    }

    return this.adminClient;
  }

  /**
   * Clean all test data from storage collections.
   * This should be called between test runs to ensure isolation.
   */
  async cleanAllTestData(): Promise<void> {
    const admin = await this.getAdminClient();

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
    ];

    // Clean storage objects with keys that start with 'test_' or are from test users
    for (const collection of collections) {
      try {
        const listResult = await admin.storageList(
          '', // userId empty to list all
          collection,
          1000, // limit
          '', // cursor
          'test_' // filter prefix
        );

        if (listResult && listResult.length > 0) {
          const objects = listResult.map(obj => ({
            collection: obj.collection,
            key: obj.key,
            userId: obj.userId,
            version: obj.version,
          }));
          await admin.storageDelete(objects);
        }
      } catch (error) {
        // Some collections may not exist or be empty, ignore errors
        console.log(`Cleanup for collection ${collection}: ${error instanceof Error ? error.message : 'error'}`);
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
    const client = new NakamaClient({
      host: TEST_HOST,
      port: TEST_PORT,
      serverKey: TEST_ADMIN_KEY,
    });

    while (Date.now() - startTime < timeoutMs) {
      try {
        await client.authenticate('healthcheck@test.local', 'healthcheck', 'healthpass', 'healthcheck');
        await client.disconnect();
        return true;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await client.disconnect();
    return false;
  }

  /**
   * Delete a specific storage object.
   */
  async deleteStorageObject(collection: string, key: string, userId: string): Promise<void> {
    const admin = await this.getAdminClient();
    await admin.storageDelete([{ collection, key, userId }]);
  }

  /**
   * Get storage object directly.
   */
  async getStorageObject(collection: string, key: string, userId: string): Promise<NakamaTypes.StorageObject | null> {
    const admin = await this.getAdminClient();
    const results = await admin.storageRead([{ collection, key, userId }]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Write storage object directly (for test setup).
   */
  async writeStorageObject(collection: string, key: string, userId: string, value: any): Promise<void> {
    const admin = await this.getAdminClient();
    await admin.storageWrite([{
      collection,
      key,
      userId,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }]);
  }
}

export const testHelper = IntegrationTestHelper.getInstance();
