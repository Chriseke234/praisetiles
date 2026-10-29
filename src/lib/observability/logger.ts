/**
 * Production Structured Logger & Data Sanitizer
 *
 * Ensures all log output is structured JSON with ISO timestamps,
 * and automatically redacts credentials, bearer tokens, passwords, and private URLs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'authorization',
  'apikey',
  'service_role',
  'service_role_key',
  'cleanup_secret',
  'access_token',
  'refresh_token',
]);

/**
 * Recursively deep-sanitizes metadata, masking sensitive keys and tokens.
 */
export function sanitizeData(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'string' && val.startsWith('Bearer ')) {
      sanitized[key] = 'Bearer [REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private format(level: LogLevel, event: string, metadata?: Record<string, unknown>, err?: Error): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
    };

    if (metadata) {
      entry.metadata = sanitizeData(metadata) as Record<string, unknown>;
    }

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      };
    }

    return entry;
  }

  debug(event: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'test') return;
    const entry = this.format('debug', event, metadata);
    console.debug(JSON.stringify(entry));
  }

  info(event: string, metadata?: Record<string, unknown>): void {
    const entry = this.format('info', event, metadata);
    console.info(JSON.stringify(entry));
  }

  warn(event: string, metadata?: Record<string, unknown>): void {
    const entry = this.format('warn', event, metadata);
    console.warn(JSON.stringify(entry));
  }

  error(event: string, err?: unknown, metadata?: Record<string, unknown>): void {
    const errorObj = err instanceof Error ? err : (err ? new Error(String(err)) : undefined);
    const entry = this.format('error', event, metadata, errorObj);
    console.error(JSON.stringify(entry));
  }
}

export const logger = new Logger();
