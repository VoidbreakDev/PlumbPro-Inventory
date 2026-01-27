// Logging utility that respects environment
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Logger utility that only logs in development mode
 * All logs are stripped in production builds
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    // Warnings are shown in both dev and production
    console.warn(...args);
  },
  
  error: (...args: unknown[]) => {
    // Errors are always shown
    console.error(...args);
  }
};

/**
 * Log sync failures for debugging
 */
export function logSyncFailure(error: unknown, context?: Record<string, unknown>) {
  if (isDevelopment) {
    console.error('Sync failure:', error, context);
  }
  // In production, you might want to send this to a logging service
  // like Sentry, LogRocket, etc.
}

export default logger;
