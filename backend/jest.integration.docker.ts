/**
 * Shared Docker Compose helpers for integration test setup and teardown.
 * Extracted from jest.integration.setup.ts / jest.integration.teardown.ts
 * to remove duplicated helper functions (jscpd clone cleanup, issue #1640).
 */

import { execSync } from 'child_process';

export const isLocalTest = process.env.LOCAL_TEST === 'true' || process.env.CI !== 'true';
export const composeProject = 'armored_archer_test';

/**
 * Check if Docker Compose is available
 */
export function hasDockerCompose(): boolean {
  try {
    execSync('docker compose version || docker-compose version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if services are already running
 */
export function areServicesRunning(): boolean {
  try {
    // Check if Nakama is responding
    execSync('curl -s http://localhost:7350/healthcheck', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the compose command (docker compose or docker-compose)
 */
export function getComposeCommand(): string {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    return 'docker-compose';
  }
}
