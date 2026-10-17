/**
 * Jest integration test teardown - runs after integration tests
 * Stops Docker Compose services if running locally
 */

import { execSync } from 'child_process';
import { join } from 'path';
import {
  isLocalTest,
  composeProject,
  hasDockerCompose,
  areServicesRunning,
  getComposeCommand,
} from './jest.integration.docker';

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
