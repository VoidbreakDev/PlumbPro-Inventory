
export type ContactType = 'Supplier' | 'Plumber' | 'Customer';

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  company?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  reorderLevel: number;
  supplierId: string;
  supplierCode: string;
  description?: string;
}

export type JobStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Job {
  id: string;
  title: string;
  builder?: string;
  jobType: string;
  assignedWorkerIds: string[]; // Updated to multiple workers
  status: JobStatus;
  date: string;
  allocatedItems: AllocatedItem[];
  isPicked: boolean; // Tracking if stock has been removed from inventory
}

export interface AllocatedItem {
  itemId: string;
  quantity: number;
}

export interface JobTemplate {
  id: string;
  name: string;
  items: AllocatedItem[];
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'In' | 'Out' | 'Adjustment' | 'Allocation';
  quantity: number;
  timestamp: number;
  reference?: string; // Job ID or Order ID
}

export interface SmartOrderSuggestion {
  itemId: string;
  itemName: string;
  suggestedQuantity: number;
  reason: string;
}
