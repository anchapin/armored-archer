/**
 * Jest setup file - runs before test environment is set up
 * Clear environment variables to ensure tests start with clean state
 */

// Clear all database-related environment variables before any modules load
const dbVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DATABASE_ADDRESS',
  'NAKAMA_DATABASE_ADDRESS',
];

for (const varName of dbVars) {
  delete process.env[varName];
}

// Set test environment
process.env.NODE_ENV = 'test';
