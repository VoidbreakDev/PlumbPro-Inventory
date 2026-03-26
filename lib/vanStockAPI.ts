// Van Stock Management API Client
import api from './api';

// Types
export interface ServiceVan {
  id: string;
  name: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToEmail?: string;
  assignedToFullName?: string;
  isActive: boolean;
  status: 'active' | 'maintenance' | 'retired' | 'lost' | 'stolen';
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationUpdate: string | null;
  maxWeightKg: number | null;
  maxVolumeM3: number | null;
  notes: string | null;
  totalItems?: number;
  lowStockItems?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VanStockItem {
  id: string;
  vanId: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  binLocation: string | null;
  lastRestockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VanStockMovement {
  id: string;
  vanId: string;
  vanName: string;
  itemId: string;
  itemName: string;
  sku: string;
  movementType: 'restock' | 'return' | 'job_usage' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'damaged' | 'lost';
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  jobId: string | null;
  sourceVanId: string | null;
  destinationVanId: string | null;
  performedByName: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface RestockRequest {
  id: string;
  vanId: string;
  vanName: string;
  assignedToName: string;
  status: 'pending' | 'approved' | 'processing' | 'ready' | 'completed' | 'cancelled';
  requestedByName: string;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  pickupLocation: string | null;
  pickupTime: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes: string | null;
  itemCount: number;
  totalItems: number;
  createdAt: string;
}

export interface RestockItem {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  quantityRequested: number;
  quantityApproved: number | null;
  quantityFulfilled: number | null;
  currentVanQuantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  notes: string | null;
}

export interface StockCheckin {
  id: string;
  vanId: string;
  checkinType: 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
  performedByName: string;
  totalItemsChecked: number;
  discrepanciesFound: number;
  status: 'in_progress' | 'completed' | 'discrepancies_pending';
  lat: number | null;
  lng: number | null;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface CheckinItem {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  binLocation: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  discrepancy: number | null;
  discrepancyReason: string | null;
  discrepancyResolved: boolean;
}

export interface LowStockItem {
  id: string;
  vanId: string;
  vanName: string;
  assignedToName: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  quantity: number;
  minQuantity: number;
}

// Transform snake_case to camelCase
function transformVan(data: any): ServiceVan {
  return {
    id: data.id,
    name: data.name,
    registration: data.registration,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
    assignedToId: data.assigned_to_id,
    assignedToName: data.assigned_to_name,
    assignedToEmail: data.assigned_to_email,
    assignedToFullName: data.assigned_to_full_name,
    isActive: data.is_active,
    status: data.status,
    lastKnownLat: data.last_known_lat,
    lastKnownLng: data.last_known_lng,
    lastLocationUpdate: data.last_location_update,
    maxWeightKg: data.max_weight_kg,
    maxVolumeM3: data.max_volume_m3,
    notes: data.notes,
    totalItems: data.total_items,
    lowStockItems: data.low_stock_items,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformStockItem(data: any): VanStockItem {
  return {
    id: data.id,
    vanId: data.van_id,
    itemId: data.item_id,
    itemName: data.item_name,
    sku: data.sku,
    category: data.category,
    unit: data.unit,
    price: data.price,
    quantity: data.quantity,
    minQuantity: data.min_quantity,
    maxQuantity: data.max_quantity,
    binLocation: data.bin_location,
    lastRestockedAt: data.last_restocked_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformMovement(data: any): VanStockMovement {
  return {
    id: data.id,
    vanId: data.van_id,
    vanName: data.van_name,
    itemId: data.item_id,
    itemName: data.item_name,
    sku: data.sku,
    movementType: data.movement_type,
    quantity: data.quantity,
    quantityBefore: data.quantity_before,
    quantityAfter: data.quantity_after,
    jobId: data.job_id,
    sourceVanId: data.source_van_id,
    destinationVanId: data.destination_van_id,
    performedByName: data.performed_by_name,
    notes: data.notes,
    lat: data.lat,
    lng: data.lng,
    createdAt: data.created_at,
  };
}

function transformRestockRequest(data: any): RestockRequest {
  return {
    id: data.id,
    vanId: data.van_id,
    vanName: data.van_name,
    assignedToName: data.assigned_to_name,
    status: data.status,
    requestedByName: data.requested_by_name,
    requestedAt: data.requested_at,
    approvedAt: data.approved_at,
    completedAt: data.completed_at,
    pickupLocation: data.pickup_location,
    pickupTime: data.pickup_time,
    priority: data.priority,
    notes: data.notes,
    itemCount: parseInt(data.item_count) || 0,
    totalItems: parseInt(data.total_items) || 0,
    createdAt: data.created_at,
  };
}

function transformCheckin(data: any): StockCheckin {
  return {
    id: data.id,
    vanId: data.van_id,
    checkinType: data.checkin_type,
    performedByName: data.performed_by_name,
    totalItemsChecked: data.total_items_checked,
    discrepanciesFound: data.discrepancies_found,
    status: data.status,
    lat: data.lat,
    lng: data.lng,
    notes: data.notes,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

function transformCheckinItem(data: any): CheckinItem {
  return {
    id: data.id,
    itemId: data.item_id,
    itemName: data.item_name,
    sku: data.sku,
    category: data.category,
    binLocation: data.bin_location,
    expectedQuantity: data.expected_quantity,
    countedQuantity: data.counted_quantity,
    discrepancy: data.discrepancy,
    discrepancyReason: data.discrepancy_reason,
    discrepancyResolved: data.discrepancy_resolved,
  };
}

// API
export const vanStockAPI = {
  // Service Vans
  getVans: async (): Promise<{ vans: ServiceVan[] }> => {
    const { data } = await api.get('/van-stock/vans');
    return { vans: data.vans.map(transformVan) };
  },

  getVan: async (id: string): Promise<{ van: ServiceVan; stock: VanStockItem[] }> => {
    const { data } = await api.get(`/van-stock/vans/${id}`);
    return {
      van: transformVan(data.van),
      stock: data.stock.map(transformStockItem)
    };
  },

  createVan: async (input: {
    name: string;
    registration?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    assignedToId?: string;
    maxWeightKg?: number;
    maxVolumeM3?: number;
    notes?: string;
  }): Promise<ServiceVan> => {
    const { data } = await api.post('/van-stock/vans', input);
    return transformVan(data);
  },

  updateVan: async (id: string, updates: Partial<{
    name: string;
    registration: string;
    make: string;
    model: string;
    year: number;
    color: string;
    assignedToId: string;
    status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
    isActive: boolean;
    maxWeightKg: number;
    maxVolumeM3: number;
    notes: string;
    lastKnownLat: number;
    lastKnownLng: number;
  }>): Promise<ServiceVan> => {
    const { data } = await api.put(`/van-stock/vans/${id}`, updates);
    return transformVan(data);
  },

  deleteVan: async (id: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/van-stock/vans/${id}`);
    return data;
  },

  // Van Stock
  getLowStock: async (): Promise<{ items: LowStockItem[] }> => {
    const { data } = await api.get('/van-stock/low-stock');
    return {
      items: data.items.map((item: any) => ({
        id: item.id,
        vanId: item.van_id,
        vanName: item.van_name,
        assignedToName: item.assigned_to_name,
        itemId: item.item_id,
        itemName: item.item_name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        minQuantity: item.min_quantity,
      }))
    };
  },

  updateStock: async (vanId: string, input: {
    itemId: string;
    quantity: number;
    minQuantity?: number;
    maxQuantity?: number;
    binLocation?: string;
    movementType?: string;
    notes?: string;
    jobId?: string;
    lat?: number;
    lng?: number;
  }): Promise<VanStockItem> => {
    const { data } = await api.post(`/van-stock/vans/${vanId}/stock`, input);
    return transformStockItem(data);
  },

  bulkUpdateStock: async (vanId: string, input: {
    items: Array<{
      itemId: string;
      quantity: number;
      minQuantity?: number;
      maxQuantity?: number;
    }>;
    movementType?: string;
    notes?: string;
    lat?: number;
    lng?: number;
  }): Promise<{ updated: number; items: VanStockItem[] }> => {
    const { data } = await api.post(`/van-stock/vans/${vanId}/stock/bulk`, input);
    return {
      updated: data.updated,
      items: data.items.map(transformStockItem)
    };
  },

  useStock: async (vanId: string, input: {
    itemId: string;
    quantity: number;
    jobId?: string;
    notes?: string;
    lat?: number;
    lng?: number;
  }): Promise<{ success: boolean; itemName: string; quantityUsed: number; quantityRemaining: number }> => {
    const { data } = await api.post(`/van-stock/vans/${vanId}/use`, input);
    return data;
  },

  // Restock Requests
  getRestockRequests: async (options?: {
    status?: string;
    vanId?: string;
  }): Promise<{ requests: RestockRequest[] }> => {
    const { data } = await api.get('/van-stock/restock-requests', { params: options });
    return { requests: data.requests.map(transformRestockRequest) };
  },

  getRestockRequest: async (id: string): Promise<{ request: RestockRequest; items: RestockItem[] }> => {
    const { data } = await api.get(`/van-stock/restock-requests/${id}`);
    return {
      request: transformRestockRequest(data.request),
      items: data.items.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        itemName: item.item_name,
        sku: item.sku,
        category: item.category,
        quantityRequested: item.quantity_requested,
        quantityApproved: item.quantity_approved,
        quantityFulfilled: item.quantity_fulfilled,
        currentVanQuantity: item.current_van_quantity,
        minQuantity: item.min_quantity,
        maxQuantity: item.max_quantity,
        notes: item.notes,
      }))
    };
  },

  createRestockRequest: async (input: {
    vanId: string;
    items: Array<{ itemId: string; quantity: number; notes?: string }>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notes?: string;
    pickupLocation?: string;
    pickupTime?: string;
  }): Promise<RestockRequest> => {
    const { data } = await api.post('/van-stock/restock-requests', input);
    return transformRestockRequest(data);
  },

  updateRestockRequestStatus: async (id: string, status: string, approvedItems?: Array<{
    itemId: string;
    quantityApproved: number;
  }>): Promise<RestockRequest> => {
    const { data } = await api.put(`/van-stock/restock-requests/${id}/status`, { status, approvedItems });
    return transformRestockRequest(data);
  },

  // Stock Check-ins
  startCheckin: async (vanId: string, input?: {
    checkinType?: 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
    lat?: number;
    lng?: number;
  }): Promise<{ checkin: StockCheckin; items: CheckinItem[] }> => {
    const { data } = await api.post(`/van-stock/vans/${vanId}/checkin`, input || {});
    return {
      checkin: transformCheckin(data.checkin),
      items: data.items.map(transformCheckinItem)
    };
  },

  updateCheckinItem: async (checkinId: string, itemId: string, input: {
    countedQuantity: number;
    discrepancyReason?: string;
  }): Promise<CheckinItem> => {
    const { data } = await api.put(`/van-stock/checkins/${checkinId}/items/${itemId}`, input);
    return transformCheckinItem(data);
  },

  completeCheckin: async (checkinId: string, input?: {
    applyAdjustments?: boolean;
    notes?: string;
  }): Promise<{
    success: boolean;
    totalItems: number;
    discrepancies: number;
    adjustmentsApplied: boolean;
    status: string;
  }> => {
    const { data } = await api.post(`/van-stock/checkins/${checkinId}/complete`, input || {});
    return data;
  },

  // Movement History
  getMovements: async (options?: {
    vanId?: string;
    itemId?: string;
    movementType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ movements: VanStockMovement[] }> => {
    const { data } = await api.get('/van-stock/movements', { params: options });
    return { movements: data.movements.map(transformMovement) };
  },
};

export default vanStockAPI;
