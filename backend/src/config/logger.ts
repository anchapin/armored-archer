import winston from 'winston';
import { config } from '../config';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(logColors);

const format = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }: winston.Logform.TransformableInfo) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.logger.format === 'json' ? format : consoleFormat
  })
];

if (config.logger.output === 'file' || process.env.LOG_FILE_PATH) {
  const logFilePath = process.env.LOG_FILE_PATH || './logs/app.log';
  transports.push(
    new winston.transports.File({
      filename: logFilePath,
      format,
      level: 'debug'
    }),
    new winston.transports.File({
      filename: logFilePath.replace('.log', '.error.log'),
      level: 'error',
      format
    })
  );
}

export const logger = winston.createLogger({
  levels: logLevels,
  level: config.logger.level,
  format,
  transports,
  exitOnError: false
});

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export function logRpcEntry(
  rpcName: string,
  userId: string,
  requestId: string,
  payload?: unknown
): void {
  logger.info('RPC entry', {
    rpc: rpcName,
    userId,
    requestId,
    payload: payload ? JSON.stringify(payload) : undefined
  });
}

export function logRpcExit(
  rpcName: string,
  userId: string,
  requestId: string,
  durationMs: number
): void {
  logger.info('RPC exit', {
    rpc: rpcName,
    userId,
    requestId,
    durationMs
  });
}

export function logRpcError(
  rpcName: string,
  userId: string,
  requestId: string,
  error: Error,
  durationMs: number
): void {
  logger.error('RPC error', {
    rpc: rpcName,
    userId,
    requestId,
    durationMs,
    error: error.message,
    stack: error.stack
  });
}

export function logSystemEvent(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {}
): void {
  logger[level]('System event', {
    event,
    ...data
  });
}

export function captureRpcError(
  rpcName: string,
  userId: string,
  error: Error,
  _payload?: string
): void {
  logRpcError(rpcName, userId, 'unknown', error, 0);
}
