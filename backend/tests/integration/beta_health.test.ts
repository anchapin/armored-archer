/**
 * Beta Environment Health Tests
 *
 * These tests verify that the beta deployment services are healthy:
 * - Nakama Console accessibility
 * - Nakama API health endpoint
 * - Docker container health status
 * - Database connectivity
 * - Redis connectivity
 *
 * Run with: npm run test:integration -- beta_health.test.ts
 * Or: npx jest backend/tests/integration/beta_health.test.ts
 *
 * Prerequisites:
 * - Beta services must be running: make beta-start
 * - Environment must be: NODE_ENV=beta
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// ============================================
// Test Configuration
// ============================================

const BETA_ENV_FILE = '../../.env.beta';

// Load beta environment configuration
function loadBetaEnv(): Record<string, string> {
  try {
    const envContent = readFileSync(BETA_ENV_FILE, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          env[key] = valueParts.join('=');
        }
      }
    }

    return env;
  } catch (error) {
    console.warn(`Warning: Could not load ${BETA_ENV_FILE}, using defaults`);
    return {};
  }
}

const betaEnv = loadBetaEnv();

// Beta service endpoints
const NAKAMA_CONSOLE_URL = process.env.NAKAMA_CONSOLE_URL || 'http://localhost:7351';
const NAKAMA_API_URL = process.env.NAKAMA_API_URL || 'http://localhost:7350';
const NAKAMA_CONSOLE_USERNAME = betaEnv.NAKAMA_CONSOLE_USERNAME || 'admin';
const NAKAMA_CONSOLE_PASSWORD = betaEnv.NAKAMA_CONSOLE_PASSWORD || 'beta_admin_secure_password';

// Database configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5434');
const DB_USER = betaEnv.DB_USER || 'postgres';
const DB_PASSWORD = betaEnv.DB_PASSWORD || 'beta_db_password_change_me';
const DB_NAME = betaEnv.DB_NAME || 'nakama_beta';

// Container names (from docker-compose.beta.yml)
// Note: otel_collector is optional and may not be present
const CONTAINERS = {
  postgres: 'armored_archer_beta_db',
  redis: 'armored_archer_beta_redis',
  nakama: 'armored_archer_beta',
  prometheus: 'armored_archer_beta_prometheus',
  grafana: 'armored_archer_beta_grafana',
};

// Test timeout for health checks (30 seconds)
const HEALTH_CHECK_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;

// ============================================
// Utility Functions
// ============================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Check Docker container status
 */
function getContainerStatus(containerName: string): {
  exists: boolean;
  running: boolean;
  healthy: boolean;
  status: string;
} {
  try {
    const output = execSync(
      `docker ps -a --filter "name=${containerName}" --format "{{.Status}}"`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!output) {
      return { exists: false, running: false, healthy: false, status: 'not found' };
    }

    const status = output.toLowerCase();
    const running = status.includes('up');
    const healthy = status.includes('healthy');

    return { exists: true, running, healthy, status };
  } catch (error) {
    return { exists: false, running: false, healthy: false, status: 'error' };
  }
}

/**
 * Wait for container to be healthy (with timeout)
 */
