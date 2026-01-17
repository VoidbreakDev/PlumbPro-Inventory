/**
 * Stock Returns API Client
 * Type-safe API client for stock return management
 */

import api from './api';

// Types
export interface StockReturn {
  id: string;
  user_id: string;
  job_id: string;
  job_title?: string;
  job_builder?: string;
  returned_at: string;
  returned_by?: string;
  returned_by_name?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: StockReturnItem[];
}

export interface StockReturnItem {
  id: string;
  stock_return_id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity_allocated: number;
  quantity_returned: number;
  quantity_used: number;
  condition: 'good' | 'damaged' | 'lost';
  notes?: string;
  created_at: string;
}

export interface AllocatedItem {
  item_id: string;
  item_name: string;
  category: string;
  quantity_allocated: number;
  quantity_previously_returned: number;
  quantity_remaining: number;
}

export interface JobAllocationData {
  job: {
    id: string;
    title: string;
    builder?: string;
    status: string;
  };
  allocated_items: AllocatedItem[];
}

export interface StockReturnStats {
  total_returns: number;
  pending_returns: number;
  confirmed_returns: number;
  total_items_used: number;
  total_items_returned: number;
}

export interface CreateStockReturnRequest {
  job_id: string;
  items: {
    inventory_item_id: string;
    quantity_allocated: number;
    quantity_returned: number;
    condition?: 'good' | 'damaged' | 'lost';
    notes?: string;
  }[];
  notes?: string;
}

export interface StockReturnFilters {
  status?: 'pending' | 'confirmed' | 'cancelled';
  job_id?: string;
}

// API Methods
export const stockReturnsAPI = {
  /**
   * Get all stock returns
   */
  getAll: async (filters?: StockReturnFilters): Promise<StockReturn[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.job_id) params.append('job_id', filters.job_id);

    const response = await api.get(`/stock-returns?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific stock return
   */
  getById: async (id: string): Promise<StockReturn> => {
    const response = await api.get(`/stock-returns/${id}`);
    return response.data;
  },

  /**
   * Get allocated items for a job (for creating new return)
   */
  getJobAllocation: async (jobId: string): Promise<JobAllocationData> => {
    const response = await api.get(`/stock-returns/job/${jobId}/allocated`);
    return response.data;
  },

  /**
   * Create a new stock return
   */
  create: async (data: CreateStockReturnRequest): Promise<StockReturn> => {
    const response = await api.post('/stock-returns', data);
    return response.data;
  },

  /**
   * Confirm stock return (adds items back to inventory)
   */
  confirm: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/stock-returns/${id}/confirm`);
    return response.data;
  },

  /**
   * Cancel stock return
   */
  cancel: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/stock-returns/${id}/cancel`);
    return response.data;
  },

  /**
   * Delete stock return (only if pending)
   */
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/stock-returns/${id}`);
    return response.data;
  },

  /**
   * Get statistics
   */
  getStats: async (): Promise<StockReturnStats> => {
    const response = await api.get('/stock-returns/stats/summary');
    return response.data;
  }
};

export default stockReturnsAPI;
