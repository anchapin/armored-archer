import { Runtime } from "../types/nakama";

const requiredEnvVars = [
  'NAKAMA_SERVER_KEY',
  'POSTGRES_PASSWORD',
  'REVENUECAT_PUBLIC_KEY'
];

function validatePort(port: string, name: string): number {
  const num = parseInt(port, 10);

  if (isNaN(num)) {
    throw new Error(`${name} must be a number`);
  }

  if (num < 1 || num > 65535) {
    throw new Error(`${name} must be between 1 and 65535, got: ${num}`);
  }

  return num;
}

function validateUrl(url: string, name: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`${name} must be a valid URL: ${url}`);
  }
}

function validateRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}

function logConfiguration(logger: Runtime.Logger): void {
  logger.info('=== Configuration ===');

  const safeConfig: { [key: string]: string } = {};

  for (const key of Object.keys(process.env)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('password') || 
        lowerKey.includes('secret') || 
        lowerKey.includes('key') ||
        lowerKey.includes('token')) {
      safeConfig[key] = maskSecret(process.env[key] || '');
    } else {
      safeConfig[key] = process.env[key] || '';
    }
  }

  for (const [key, value] of Object.entries(safeConfig)) {
    logger.info('%s = %s', key, value);
  }

  logger.info('====================');
}

function validateDatabaseConfig(): void {
  const dbAddress = process.env.DATABASE_ADDRESS || process.env.NAKAMA_DATABASE_ADDRESS;

  if (!dbAddress) {
    throw new Error('Database address not configured (DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS)');
  }

  const dbRegex = /^(\w+):([^@]+)@([^:]+):(\d+)\/(\w+)$/;
  const match = dbAddress.match(dbRegex);

  if (!match) {
    throw new Error(`Invalid database address format: ${dbAddress}. Expected format: user:password@host:port/database`);
  }

  const [, user, password, host, port, database] = match;

  if (!user) {
    throw new Error('Database user not specified in connection string');
  }

  if (!password) {
    throw new Error('Database password not specified in connection string');
  }

  if (!host) {
    throw new Error('Database host not specified in connection string');
  }

  if (!port) {
    throw new Error('Database port not specified in connection string');
  }

  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(`Invalid database port: ${port}. Must be between 1 and 65535`);
  }

  if (!database) {
    throw new Error('Database name not specified in connection string');
  }
}

export function validateConfiguration(logger: Runtime.Logger): void {
  try {
    logger.info('Starting configuration validation...');

    validateRequiredEnvVars();

    validateDatabaseConfig();

    const nakamaPort = process.env.NAKAMA_PORT || process.env.SOCKET_PORT || '7350';
    const consolePort = process.env.NAKAMA_CONSOLE_PORT || process.env.CONSOLE_PORT || '7351';
    const dbPort = process.env.DATABASE_PORT || '5432';

    validatePort(nakamaPort, 'NAKAMA_PORT');
    validatePort(consolePort, 'NAKAMA_CONSOLE_PORT');
    validatePort(dbPort, 'DATABASE_PORT');

    logConfiguration(logger);

    logger.info('Configuration validation successful');
  } catch (error) {
    logger.error('Configuration validation failed: %s', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
