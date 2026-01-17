/**
 * Purchase Orders API Client
 * Type-safe API client for purchase order management
 */

import api from './api';

// Types
export interface PurchaseOrder {
  id: string;
  user_id: string;
  po_number: string;
  supplier_id?: string;
  supplier_name?: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  created_at: string;
  sent_at?: string;
  expected_delivery_date?: string;
  received_at?: string;
  delivery_location?: 'warehouse' | 'direct_to_site';
  deliver_to_job_id?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  notes?: string;
  internal_notes?: string;
  created_by?: string;
  created_by_name?: string;
  metadata?: any;

  // Computed fields from joins
  item_count?: number;
  job_count?: number;

  // Populated when fetching single PO
  items?: PurchaseOrderItem[];
  jobs?: POJob[];
  history?: POHistoryEntry[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id?: string;
  item_name: string;
  item_description?: string;
  supplier_code?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  line_total: number;
  created_at: string;

  // From joins
  current_item_name?: string;
  item_category?: string;
}

export interface POJob {
  id: string;
  title: string;
  status: string;
  date?: string;
  builder?: string;
}

export interface POHistoryEntry {
  id: string;
  purchase_order_id: string;
  user_id?: string;
  user_name?: string;
  status: string;
  notes?: string;
  created_at: string;
}

export interface POReceipt {
  id: string;
  purchase_order_id: string;
  received_by?: string;
  received_at: string;
  notes?: string;
  stock_movement_id?: string;
}

export interface POReceiptItem {
  id: string;
  receipt_id: string;
  po_item_id: string;
  quantity_received: number;
  notes?: string;
}

export interface CreatePORequest {
  supplier_id?: string;
  items: {
    inventory_item_id?: string;
    item_name: string;
    item_description?: string;
    supplier_code?: string;
    quantity_ordered: number;
    unit_price: number;
  }[];
  job_ids?: string[];
  expected_delivery_date?: string;
  delivery_location?: 'warehouse' | 'direct_to_site';
  deliver_to_job_id?: string;
  notes?: string;
  internal_notes?: string;
  tax?: number;
  shipping?: number;
}

export interface UpdatePORequest {
  supplier_id?: string;
  expected_delivery_date?: string;
  delivery_location?: 'warehouse' | 'direct_to_site';
  deliver_to_job_id?: string;
  notes?: string;
  internal_notes?: string;
  tax?: number;
  shipping?: number;
  items?: {
    inventory_item_id?: string;
    item_name: string;
    item_description?: string;
    supplier_code?: string;
    quantity_ordered: number;
    unit_price: number;
  }[];
}

export interface ReceivePORequest {
  items: {
    po_item_id: string;
    quantity_received: number;
  }[];
  notes?: string;
}

export interface POStats {
  total_orders: number;
  draft_orders: number;
  sent_orders: number;
  received_orders: number;
  partially_received_orders: number;
  total_value: number;
  pending_value: number;
  received_value: number;
}

export interface POFilters {
  status?: string;
  supplier_id?: string;
  from_date?: string;
  to_date?: string;
}

// API Methods
export const purchaseOrdersAPI = {
  /**
   * Get all purchase orders with optional filters
   */
  getAll: async (filters?: POFilters): Promise<PurchaseOrder[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);

    const response = await api.get(`/purchase-orders?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific purchase order with items, jobs, and history
   */
  getById: async (id: string): Promise<PurchaseOrder> => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  /**
   * Create a new purchase order
   */
  create: async (data: CreatePORequest): Promise<PurchaseOrder> => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  /**
   * Update a purchase order (draft only)
   */
  update: async (id: string, data: UpdatePORequest): Promise<PurchaseOrder> => {
    const response = await api.put(`/purchase-orders/${id}`, data);
    return response.data;
  },

  /**
   * Send purchase order to supplier
   */
  send: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/purchase-orders/${id}/send`);
    return response.data;
  },

  /**
   * Receive items from purchase order
   */
  receive: async (id: string, data: ReceivePORequest): Promise<{ message: string; receipt_id: string; status: string }> => {
    const response = await api.post(`/purchase-orders/${id}/receive`, data);
    return response.data;
  },

  /**
   * Cancel a purchase order
   */
  cancel: async (id: string, reason?: string): Promise<PurchaseOrder> => {
    const response = await api.post(`/purchase-orders/${id}/cancel`, { reason });
    return response.data;
  },

  /**
   * Delete a purchase order (draft only)
   */
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/purchase-orders/${id}`);
    return response.data;
  },

  /**
   * Get purchase order statistics
   */
  getStats: async (): Promise<POStats> => {
    const response = await api.get('/purchase-orders/stats/summary');
    return response.data;
  }
};

export default purchaseOrdersAPI;
