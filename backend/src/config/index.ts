import * as fs from 'fs';
import * as path from 'path';

function loadEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFiles = [
    `.env.${nodeEnv}`,
    '.env',
    `.env.${nodeEnv}.local`
  ];

  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      
      for (const line of envContent.split('\n')) {
        const trimmedLine = line.trim();
        
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalsIndex = trimmedLine.indexOf('=');
          
          if (equalsIndex > 0) {
            const key = trimmedLine.substring(0, equalsIndex).trim();
            let value = trimmedLine.substring(equalsIndex + 1).trim();
            
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1);
            }
            
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    }
  }
}

loadEnvironment();

export interface ServerConfig {
  port: number;
  consolePort: number;
  host: string;
  key: string;
  consoleUsername: string;
  consolePassword: string;
}

export interface DatabaseConfig {
  address: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface RevenueCatConfig {
  publicKey: string;
  secretKey: string;
}

export interface SessionConfig {
  encryptionKey: string;
  refreshEncryptionKey: string;
  tokenEncryptionKey: string;
  expirySec: number;
}

export interface LoggerConfig {
  level: string;
  format: string;
  output: string;
}

export interface MatchConfig {
  allowHostLoopback: boolean;
}

export interface MetricsConfig {
  namespace: string;
  prefix: string;
  prometheusPort: number;
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  server: ServerConfig;
  database: DatabaseConfig;
  revenuecat: RevenueCatConfig;
  session: SessionConfig;
  logger: LoggerConfig;
  match: MatchConfig;
  metrics: MetricsConfig;
}

function parseDatabaseAddress(address: string): DatabaseConfig {
  const dbRegex = /^(\w+):([^@]+)@([^:]+):(\d+)\/(\w+)$/;
  const match = address.match(dbRegex);

  if (!match) {
    return {
      address,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nakama'
    };
  }

  const [, user, password, host, port, database] = match;
  return {
    address,
    host,
    port: parseInt(port, 10),
    user,
    password,
    database
  };
}

const dbAddress = process.env.DATABASE_ADDRESS || process.env.NAKAMA_DATABASE_ADDRESS || '';

const config: AppConfig = {
  environment: (process.env.NODE_ENV || 'development') as AppConfig['environment'],
  
  server: {
    port: parseInt(process.env.NAKAMA_PORT || process.env.NAKAMA_SOCKET_PORT || '7350', 10),
    consolePort: parseInt(process.env.NAKAMA_CONSOLE_PORT || '7351', 10),
    host: process.env.NAKAMA_HOST || '127.0.0.1',
    key: process.env.NAKAMA_SERVER_KEY || process.env.NAKAMA_SOCKET_SERVER_KEY || 'defaultkey',
    consoleUsername: process.env.NAKAMA_CONSOLE_USERNAME || 'admin',
    consolePassword: process.env.NAKAMA_CONSOLE_PASSWORD || 'password'
  },
  
  database: parseDatabaseAddress(dbAddress),
  
  revenuecat: {
    publicKey: process.env.REVENUECAT_PUBLIC_KEY || '',
    secretKey: process.env.REVENUECAT_SECRET_KEY || ''
  },
  
  session: {
    encryptionKey: process.env.SESSION_ENCRYPTION_KEY || 'default-token-key',
    refreshEncryptionKey: process.env.REFRESH_ENCRYPTION_KEY || 'default-refresh-key',
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 'default-token-key',
    expirySec: parseInt(process.env.SESSION_EXPIRY_SEC || '7200', 10)
  },
  
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    output: process.env.LOG_OUTPUT || 'stdout'
  },
  
  match: {
    allowHostLoopback: process.env.ALLOW_HOST_LOOPBACK === 'true'
  },
  
  metrics: {
    namespace: process.env.METRICS_NAMESPACE || 'nakama',
    prefix: process.env.METRICS_PREFIX || 'nakama',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9100', 10)
  }
};

export function validateRequiredConfig(): void {
  const errors: string[] = [];
  
  if (!config.server.key || config.server.key === 'defaultkey') {
    if (config.environment === 'production') {
      errors.push('NAKAMA_SERVER_KEY must be set in production');
    }
  }
  
  if (!config.revenuecat.publicKey) {
    errors.push('REVENUECAT_PUBLIC_KEY is required');
  }
  
  if (!config.database.address) {
    errors.push('DATABASE_ADDRESS or NAKAMA_DATABASE_ADDRESS is required');
  }
  
  const requiredKeys: { key: string; path: string }[] = [
    { key: 'session.encryptionKey', path: 'session.encryptionKey' },
    { key: 'session.refreshEncryptionKey', path: 'session.refreshEncryptionKey' },
    { key: 'session.tokenEncryptionKey', path: 'session.tokenEncryptionKey' }
  ];
  
  for (const { key, path: configPath } of requiredKeys) {
    const value = key.split('.').reduce((obj: Record<string, unknown> | undefined, k) => obj?.[k as keyof typeof obj], config);
    if (!value || value === 'default-token-key' || value === 'default-refresh-key') {
      if (config.environment === 'production') {
        errors.push(`${configPath} must be set in production`);
      }
    }
  }
  
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid server port: ${config.server.port}. Must be between 1 and 65535`);
  }
  
  if (config.server.consolePort < 1 || config.server.consolePort > 65535) {
    errors.push(`Invalid console port: ${config.server.consolePort}. Must be between 1 and 65535`);
  }
  
  if (config.database.port < 1 || config.database.port > 65535) {
    errors.push(`Invalid database port: ${config.database.port}. Must be between 1 and 65535`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}

export function logConfiguration(logger: { info: (message: string, ...args: unknown[]) => void }): void {
  logger.info('=== Configuration ===');
  logger.info('Environment: %s', config.environment);
  logger.info('Server: host=%s, port=%d, console_port=%d', 
    config.server.host, config.server.port, config.server.consolePort);
  logger.info('Database: host=%s, port=%d, database=%s', 
    config.database.host, config.database.port, config.database.database);
  logger.info('RevenueCat: public_key=%s', maskSecret(config.revenuecat.publicKey));
  logger.info('Session: expiry_sec=%d', config.session.expirySec);
  logger.info('Logger: level=%s, format=%s, output=%s', 
    config.logger.level, config.logger.format, config.logger.output);
  logger.info('Match: allow_host_loopback=%s', config.match.allowHostLoopback);
  logger.info('Metrics: namespace=%s, prometheus_port=%d', 
    config.metrics.namespace, config.metrics.prometheusPort);
  logger.info('====================');
}

export default config;
