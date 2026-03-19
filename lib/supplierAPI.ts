import axios from 'axios';
import { API_BASE_URL } from './api';
import { clearAuthSession, getAuthToken } from './authSession';
import type {
  ItemSupplier,
  SupplierComparison,
  SupplierRating,
  RatingSummary,
  PriceAlert,
  PriceAlertSummary,
  PriceHistoryEntry,
  DeliveryTracking,
  SupplierPerformance,
  TopSupplier,
  PerformanceMetric
} from '../types';

// Create axios instance for supplier APIs
const supplierAPI = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
supplierAPI.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
supplierAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

// ====================================
// Item-Suppliers API
// ====================================

export const itemSuppliersAPI = {
  // Get all suppliers for an item
  getForItem: async (itemId: string): Promise<ItemSupplier[]> => {
    const response = await supplierAPI.get(`/item-suppliers/${itemId}`);
    return response.data.suppliers;
  },

  // Get all item-supplier relationships
  getAll: async (): Promise<ItemSupplier[]> => {
    const response = await supplierAPI.get('/item-suppliers');
    return response.data.relationships;
  },

  // Add supplier to item
  create: async (data: {
    itemId: string;
    supplierId: string;
    supplierCode: string;
    unitPriceExclGst: number;
    unitPriceInclGst: number;
    leadTimeDays: number;
    isPreferred?: boolean;
    hasContract?: boolean;
    contractStartDate?: string;
    contractEndDate?: string;
    minOrderQuantity?: number;
    notes?: string;
  }): Promise<ItemSupplier> => {
    const response = await supplierAPI.post('/item-suppliers', data);
    return response.data.relationship;
  },

  // Update item-supplier relationship
  update: async (id: string, data: Partial<ItemSupplier>): Promise<ItemSupplier> => {
    const response = await supplierAPI.put(`/item-suppliers/${id}`, data);
    return response.data.relationship;
  },

  // Delete item-supplier relationship
  delete: async (id: string): Promise<void> => {
    await supplierAPI.delete(`/item-suppliers/${id}`);
  },

  // Set preferred supplier
  setPreferred: async (id: string): Promise<ItemSupplier> => {
    const response = await supplierAPI.post(`/item-suppliers/${id}/set-preferred`);
    return response.data.relationship;
  },

  // Record order
  recordOrder: async (id: string, orderId: string): Promise<ItemSupplier> => {
    const response = await supplierAPI.post(`/item-suppliers/${id}/record-order`, { orderId });
    return response.data.relationship;
  }
};

// ====================================
// Supplier Ratings API
// ====================================

