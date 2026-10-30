import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'api_key',
  'apikey',
  'credit_card',
  'cvv'
]);

export function sanitize(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): string {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context?.requestId ? { requestId: context.requestId as string } : {}),
      ...(context ? { context: sanitize(context) as Record<string, unknown> } : {}),
      ...(error
        ? {
            error: {
              name: error.name,
              message: error.message,
              ...(env.NODE_ENV !== 'production' ? { stack: error.stack } : {})
            }
          }
        : {})
    };

    return JSON.stringify(payload);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(this.formatLog('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    console.warn(this.formatLog('warn', message, context, error));
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    console.error(this.formatLog('error', message, context, error));
  }
}

export const logger = new Logger();
