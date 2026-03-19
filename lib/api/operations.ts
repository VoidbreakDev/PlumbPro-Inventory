import type {
  CreateReorderRuleInput,
  ForecastResponse,
  Location,
  ReorderAlert,
  ReorderRule,
  SmartOrderSuggestion,
  SmartOrderingDashboard,
  StockMovement,
  StockTransfer,
  UsageAnalytics
} from '../../types';
import api from './client';

export const movementsAPI = {
  getAll: async (filters?: {
    type?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StockMovement[]> => {
    const { data } = await api.get('/movements', { params: filters });
    return data;
  }
};

export const smartOrderingAPI = {
  getSuggestions: async (): Promise<{ suggestions: SmartOrderSuggestion[] }> => {
    const { data } = await api.post('/smart-ordering/suggestions');
    return data;
  },

  getDashboard: async (): Promise<SmartOrderingDashboard> => {
    const { data } = await api.get('/smart-ordering/dashboard');
    return data;
  },

  getAlerts: async (filters?: {
    status?: string;
    priority?: string;
    itemId?: string;
  }): Promise<ReorderAlert[]> => {
    const { data } = await api.get('/smart-ordering/alerts', { params: filters });
    return data;
  },

  acknowledgeAlert: async (alertId: string): Promise<ReorderAlert> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/acknowledge`);
    return data;
  },

  dismissAlert: async (alertId: string, reason?: string): Promise<ReorderAlert> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/dismiss`, { reason });
    return data;
  },

  createPOFromAlert: async (alertId: string): Promise<{ alert: ReorderAlert; purchaseOrder: any }> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/create-po`);
    return data;
  },

  getRules: async (itemId?: string): Promise<ReorderRule[]> => {
    const params = itemId ? { itemId } : undefined;
    const { data } = await api.get('/smart-ordering/rules', { params });
    return data;
  },

  createOrUpdateRule: async (rule: CreateReorderRuleInput): Promise<ReorderRule> => {
    const { data } = await api.post('/smart-ordering/rules', rule);
    return data;
  },

  deleteRule: async (itemId: string): Promise<void> => {
    await api.delete(`/smart-ordering/rules/${itemId}`);
  },

  getUsageAnalytics: async (itemId: string): Promise<UsageAnalytics> => {
    const { data } = await api.get(`/smart-ordering/usage/${itemId}`);
    return data;
  },

  checkAllStock: async (): Promise<{ alertsCreated: number; itemsChecked: number }> => {
    const { data } = await api.post('/smart-ordering/check-all');
    return data;
  },

  getForecasts: async (days?: number): Promise<ForecastResponse> => {
    const params = days ? { days } : undefined;
    const { data } = await api.get('/smart-ordering/forecasts', { params });
    return data;
  }
};

export const locationsAPI = {
  getAll: async (): Promise<Location[]> => {
    const { data } = await api.get('/locations');
    return data;
  },

  getById: async (id: string): Promise<Location> => {
    const { data } = await api.get(`/locations/${id}`);
    return data;
  },

  create: async (location: Omit<Location, 'id'>): Promise<Location> => {
    const { data } = await api.post('/locations', location);
    return data;
  },

  update: async (id: string, updates: Partial<Location>): Promise<Location> => {
    const { data } = await api.put(`/locations/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/locations/${id}`);
    return data;
  },

  getStock: async (id: string) => {
    const { data } = await api.get(`/locations/${id}/stock`);
    return data;
  }
};

export const stockTransfersAPI = {
  getAll: async (filters?: {
    itemId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StockTransfer[]> => {
    const { data } = await api.get('/stock-transfers', { params: filters });
    return data;
  },

  create: async (transfer: {
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    reason?: string;
  }): Promise<StockTransfer> => {
    const { data } = await api.post('/stock-transfers', transfer);
    return data;
  }
};

export const analyticsAPI = {
  getABCClassification: async () => {
    const { data } = await api.get('/analytics/abc-classification');
    return data;
  },

  recalculateABC: async () => {
    const { data } = await api.post('/analytics/recalculate-abc');
    return data;
  },

  getDeadStock: async () => {
    const { data } = await api.get('/analytics/dead-stock');
    return data;
  }
};
