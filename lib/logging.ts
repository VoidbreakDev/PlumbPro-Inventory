import { serializeError } from './errors';

export const logStructuredEvent = (event: string, details: Record<string, unknown> = {}) => {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  console.error('[plumbpro]', payload);
};

export const logSyncFailure = (error: unknown, context: Record<string, unknown> = {}) => {
  logStructuredEvent('sync_failure', {
    ...context,
    error: serializeError(error)
  });
};
