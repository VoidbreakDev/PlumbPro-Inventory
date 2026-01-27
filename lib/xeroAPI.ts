// Xero Integration API Client
import { API_BASE_URL } from './api';

// Types
export interface XeroConnection {
  id: string;
  xero_tenant_id: string;
  xero_tenant_name: string;
  xero_tenant_type: string;
  is_active: boolean;
  sync_contacts: boolean;
  sync_invoices: boolean;
  sync_payments: boolean;
  auto_sync_enabled: boolean;
  sync_frequency_minutes: number;
  last_sync_at: string | null;
  last_sync_status: 'success' | 'partial' | 'failed' | null;
  created_at: string;
  updated_at: string;
}

export interface XeroSyncLog {
  id: string;
  sync_type: 'contacts' | 'invoices' | 'payments' | 'full';
  sync_direction: 'to_xero' | 'from_xero' | 'bidirectional';
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'partial';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_details: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
}

export interface XeroEntityMapping {
  id: string;
  entity_type: 'contact' | 'invoice' | 'payment' | 'item';
  local_entity_id: string;
  xero_entity_id: string;
  last_synced_at: string;
  sync_status: 'synced' | 'pending' | 'error';
  local_entity_name?: string;
}

export interface XeroSettings {
  sync_contacts: boolean;
  sync_invoices: boolean;
  sync_payments: boolean;
  auto_sync_enabled: boolean;
  sync_frequency_minutes: number;
  default_account_code?: string;
  default_tax_type?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  synced: number;
  created: number;
  updated: number;
  failed: number;
  errors?: Array<{
    entity: string;
    error: string;
  }>;
}

// Helper function for API calls
async function xeroFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}/xero${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Xero API
export const xeroAPI = {
  // OAuth Flow
  getAuthUrl: async (): Promise<{ authUrl: string }> => {
    return xeroFetch('/auth-url');
  },

  handleCallback: async (code: string, state: string): Promise<{ success: boolean; tenantName: string }> => {
    return xeroFetch('/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    });
  },

  // Connection Status
  getStatus: async (): Promise<{
    connected: boolean;
    connection?: XeroConnection;
    lastSync?: XeroSyncLog;
  }> => {
    return xeroFetch('/status');
  },

  disconnect: async (): Promise<{ success: boolean; message: string }> => {
    return xeroFetch('/disconnect', {
      method: 'POST',
    });
  },

  // Settings
  updateSettings: async (settings: Partial<XeroSettings>): Promise<{ success: boolean; settings: XeroSettings }> => {
    return xeroFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Sync Operations
  syncContacts: async (direction: 'to_xero' | 'from_xero' | 'bidirectional' = 'bidirectional'): Promise<SyncResult> => {
    return xeroFetch('/sync/contacts', {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },

  syncInvoices: async (options?: {
    invoiceIds?: string[];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SyncResult> => {
    return xeroFetch('/sync/invoices', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  syncSingleInvoice: async (invoiceId: string): Promise<SyncResult> => {
    return xeroFetch(`/sync/invoice/${invoiceId}`, {
      method: 'POST',
    });
  },

  // Sync History
  getSyncHistory: async (options?: {
    limit?: number;
    syncType?: string;
  }): Promise<{ logs: XeroSyncLog[] }> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.syncType) params.append('sync_type', options.syncType);

    const query = params.toString();
    return xeroFetch(`/sync-history${query ? `?${query}` : ''}`);
  },

  // Entity Mappings
  getMappings: async (options?: {
    entityType?: string;
    status?: string;
  }): Promise<{ mappings: XeroEntityMapping[] }> => {
    const params = new URLSearchParams();
    if (options?.entityType) params.append('entity_type', options.entityType);
    if (options?.status) params.append('status', options.status);

    const query = params.toString();
    return xeroFetch(`/mappings${query ? `?${query}` : ''}`);
  },
};

export default xeroAPI;
