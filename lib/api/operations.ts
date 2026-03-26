import type {
  CreateReorderRuleInput,
  ForecastResponse,
  Location,
  ReorderAlert,
  SmartOrderingAlertsResponse,
  ReorderRule,
  SmartOrderSuggestion,
  SmartOrderingDashboard,
  StockMovement,
  StockTransfer,
  UsageAnalytics
} from '../../types';
import api from './client';

interface SmartOrderingAlertsApiResponse {
  alerts: Array<{
    id: string;
    itemId: string;
    itemName: string;
    itemCategory?: string;
    sku?: string;
    alertType?: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    currentQuantity: number;
    availableQuantity?: number;
    allocatedQuantity?: number;
    onOrderQuantity?: number;
    reorderPoint: number;
    suggestedQuantity: number;
    suggestedSupplierId?: string;
    suggestedSupplierName?: string;
    leadTimeDays?: number;
    status: 'pending' | 'acknowledged' | 'ordered' | 'dismissed';
    createdAt: string;
    acknowledgedAt?: string;
    resolutionNotes?: string;
  }>;
  summary: {
    critical: number;
    high: number;
    normal: number;
    total: number;
  };
}

interface SmartOrderingDashboardApiResponse {
  alerts?: {
    critical_alerts?: number;
    high_alerts?: number;
    total_pending_alerts?: number;
  };
  lowStockItems?: Array<{
    id: string;
    name: string;
    currentQuantity: number;
    reorderPoint: number;
    supplierName?: string;
  }>;
  upcomingShortages?: Array<{
    id: string;
    name: string;
    currentQuantity: number;
    allocatedQuantity: number;
    availableAfter: number;
    jobCount: number;
    earliestJobDate?: string;
  }>;
  recentOrders?: Array<{
    id: string;
    poNumber: string;
    status: string;
    createdAt: string;
    total: number;
    supplierName?: string;
    itemCount: number;
  }>;
}

const buildAlertReason = (alertType?: string) => {
  switch (alertType) {
    case 'critical_stock':
      return 'Item is critically low and needs immediate attention.';
    case 'upcoming_job_shortage':
      return 'Upcoming job allocations will consume more stock than is available.';
    case 'lead_time_warning':
      return 'Lead time puts this item at risk of running out before replenishment.';
    case 'auto_order_suggestion':
      return 'Usage patterns suggest placing an order soon.';
    case 'price_drop':
      return 'Supplier pricing has dropped for this item.';
    case 'low_stock':
    default:
      return 'Current stock is at or below the reorder point.';
  }
};

const mapAlert = (alert: SmartOrderingAlertsApiResponse['alerts'][number]): ReorderAlert => ({
  id: alert.id,
  itemId: alert.itemId,
  itemName: alert.itemName,
  itemCategory: alert.itemCategory,
  currentStock: Number(alert.currentQuantity ?? 0),
  reorderPoint: Number(alert.reorderPoint ?? 0),
  suggestedQuantity: Number(alert.suggestedQuantity ?? 0),
  priority: alert.priority,
  status: alert.status,
  reason: buildAlertReason(alert.alertType),
  preferredSupplierId: alert.suggestedSupplierId,
  preferredSupplierName: alert.suggestedSupplierName,
  acknowledgedAt: alert.acknowledgedAt,
  dismissedReason: alert.resolutionNotes,
  createdAt: alert.createdAt,
  updatedAt: alert.acknowledgedAt || alert.createdAt
});

const mapAlertsResponse = (data: SmartOrderingAlertsApiResponse): SmartOrderingAlertsResponse => ({
  alerts: (data.alerts || []).map(mapAlert),
  summary: {
    critical: Number(data.summary?.critical ?? 0),
    high: Number(data.summary?.high ?? 0),
    normal: Number(data.summary?.normal ?? 0),
    total: Number(data.summary?.total ?? 0)
  }
});

const mapDashboardResponse = (data: SmartOrderingDashboardApiResponse): SmartOrderingDashboard => {
  const lowStockItems = data.lowStockItems || [];
  const upcomingShortages = data.upcomingShortages || [];
  const recentOrders = data.recentOrders || [];
  const totalPendingAlerts = Number(data.alerts?.total_pending_alerts ?? 0);
  const criticalAlerts = Number(data.alerts?.critical_alerts ?? 0);
  const highAlerts = Number(data.alerts?.high_alerts ?? 0);

  return {
    summary: {
      pendingAlerts: totalPendingAlerts,
      criticalAlerts,
      highAlerts,
      lowStockItems: lowStockItems.length,
      itemsToReorder: totalPendingAlerts,
      estimatedOrderValue: 0
    },
    lowStockItems: lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: '',
      currentStock: Number(item.currentQuantity ?? 0),
      reorderLevel: Number(item.reorderPoint ?? 0),
      preferredSupplier: item.supplierName
    })),
    upcomingShortages: upcomingShortages.map((item) => ({
      id: item.id,
      name: item.name,
      projectedStockoutDate: item.earliestJobDate || '',
      daysUntilStockout: item.earliestJobDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(item.earliestJobDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0,
      currentStock: Number(item.currentQuantity ?? 0),
      avgDailyUsage: 0
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      supplierName: order.supplierName || 'Unknown supplier',
      totalItems: Number(order.itemCount ?? 0),
      totalValue: Number(order.total ?? 0),
      status: order.status,
      createdAt: order.createdAt
    })),
    topMovingItems: []
  };
};

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
    return mapDashboardResponse(data);
  },

  getAlerts: async (filters?: {
    status?: string;
    priority?: string;
    itemId?: string;
  }): Promise<SmartOrderingAlertsResponse> => {
    const params = filters
      ? {
          ...filters,
          item_id: filters.itemId
        }
      : undefined;
    const { data } = await api.get('/smart-ordering/alerts', { params });
    return mapAlertsResponse(data);
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
