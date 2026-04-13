/**
 * Jest integration test teardown - runs after integration tests
 * Stops Docker Compose services if running locally
 */

import { execSync } from 'child_process';
import { join } from 'path';

const isLocalTest = process.env.LOCAL_TEST === 'true' || process.env.CI !== 'true';
const composeProject = 'armored_archer_test';

/**
 * Check if Docker Compose is available
 */
function hasDockerCompose(): boolean {
  try {
    execSync('docker compose version || docker-compose version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if services are running
 */
function areServicesRunning(): boolean {
  try {
    execSync('curl -s http://localhost:7350/healthcheck', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the compose command
 */
function getComposeCommand(): string {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    return 'docker-compose';
  }
}

/**
 * Stop Docker Compose services
 */
function stopServices(): void {
  console.log('\n🛑 Stopping Docker Compose services...');

  const compose = getComposeCommand();
  const backendDir = join(__dirname, '..');

  try {
    execSync(`${compose} -f docker-compose.yml -p ${composeProject} stop`, {
      cwd: backendDir,
      stdio: 'pipe',
    });
    console.log('✅ Services stopped');
  } catch (error) {
    console.error('⚠️  Warning: Failed to stop services cleanly');
  }
}

// Global teardown
export default async function globalTeardown(): Promise<void> {
  if (!isLocalTest) {
    console.log('🌐 CI mode: services managed externally');
    return;
  }

  // Check if we should keep services running (useful for development)
  const keepServices = process.env.KEEP_SERVICES === 'true';

  if (keepServices) {
    console.log('💡 Keeping services running (set KEEP_SERVICES=false to stop)');
    return;
  }

  if (hasDockerCompose() && areServicesRunning()) {
    stopServices();
  }
}
