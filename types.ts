
export type ContactType = 'Supplier' | 'Plumber' | 'Customer';

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  company?: string;
  averageRating?: number;
  totalRatings?: number;
}

export interface Location {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface LocationStock {
  locationId: string;
  locationName: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number; // Legacy field - buying price excluding GST
  quantity: number;
  reorderLevel: number;
  supplierId: string;
  supplierCode: string;
  description?: string;
  // Extended pricing fields
  buyPriceExclGST?: number;  // Cost price excluding GST
  buyPriceInclGST?: number;  // Cost price including GST
  sellPriceExclGST?: number; // Invoice/CMP price excluding GST
  sellPriceInclGST?: number; // Invoice/CMP price including GST
  // Multi-location and analytics fields
  locationStock: LocationStock[];
  abcClassification?: 'A' | 'B' | 'C';
  isDeadStock?: boolean;
  lastMovementDate?: string;
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

export type StockMovementType = 'In' | 'Out' | 'Adjustment' | 'Allocation' | 'Transfer';

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  quantity: number;
  timestamp: number;
  reference?: string; // Job ID or Order ID
  locationId?: string;
  locationName?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
}

export interface StockTransfer {
  id: string;
  itemId: string;
  itemName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  quantity: number;
  reason: string;
  timestamp: number;
}

export interface SmartOrderSuggestion {
  itemId: string;
  itemName: string;
  suggestedQuantity: number;
  reason: string;
}

export interface ProfileSettings {
  fullName: string;
  email: string;
  phone: string;
  role: string;
}

export interface CompanySettings {
  companyName: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  abn: string;
  phone: string;
  email: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  lowStockAlerts: boolean;
  jobUpdates: boolean;
  orderConfirmations: boolean;
  systemUpdates: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  dateFormat: string;
  currency: string;
}

export interface AiSettings {
  defaultProvider: string;
  geminiApiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  featureProviders: Record<string, string>;
}

export interface AppSettings {
  profile: ProfileSettings;
  company: CompanySettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  ai: AiSettings;
}

// ====================================
// Supplier Management Types (Phase 2)
// ====================================

export type ContractStatus = 'active' | 'expiring_soon' | 'expired' | null;

export interface ItemSupplier {
  id: string;
  itemId: string;
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  supplierCode: string;
  unitPriceExclGst: number;
  unitPriceInclGst: number;
  leadTimeDays: number;
  isPreferred: boolean;
  isActive: boolean;
  hasContract: boolean;
  contractStartDate?: string;
  contractEndDate?: string;
  contractStatus?: ContractStatus;
  minOrderQuantity?: number;
  notes?: string;
  timesOrdered: number;
  lastOrderedDate?: string;
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  isLowestPrice?: boolean;
  priceRank?: number;
  averageRating?: number;
  totalRatings?: number;
  totalDeliveries?: number;
  onTimePercentage?: number;
}

export interface SupplierComparison {
  item: {
    id: string;
    name: string;
    category: string;
  };
  suppliers: ItemSupplier[];
  summary: {
    totalSuppliers: number;
    lowestPrice: string;
    highestPrice: string;
    avgPrice: string;
    priceDifference: string;
    preferredSupplier: string | null;
  };
}

export interface SupplierRating {
  id: string;
  supplierId: string;
  supplierName?: string;
  overallRating: number;
  qualityRating: number;
  deliveryRating: number;
  communicationRating: number;
  pricingRating: number;
  reviewTitle?: string;
  reviewText?: string;
  wouldRecommend: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RatingSummary {
  supplier: {
    id: string;
    name: string;
    company?: string;
    averageRating: number;
    totalRatings: number;
  };
  breakdown: {
    averages: {
      overall: number;
      quality: number;
      delivery: number;
      communication: number;
      pricing: number;
    };
    distribution: {
      fiveStars: number;
      fourStars: number;
      threeStars: number;
      twoStars: number;
      oneStars: number;
    };
    recommendation: {
      wouldRecommend: number;
      recommendationRate: number;
    };
  };
  recentReviews: SupplierRating[];
}

export type AlertType = 'increase' | 'decrease' | 'no_change';
export type AlertUrgency = 'high' | 'medium' | 'low';

export interface PriceAlert {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  oldPriceExclGst: number;
  newPriceExclGst: number;
  priceDifference: number;
  percentageChange: number;
  alertType: AlertType;
  urgency: AlertUrgency;
  isViewed: boolean;
  isAcknowledged: boolean;
  createdAt: string;
}

export interface PriceAlertSummary {
  totalAlerts: number;
  unviewedAlerts: number;
  unacknowledgedAlerts: number;
  priceIncreases: number;
  priceDecreases: number;
  alertsThisWeek: number;
  alertsThisMonth: number;
  avgPercentageChange: number;
  maxPercentageChange: number;
}

export interface PriceHistoryEntry {
  price: number;
  changedAt: string;
  changeType: AlertType;
  percentageChange?: number;
}

export type DeliveryStatus = 'on_time' | 'late' | 'early' | 'pending';

export interface DeliveryTracking {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  daysEarlyLate?: number;
  deliveryStatus: DeliveryStatus;
  trackingNumber?: string;
  carrier?: string;
  hadIssues: boolean;
  issueDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPerformance {
  supplier: {
    id: string;
    name: string;
    company?: string;
    email: string;
    phone: string;
    averageRating: number;
    totalRatings: number;
  };
  performance: {
    orders: {
      totalOrders: number;
      completedOrders: number;
      pendingOrders: number;
      totalSpent: number;
      avgOrderValue: number;
      firstOrderDate?: string;
      lastOrderDate?: string;
    };
    delivery: {
      totalDeliveries: number;
      onTimeDeliveries: number;
      lateDeliveries: number;
      earlyDeliveries: number;
      avgDaysLate?: number;
      deliveriesWithIssues: number;
      reliabilityPercentage: number | null;
    };
    items: {
      totalItems: number;
      preferredItems: number;
      avgPrice: number;
      avgLeadTime: number;
    };
    pricing: {
      totalPriceChanges: number;
      priceIncreases: number;
      priceDecreases: number;
      avgChangePercent: number;
    };
  };
}

export type PerformanceMetric = 'rating' | 'delivery' | 'orders' | 'value';

export interface TopSupplier {
  id: string;
  name: string;
  company?: string;
  averageRating?: number;
  totalRatings?: number;
  deliveryReliability?: number;
  totalOrders?: number;
  totalValue?: number;
}
