// API Access / Developer API Client
import api from './api';

// Types
export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  key?: string; // Only returned on creation
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  isActive: boolean;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  environment: 'production' | 'test' | 'development';
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  expiresAt?: string;
  environment?: 'production' | 'test' | 'development';
}

export interface ApiKeyStats {
  period: string;
  dailyStats: Array<{
    date: string;
    total_requests: number;
    success_count: number;
    error_count: number;
    avg_response_time: number;
    unique_endpoints: number;
  }>;
  topEndpoints: Array<{
    path: string;
    method: string;
    request_count: number;
    avg_response_time: number;
  }>;
  errorBreakdown: Array<{
    error_code: string;
    count: number;
  }>;
}

export interface Webhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  secret?: string; // Only returned on creation
  events: string[];
  isActive: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  timeoutSeconds: number;
  customHeaders: Record<string, string>;
  lastTriggeredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  events: string[];
  retryOnFailure?: boolean;
  maxRetries?: number;
  timeoutSeconds?: number;
  customHeaders?: Record<string, string>;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  eventId: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attemptCount: number;
  responseStatusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface ApiScope {
  name: string;
  description: string;
}

export interface WebhookEvent {
  name: string;
  description: string;
}

export interface ApiDocumentation {
  currentVersion: string;
  versions: Array<{
    version: string;
    is_current: boolean;
    is_deprecated: boolean;
    deprecation_date: string | null;
    sunset_date: string | null;
  }>;
  baseUrl: string;
  authentication: {
    type: string;
    header: string;
    format: string;
  };
  rateLimits: {
    default: {
      perMinute: number;
      perDay: number;
    };
  };
  endpoints: Record<string, Record<string, string>>;
}

// Transform snake_case to camelCase for API keys
function transformApiKey(data: any): ApiKey {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    keyPrefix: data.key_prefix,
    key: data.key,
    scopes: data.scopes,
    rateLimitPerMinute: data.rate_limit_per_minute,
    rateLimitPerDay: data.rate_limit_per_day,
    isActive: data.is_active,
    lastUsedAt: data.last_used_at,
    lastUsedIp: data.last_used_ip,
    expiresAt: data.expires_at,
    environment: data.environment,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Transform snake_case to camelCase for webhooks
function transformWebhook(data: any): Webhook {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    url: data.url,
    secret: data.secret,
    events: data.events,
    isActive: data.is_active,
    retryOnFailure: data.retry_on_failure,
    maxRetries: data.max_retries,
    timeoutSeconds: data.timeout_seconds,
    customHeaders: data.custom_headers || {},
    lastTriggeredAt: data.last_triggered_at,
    lastSuccessAt: data.last_success_at,
    lastFailureAt: data.last_failure_at,
    successCount: data.success_count,
    failureCount: data.failure_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformDelivery(data: any): WebhookDelivery {
  return {
    id: data.id,
    eventType: data.event_type,
    eventId: data.event_id,
    status: data.status,
    attemptCount: data.attempt_count,
    responseStatusCode: data.response_status_code,
    responseTimeMs: data.response_time_ms,
    errorMessage: data.error_message,
    createdAt: data.created_at,
    deliveredAt: data.delivered_at,
  };
}

// API
export const apiAccessAPI = {
  // API Keys
  getApiKeys: async (): Promise<{ keys: ApiKey[] }> => {
    const { data } = await api.get('/developer/keys');
    return { keys: data.keys.map(transformApiKey) };
  },

  createApiKey: async (input: CreateApiKeyInput): Promise<ApiKey & { message: string }> => {
    const { data } = await api.post('/developer/keys', input);
    return { ...transformApiKey(data), message: data.message };
  },

  updateApiKey: async (id: string, updates: Partial<{
    name: string;
    description: string;
    scopes: string[];
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    isActive: boolean;
  }>): Promise<ApiKey> => {
    const { data } = await api.put(`/developer/keys/${id}`, updates);
    return transformApiKey(data);
  },

  revokeApiKey: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete(`/developer/keys/${id}`);
    return data;
  },

  regenerateApiKey: async (id: string): Promise<ApiKey & { message: string }> => {
    const { data } = await api.post(`/developer/keys/${id}/regenerate`);
    return { ...transformApiKey(data), message: data.message };
  },

  getApiKeyStats: async (id: string, period: '7d' | '30d' | '90d' = '7d'): Promise<ApiKeyStats> => {
    const { data } = await api.get(`/developer/keys/${id}/stats`, { params: { period } });
    return data;
  },

  // Webhooks
  getWebhooks: async (): Promise<{ webhooks: Webhook[] }> => {
    const { data } = await api.get('/developer/webhooks');
    return { webhooks: data.webhooks.map(transformWebhook) };
  },

  createWebhook: async (input: CreateWebhookInput): Promise<Webhook & { message: string }> => {
    const { data } = await api.post('/developer/webhooks', input);
    return { ...transformWebhook(data), message: data.message };
  },

  updateWebhook: async (id: string, updates: Partial<CreateWebhookInput & { isActive: boolean }>): Promise<Webhook> => {
    const { data } = await api.put(`/developer/webhooks/${id}`, updates);
    return transformWebhook(data);
  },

  deleteWebhook: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.delete(`/developer/webhooks/${id}`);
    return data;
  },

  testWebhook: async (id: string): Promise<{ success: boolean; message: string; payload: unknown }> => {
    const { data } = await api.post(`/developer/webhooks/${id}/test`);
    return data;
  },

  getWebhookDeliveries: async (id: string, options?: { limit?: number; offset?: number }): Promise<{
    deliveries: WebhookDelivery[];
    total: number;
  }> => {
    const { data } = await api.get(`/developer/webhooks/${id}/deliveries`, { params: options });
    return {
      deliveries: data.deliveries.map(transformDelivery),
      total: data.total
    };
  },

  regenerateWebhookSecret: async (id: string): Promise<{ id: string; name: string; secret: string; message: string }> => {
    const { data } = await api.post(`/developer/webhooks/${id}/regenerate-secret`);
    return data;
  },

  // Documentation
  getScopes: async (): Promise<{ scopes: ApiScope[] }> => {
    const { data } = await api.get('/developer/scopes');
    return data;
  },

  getEvents: async (): Promise<{ events: WebhookEvent[] }> => {
    const { data } = await api.get('/developer/events');
    return data;
  },

  getApiDocs: async (): Promise<ApiDocumentation> => {
    const { data } = await api.get('/developer/docs');
    return data;
  },
};

export default apiAccessAPI;
