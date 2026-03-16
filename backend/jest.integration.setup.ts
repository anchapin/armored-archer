/**
 * Jest integration test setup - runs before integration tests
 * Manages Docker Compose services for local test runs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
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
 * Check if services are already running
 */
function areServicesRunning(): boolean {
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
function getComposeCommand(): string {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    return 'docker-compose';
  }
}

/**
 * Start Docker Compose services for integration tests
 */
function startServices(): void {
  console.log('🐳 Starting Docker Compose services for integration tests...');
  
  const compose = getComposeCommand();
  const backendDir = join(__dirname, '..');
  
  try {
    // Start services
    execSync(`${compose} -f docker-compose.yml -p ${composeProject} up -d postgres redis nakama`, {
      cwd: backendDir,
      stdio: 'inherit',
    });
    
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be healthy...');
    waitForPostgres(compose, backendDir);
    waitForRedis(compose, backendDir);
    waitForNakama();
    
    console.log('✅ All services are ready!');
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    process.exit(1);
  }
}

/**
 * Wait for PostgreSQL to be ready
 */
function waitForPostgres(compose: string, backendDir: string, timeoutMs: number = 60000): void {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      execSync(`docker exec ${composeProject}_postgres pg_isready -U postgres -d nakama`, {
        cwd: backendDir,
        stdio: 'ignore',
      });
      console.log('✓ PostgreSQL is ready');
      return;
    } catch {
      // Wait and retry
    }
  }
  
  throw new Error('PostgreSQL failed to start within timeout');
}

/**
 * Wait for Redis to be ready
 */
function waitForRedis(compose: string, backendDir: string, timeoutMs: number = 60000): void {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      execSync(`docker exec ${composeProject}_redis redis-cli ping`, {
        cwd: backendDir,
        stdio: 'ignore',
      });
      console.log('✓ Redis is ready');
      return;
    } catch {
      // Wait and retry
    }
  }
  
  throw new Error('Redis failed to start within timeout');
}

/**
 * Wait for Nakama to be ready
 */
function waitForNakama(timeoutMs: number = 90000): void {
  const startTime = Date.now();
  
  console.log('⏳ Waiting for Nakama (this may take a minute for migrations)...');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      execSync('curl -s http://localhost:7350/healthcheck', { stdio: 'ignore' });
      console.log('✓ Nakama is ready');
      return;
    } catch {
      // Wait and retry
      if (Date.now() - startTime > 30000) {
        console.log(`  Still waiting for Nakama... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
      }
    }
  }
  
  throw new Error('Nakama failed to start within timeout');
}

/**
 * Stop Docker Compose services
 */
function stopServices(): void {
  console.log('🛑 Stopping Docker Compose services...');
  
  const compose = getComposeCommand();
  const backendDir = join(__dirname, '..');
  
  try {
    execSync(`${compose} -f docker-compose.yml -p ${composeProject} stop`, {
      cwd: backendDir,
      stdio: 'inherit',
    });
    console.log('✅ Services stopped');
  } catch (error) {
    console.error('⚠️  Warning: Failed to stop services cleanly:', error);
  }
}

/**
 * Run Nakama migrations
 */
function runMigrations(): void {
  console.log('🔄 Running Nakama migrations...');
  
  const backendDir = join(__dirname, '..');
  
  try {
    execSync(
      'docker exec armored_archer_test_nakama /nakama/nakama migrate up --database.address postgres://postgres:changeme@postgres:5432/nakama',
      {
        cwd: backendDir,
        stdio: 'inherit',
      }
    );
    console.log('✅ Migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Global setup
export default async function globalSetup(): Promise<void> {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.NAKAMA_HOST = 'localhost';
  process.env.NAKAMA_PORT = '7350';
  process.env.NAKAMA_SERVER_KEY = 'defaultkey';
  process.env.DATABASE_ADDRESS = 'postgres://postgres:changeme@localhost:5432/nakama';
  
  if (!isLocalTest) {
    console.log('🌐 Running in CI mode - assuming services are managed externally');
    return;
  }
  
  if (!hasDockerCompose()) {
    console.warn('⚠️  Docker Compose not available - tests may fail if services are not running');
    return;
  }
  
  if (areServicesRunning()) {
    console.log('✅ Services already running, skipping startup');
    return;
  }
  
  startServices();
  runMigrations();
}

// Global teardown
export default async function globalTeardown(): Promise<void> {
  if (!isLocalTest) {
    return;
  }
  
  // Only stop services if we started them
  if (hasDockerCompose() && areServicesRunning()) {
    // Check if we should keep services running (useful for development)
    const keepServices = process.env.KEEP_SERVICES === 'true';
    
    if (keepServices) {
      console.log('💡 Keeping services running (set KEEP_SERVICES=false to stop)');
    } else {
      stopServices();
    }
  }
}
