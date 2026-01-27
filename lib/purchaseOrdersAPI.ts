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
  received_by_name?: string;
  received_at: string;
  delivery_date?: string;
  delivery_reference?: string;
  carrier?: string;
  packing_slip_number?: string;
  has_discrepancies: boolean;
  discrepancy_resolved: boolean;
  total_received_value: number;
  notes?: string;
  items?: POReceiptItem[];
}

export interface POReceiptItem {
  id: string;
  receipt_id: string;
  po_item_id: string;
  item_name?: string;
  quantity_received: number;
  quantity_expected?: number;
  condition?: 'good' | 'damaged' | 'defective' | 'wrong_item' | 'partial';
  discrepancy_type?: 'none' | 'short' | 'over' | 'damaged' | 'wrong_item' | 'substitution';
  discrepancy_notes?: string;
  unit_price_received?: number;
  location_id?: string;
  batch_number?: string;
  notes?: string;
}

export interface GoodsInwardDiscrepancy {
  id: string;
  receipt_id: string;
  receipt_item_id?: string;
  po_id: string;
  po_number?: string;
  user_id: string;
  discrepancy_type: 'short_shipment' | 'over_shipment' | 'damaged' | 'defective' |
                    'wrong_item' | 'substitution' | 'quality_issue' | 'price_variance' | 'other';
  inventory_item_id?: string;
  item_name: string;
  quantity_expected?: number;
  quantity_received?: number;
  quantity_variance?: number;
  price_expected?: number;
  price_received?: number;
  price_variance?: number;
  status: 'open' | 'pending_supplier' | 'credit_requested' | 'credit_received' |
          'replacement_ordered' | 'replacement_received' | 'written_off' | 'resolved';
  resolution_notes?: string;
  resolution_action?: string;
  resolved_by?: string;
  resolved_at?: string;
  financial_impact?: number;
  credit_note_number?: string;
  credit_amount?: number;
  supplier_notified: boolean;
  supplier_notified_at?: string;
  supplier_response?: string;
  supplier_response_at?: string;
  supplier_name?: string;
  delivery_date?: string;
  packing_slip_number?: string;
  created_at: string;
  updated_at: string;
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
    condition?: 'good' | 'damaged' | 'defective' | 'wrong_item' | 'partial';
    discrepancy_type?: 'none' | 'short' | 'over' | 'damaged' | 'wrong_item' | 'substitution';
    discrepancy_notes?: string;
    location_id?: string;
    batch_number?: string;
    unit_price_received?: number;
    notes?: string;
  }[];
  notes?: string;
  delivery_reference?: string;
  carrier?: string;
  packing_slip_number?: string;
  quick_check?: 'all_correct' | 'issues_found' | null;
}

export interface ReceivePOResponse {
  message: string;
  receipt_id: string;
  status: string;
  has_discrepancies: boolean;
  discrepancies: GoodsInwardDiscrepancy[];
  stock_movements: {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
  }[];
  items_processed: number;
}

export interface UpdateDiscrepancyRequest {
  status?: string;
  resolution_notes?: string;
  resolution_action?: string;
  credit_note_number?: string;
  credit_amount?: number;
  supplier_notified?: boolean;
  supplier_response?: string;
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
   * Receive items from purchase order (Goods Inward)
   */
  receive: async (id: string, data: ReceivePORequest): Promise<ReceivePOResponse> => {
    const response = await api.post(`/purchase-orders/${id}/receive`, data);
    return response.data;
  },

  /**
   * Get receipts for a purchase order
   */
  getReceipts: async (id: string): Promise<POReceipt[]> => {
    const response = await api.get(`/purchase-orders/${id}/receipts`);
    return response.data;
  },

  /**
   * Get all discrepancies with optional filters
   */
  getDiscrepancies: async (filters?: { status?: string; supplier_id?: string }): Promise<GoodsInwardDiscrepancy[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id);

    const response = await api.get(`/purchase-orders/discrepancies/list?${params.toString()}`);
    return response.data;
  },

  /**
   * Update/resolve a discrepancy
   */
  updateDiscrepancy: async (discrepancyId: string, data: UpdateDiscrepancyRequest): Promise<GoodsInwardDiscrepancy> => {
    const response = await api.put(`/purchase-orders/discrepancies/${discrepancyId}`, data);
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