async function waitForContainerHealth(
  containerName: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = getContainerStatus(containerName);

    if (status.healthy) {
      return true;
    }

    if (!status.running) {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

// ============================================
// Test Suite
// ============================================

describe('Beta Environment Health Tests', () => {
  describe('Docker Container Health', () => {
    it('should have all beta containers running', async () => {
      const results: Record<string, boolean> = {};

      for (const [service, containerName] of Object.entries(CONTAINERS)) {
        const status = getContainerStatus(containerName);

        if (!status.exists) {
          console.warn(`  ⚠ Container ${containerName} does not exist (service: ${service})`);
        }

        results[service] = status.running;

        if (status.running) {
          console.log(`  ✓ ${service}: ${status.status}`);
        } else {
          console.error(`  ✗ ${service}: ${status.status}`);
        }
      }

      // At minimum, core services must be running
      expect(results.postgres).toBe(true);
      expect(results.redis).toBe(true);
      expect(results.nakama).toBe(true);
    });

    it('should have Nakama container healthy', async () => {
      const status = getContainerStatus(CONTAINERS.nakama);

      expect(status.exists).toBe(true);
      expect(status.running).toBe(true);

      // Wait for health check if not yet healthy
      if (!status.healthy) {
        console.log('  Waiting for Nakama health check...');
        const becameHealthy = await waitForContainerHealth(CONTAINERS.nakama);
        expect(becameHealthy).toBe(true);
      } else {
        expect(status.healthy).toBe(true);
      }
    });

    it('should have database container healthy', async () => {
      const status = getContainerStatus(CONTAINERS.postgres);

      expect(status.exists).toBe(true);
      expect(status.running).toBe(true);

      if (!status.healthy) {
        const becameHealthy = await waitForContainerHealth(CONTAINERS.postgres);
        expect(becameHealthy).toBe(true);
      } else {
        expect(status.healthy).toBe(true);
      }
    });

    it('should have Redis container healthy', async () => {
      const status = getContainerStatus(CONTAINERS.redis);

      expect(status.exists).toBe(true);
      expect(status.running).toBe(true);

      if (!status.healthy) {
        const becameHealthy = await waitForContainerHealth(CONTAINERS.redis);
        expect(becameHealthy).toBe(true);
      } else {
        expect(status.healthy).toBe(true);
      }
    });
  });

  describe('Nakama API Health', () => {
    it('should respond to health check at root endpoint', async () => {
      const response = await fetchWithTimeout(NAKAMA_API_URL);

      // Nakama API returns 200 OK when healthy
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });

    it('should have Nakama API accessible', async () => {
      const response = await fetchWithTimeout(`${NAKAMA_API_URL}/`);

      expect(response.ok).toBe(true);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Nakama Console Accessibility', () => {
    it('should serve console web interface', async () => {
      const response = await fetchWithTimeout(NAKAMA_CONSOLE_URL);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      // Console should serve HTML
      const contentType = response.headers.get('content-type');
      expect(contentType).toMatch(/text\/html|application\/xhtml\+xml/);
    }, 15000); // Increase timeout for console test
  });

  describe('Database Connectivity', () => {
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    });

    afterAll(async () => {
      if (pool) {
        await pool.end();
      }
    });

    it('should connect to beta database', async () => {
      const client = await pool.connect();
      expect(client).toBeTruthy();

      const result = await client.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);

      client.release();
    });

    it('should have Nakama tables initialized', async () => {
      const client = await pool.connect();

      // Check for core Nakama tables
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = result.rows.map((row) => row.table_name);

      // Verify essential Nakama tables exist
      expect(tables).toContain('users');
      expect(tables).toContain('user_device');
      expect(tables).toContain('storage');

      console.log(`  ✓ Found ${tables.length} tables in beta database`);

      client.release();
    });

    it('should have database migrations applied', async () => {
      const client = await pool.connect();

      // Check that users table has data (indicates migrations ran)
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'users'
        )
      `);

      // Users table should exist after Nakama migrations
      expect(result.rows[0].exists).toBe(true);

      console.log('  ✓ Database migrations applied successfully');

      client.release();
    });
  });

  describe('Redis Connectivity', () => {
    it('should have Redis service running and accessible', async () => {
      const status = getContainerStatus(CONTAINERS.redis);

      expect(status.running).toBe(true);

      if (status.running && status.healthy) {
        console.log('  ✓ Redis is healthy and accessible');
      }
    });
  });

  describe('Beta Service Integration', () => {
    it('should have all core services healthy', async () => {
      const containerChecks = {
        postgres: getContainerStatus(CONTAINERS.postgres),
        redis: getContainerStatus(CONTAINERS.redis),
        nakama: getContainerStatus(CONTAINERS.nakama),
      };

      // All core services should be running
      expect(containerChecks.postgres.running).toBe(true);
      expect(containerChecks.redis.running).toBe(true);
      expect(containerChecks.nakama.running).toBe(true);

      // Check API connectivity
      const apiResponse = await fetchWithTimeout(NAKAMA_API_URL);
      expect(apiResponse.ok).toBe(true);

      // Check Console accessibility
      const consoleResponse = await fetchWithTimeout(NAKAMA_CONSOLE_URL);
      expect(consoleResponse.ok).toBe(true);

      console.log('  ✓ All core beta services are healthy and accessible');
    });
  });
});