export const supplierRatingsAPI = {
  // Get all ratings for a supplier
  getForSupplier: async (supplierId: string): Promise<SupplierRating[]> => {
    const response = await supplierAPI.get(`/suppliers/${supplierId}/ratings`);
    return response.data.ratings;
  },

  // Get rating summary for a supplier
  getSummary: async (supplierId: string): Promise<RatingSummary> => {
    const response = await supplierAPI.get(`/suppliers/${supplierId}/rating-summary`);
    return response.data;
  },

  // Create rating for supplier
  create: async (supplierId: string, data: {
    overallRating: number;
    qualityRating: number;
    deliveryRating: number;
    communicationRating: number;
    pricingRating: number;
    reviewTitle?: string;
    reviewText?: string;
    wouldRecommend: boolean;
  }): Promise<SupplierRating> => {
    const response = await supplierAPI.post(`/suppliers/${supplierId}/ratings`, data);
    return response.data.rating;
  },

  // Update rating
  update: async (id: string, data: Partial<SupplierRating>): Promise<SupplierRating> => {
    const response = await supplierAPI.put(`/supplier-ratings/${id}`, data);
    return response.data.rating;
  },

  // Delete rating
  delete: async (id: string): Promise<void> => {
    await supplierAPI.delete(`/supplier-ratings/${id}`);
  },

  // Get all ratings with filters
  getAll: async (filters?: {
    supplierId?: string;
    minRating?: number;
    wouldRecommend?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ ratings: SupplierRating[]; pagination: any }> => {
    const response = await supplierAPI.get('/supplier-ratings', { params: filters });
    return response.data;
  }
};

// ====================================
// Price Alerts API
// ====================================

export const priceAlertsAPI = {
  // Get price alerts with filters
  getAll: async (filters?: {
    viewed?: boolean;
    acknowledged?: boolean;
    itemId?: string;
    supplierId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: PriceAlert[]; pagination: any; statistics: any }> => {
    const response = await supplierAPI.get('/price-alerts', { params: filters });
    return response.data;
  },

  // Get alert summary
  getSummary: async (): Promise<{
    summary: PriceAlertSummary;
    topItems: any[];
    topSuppliers: any[];
  }> => {
    const response = await supplierAPI.get('/price-alerts/summary');
    return response.data;
  },

  // Get specific alert
  getById: async (id: string): Promise<PriceAlert> => {
    const response = await supplierAPI.get(`/price-alerts/${id}`);
    return response.data.alert;
  },

  // Mark alert as viewed
  markViewed: async (id: string): Promise<PriceAlert> => {
    const response = await supplierAPI.post(`/price-alerts/${id}/view`);
    return response.data.alert;
  },

  // Mark alert as acknowledged
  markAcknowledged: async (id: string): Promise<PriceAlert> => {
    const response = await supplierAPI.post(`/price-alerts/${id}/acknowledge`);
    return response.data.alert;
  },

  // Mark all alerts as viewed
  markAllViewed: async (): Promise<{ updated: number }> => {
    const response = await supplierAPI.post('/price-alerts/view-all');
    return response.data;
  },

  // Mark all alerts as acknowledged
  markAllAcknowledged: async (): Promise<{ updated: number }> => {
    const response = await supplierAPI.post('/price-alerts/acknowledge-all');
    return response.data;
  },

  // Delete alert
  delete: async (id: string): Promise<void> => {
    await supplierAPI.delete(`/price-alerts/${id}`);
  },

  // Get price history
  getHistory: async (itemId: string, supplierId: string): Promise<{
    item: any;
    supplier: any;
    currentPrice: number;
    timeline: PriceHistoryEntry[];
  }> => {
    const response = await supplierAPI.get(`/price-alerts/history/${itemId}/${supplierId}`);
    return response.data;
  }
};

// ====================================
// Supplier Analytics API
// ====================================

export const supplierAnalyticsAPI = {
  // Get comprehensive performance metrics
  getPerformance: async (supplierId: string): Promise<SupplierPerformance> => {
    const response = await supplierAPI.get(`/supplier-analytics/${supplierId}/performance`);
    return response.data;
  },

  // Get delivery history
  getDeliveryHistory: async (supplierId: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ deliveries: DeliveryTracking[]; pagination: any }> => {
    const response = await supplierAPI.get(`/supplier-analytics/${supplierId}/delivery-history`, { params });
    return response.data;
  },

  // Create or update delivery tracking
  updateDeliveryTracking: async (data: {
    purchaseOrderId: string;
    expectedDeliveryDate: string;
    actualDeliveryDate?: string;
    trackingNumber?: string;
    carrier?: string;
    hadIssues?: boolean;
    issueDescription?: string;
  }): Promise<DeliveryTracking> => {
    const response = await supplierAPI.post('/supplier-analytics/delivery-tracking', data);
    return response.data.tracking;
  },

  // Get top performing suppliers
  getTopPerformers: async (metric?: PerformanceMetric, limit?: number): Promise<{
    metric: string;
    suppliers: TopSupplier[];
  }> => {
    const response = await supplierAPI.get('/supplier-analytics/top-performers', {
      params: { metric, limit }
    });
    return response.data;
  },

  // Get supplier comparison for an item
  getComparison: async (itemId: string): Promise<SupplierComparison> => {
    const response = await supplierAPI.get('/supplier-analytics/comparison', {
      params: { itemId }
    });
    return response.data;
  }
};

export default supplierAPI;
