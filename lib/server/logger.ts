type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    if (meta !== undefined) {
      console.log(formatMessage('info', message), meta);
    } else {
      console.log(formatMessage('info', message));
    }
  },
  warn: (message: string, meta?: unknown) => {
    if (meta !== undefined) {
      console.warn(formatMessage('warn', message), meta);
    } else {
      console.warn(formatMessage('warn', message));
    }
  },
  error: (message: string, meta?: unknown) => {
    if (meta !== undefined) {
      console.error(formatMessage('error', message), meta);
    } else {
      console.error(formatMessage('error', message));
    }
  },
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      if (meta !== undefined) {
        console.debug(formatMessage('debug', message), meta);
      } else {
        console.debug(formatMessage('debug', message));
      }
    }
  },
};

