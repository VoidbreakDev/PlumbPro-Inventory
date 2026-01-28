
export type ContactType = 'Supplier' | 'Plumber' | 'Customer';
export type CustomerType = 'residential' | 'commercial' | 'builder' | 'developer' | 'government' | 'other';
export type ContactStatus = 'active' | 'inactive' | 'blacklisted';
export type PreferredContactMethod = 'email' | 'phone' | 'sms' | 'any';

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  company?: string;

  // Address fields
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostcode?: string;
  addressCountry?: string;

  // Business details
  abn?: string;
  billingEmail?: string;
  website?: string;

  // Primary contact (for companies)
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;

  // Customer classification
  customerType?: CustomerType;
  tags?: string[];
  status?: ContactStatus;
  isVip?: boolean;
  creditLimit?: number;

  // Default pricing settings
  defaultMarkupPercentage?: number;
  defaultDiscountPercentage?: number;
  defaultPaymentTerms?: PaymentTerms;
  customPaymentDays?: number;

  // Notes and preferences
  internalNotes?: string;
  preferredContactMethod?: PreferredContactMethod;

  // Billing address (if different from main)
  billingAddressStreet?: string;
  billingAddressCity?: string;
  billingAddressState?: string;
  billingAddressPostcode?: string;

  // Rating (for suppliers)
  averageRating?: number;
  totalRatings?: number;

  // Computed fields (from API)
  quoteCount?: number;
  invoiceCount?: number;
  outstandingBalance?: number;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// Customer Note for communication tracking
export type NoteType = 'general' | 'phone_call' | 'email' | 'meeting' | 'site_visit' | 'complaint' | 'follow_up';

export interface CustomerNote {
  id: string;
  contactId: string;
  userId: string;
  userName?: string;
  noteType: NoteType;
  subject?: string;
  content: string;
  isFollowUpRequired: boolean;
  followUpDate?: string;
  isFollowUpCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerNoteInput {
  content: string;
  noteType?: NoteType;
  subject?: string;
  isFollowUpRequired?: boolean;
  followUpDate?: string;
}

// Service Agreement for recurring work
export type AgreementType = 'maintenance' | 'service' | 'warranty' | 'support' | 'other';
export type AgreementStatus = 'draft' | 'active' | 'expired' | 'cancelled' | 'pending_renewal';
export type BillingFrequency = 'one_time' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface ServiceAgreement {
  id: string;
  userId: string;
  contactId: string;
  agreementNumber: string;
  title: string;
  description?: string;
  agreementType: AgreementType;
  status: AgreementStatus;
  startDate: string;
  endDate?: string;
  nextServiceDate?: string;
  billingFrequency: BillingFrequency;
  billingAmount?: number;
  serviceFrequency?: string;
  includedServices?: string;
  totalValue?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceAgreementInput {
  title: string;
  description?: string;
  agreementType?: AgreementType;
  status?: AgreementStatus;
  startDate: string;
  endDate?: string;
  nextServiceDate?: string;
  billingFrequency?: BillingFrequency;
  billingAmount?: number;
  serviceFrequency?: string;
  includedServices?: string;
  totalValue?: number;
  notes?: string;
}

// Customer Pricing Rules
export type PriceType = 'fixed' | 'markup' | 'discount';

export interface CustomerPricing {
  id: string;
  userId: string;
  contactId: string;
  inventoryItemId?: string;
  itemName?: string;
  category?: string;
  priceType: PriceType;
  priceValue: number;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerPricingInput {
  inventoryItemId?: string;
  category?: string;
  priceType: PriceType;
  priceValue: number;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
}

// Customer History (aggregated data)
export interface CustomerHistory {
  contact: Contact;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    title: string;
    status: string;
    total: number;
    createdAt: string;
    validUntil?: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    status: string;
    total: number;
    amountPaid: number;
    amountDue: number;
    dueDate?: string;
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    scheduledDate?: string;
    createdAt: string;
  }>;
  notes: CustomerNote[];
  serviceAgreements: ServiceAgreement[];
  stats: CustomerStats;
}

export interface CustomerStats {
  totalQuotes: number;
  approvedQuotes: number;
  totalQuotesValue: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  totalJobs: number;
  activeAgreements: number;
}

export interface ContactStats {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  totalSuppliers: number;
  totalPlumbers: number;
  totalOutstanding: number;
  overdueInvoicesCount: number;
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
  // Tier-based AI configuration (Ollama/local LLM removed)
  subscriptionTier: 'solo' | 'team' | 'business';
  preferredProvider: 'auto' | 'gemini' | 'openai' | 'anthropic';
  preferredModel: string;
  dailyQuotaUsed: number;
  dailyQuotaReset: string;
  featureProviders: Record<string, string>;
  // API keys (stored server-side for security)
  hasCustomApiKey: boolean;
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

// ====================================
// Quoting System Types (Phase 1 MVP)
// ====================================

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired' | 'converted';
export type QuoteItemType = 'material' | 'labor' | 'other' | 'subcontractor';
export type DiscountType = 'fixed' | 'percentage';

export interface Quote {
  id: string;
  quoteNumber: string;

  // Customer
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerDisplayName?: string;
  customerCompany?: string;

  // Job linkage
  jobId?: string;
  jobTitle?: string;

  // Quote details
  title: string;
  description?: string;
  status: QuoteStatus;

  // Validity
  validFrom: string;
  validUntil?: string;

  // Financial
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  defaultMarkupPercentage: number;

  // Terms
  terms?: string;
  notes?: string;
  customerNotes?: string;

  // Approval
  requiresApproval: boolean;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Tracking
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  convertedToInvoiceId?: string;

  // Versioning
  version: number;
  parentQuoteId?: string;

  // Metadata
  createdBy?: string;
  createdByName?: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;

  // Related data (populated on detail fetch)
  items?: QuoteItem[];
  history?: QuoteHistoryEntry[];
}

export interface QuoteItem {
  id: string;
  quoteId: string;

  // Item type
  itemType: QuoteItemType;

  // Inventory link
  inventoryItemId?: string;

  // Item details
  itemName: string;
  itemDescription?: string;
  itemCode?: string;

  // Quantity and pricing
  quantity: number;
  unit: string;
  unitCost: number;
  markupPercentage: number;
  unitPrice: number;
  lineTotal: number;
  profitMargin: number;

  // Display
  sortOrder: number;
  groupName?: string;

  // Inventory info (from joins)
  currentItemName?: string;
  itemCategory?: string;
  itemStockQuantity?: number;

  createdAt: string;
  updatedAt: string;
}

export interface QuoteHistoryEntry {
  id: string;
  quoteId: string;
  userId?: string;
  userName?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  notes?: string;
  totalAtAction: number;
  createdAt: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  defaultTerms?: string;
  defaultCustomerNotes?: string;
  defaultValidityDays: number;
  defaultMarkupPercentage: number;
  jobType?: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteStats {
  totalQuotes: number;
  draftQuotes: number;
  sentQuotes: number;
  approvedQuotes: number;
  rejectedQuotes: number;
  expiredQuotes: number;
  convertedQuotes: number;
  totalValue: number;
  pendingValue: number;
  approvedValue: number;
  convertedValue: number;
  avgQuoteValue: number;
  quotesThisMonth: number;
  approvedThisMonth: number;
}

export interface CreateQuoteInput {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  jobId?: string;
  title: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  discountType?: DiscountType;
  discountValue?: number;
  taxRate?: number;
  defaultMarkupPercentage?: number;
  terms?: string;
  notes?: string;
  customerNotes?: string;
  requiresApproval?: boolean;
  items?: CreateQuoteItemInput[];
}

export interface CreateQuoteItemInput {
  itemType?: QuoteItemType;
  inventoryItemId?: string;
  itemName: string;
  itemDescription?: string;
  itemCode?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  markupPercentage?: number;
  unitPrice?: number;
  sortOrder?: number;
  groupName?: string;
}

// ====================================
// Invoicing System Types (Phase 1 MVP)
// ====================================

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'void';
export type PaymentTerms = 'DUE_ON_RECEIPT' | 'NET7' | 'NET14' | 'NET30' | 'NET60' | 'CUSTOM';
export type PaymentMethod = 'cash' | 'cheque' | 'bank_transfer' | 'credit_card' | 'eftpos' | 'paypal' | 'stripe' | 'other';

export interface Invoice {
  id: string;
  invoiceNumber: string;

  // Customer
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerAbn?: string;
  customerDisplayName?: string;
  customerCompany?: string;

  // Source linkage
  jobId?: string;
  jobTitle?: string;
  quoteId?: string;
  quoteNumber?: string;

  // Invoice details
  title: string;
  description?: string;
  status: InvoiceStatus;

  // Dates
  invoiceDate: string;
  dueDate?: string;
  paymentTerms: PaymentTerms;
  customTermsDays?: number;

  // Financial
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;

  // Terms and notes
  terms?: string;
  notes?: string;
  customerNotes?: string;
  paymentInstructions?: string;

  // Bank details
  bankName?: string;
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;

  // Tracking
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
  lastPaymentDate?: string;
  lastReminderSentAt?: string;
  reminderCount?: number;

  // Progress invoicing
  isProgressInvoice?: boolean;
  progressPercentage?: number;
  parentInvoiceId?: string;

  // Metadata
  createdBy?: string;
  createdByName?: string;
  itemCount?: number;
  paymentCount?: number;
  createdAt: string;
  updatedAt: string;

  // Related data (populated on detail fetch)
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  history?: InvoiceHistoryEntry[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;

  // Item type
  itemType: QuoteItemType;

  // Inventory link
  inventoryItemId?: string;

  // Item details
  itemName: string;
  itemDescription?: string;
  itemCode?: string;

  // Quantity and pricing
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  isTaxable: boolean;

  // Display
  sortOrder: number;
  groupName?: string;

  // Inventory info (from joins)
  currentItemName?: string;
  itemCategory?: string;

  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  recordedByName?: string;
  createdAt: string;
}

export interface InvoiceHistoryEntry {
  id: string;
  invoiceId: string;
  userId?: string;
  userName?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  notes?: string;
  totalAtAction: number;
  amountPaidAtAction?: number;
  createdAt: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  partiallyPaidInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalValue: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueValue: number;
  avgInvoiceValue: number;
  invoicesThisMonth: number;
  revenueThisMonth: number;
  collectedThisMonth: number;
}

export interface CreateInvoiceInput {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerAbn?: string;
  jobId?: string;
  quoteId?: string;
  title: string;
  description?: string;
  invoiceDate?: string;
  paymentTerms?: PaymentTerms;
  customTermsDays?: number;
  discountType?: DiscountType;
  discountValue?: number;
  taxRate?: number;
  terms?: string;
  notes?: string;
  customerNotes?: string;
  paymentInstructions?: string;
  bankName?: string;
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  isProgressInvoice?: boolean;
  progressPercentage?: number;
  parentInvoiceId?: string;
  items?: CreateInvoiceItemInput[];
}

export interface CreateInvoiceItemInput {
  itemType?: QuoteItemType;
  inventoryItemId?: string;
  itemName: string;
  itemDescription?: string;
  itemCode?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  isTaxable?: boolean;
  sortOrder?: number;
  groupName?: string;
}

export interface RecordPaymentInput {
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

// ====================================
// Smart Ordering System Types (Phase 3)
// ====================================

export type ReorderAlertStatus = 'pending' | 'acknowledged' | 'ordered' | 'dismissed';
export type ReorderAlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ReorderRule {
  id: string;
  itemId: string;
  itemName?: string;
  itemCategory?: string;
  reorderPoint: number;
  reorderQuantity: number;
  maxStockLevel?: number;
  leadTimeDays: number;
  safetyStockDays: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  autoCreatePo: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderAlert {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory?: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  priority: ReorderAlertPriority;
  status: ReorderAlertStatus;
  reason: string;
  daysOfStockRemaining?: number;
  avgDailyUsage?: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  purchaseOrderId?: string;
  poNumber?: string;
  dismissedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageAnalytics {
  itemId: string;
  itemName: string;
  avgDailyUsage: number;
  avgWeeklyUsage: number;
  avgMonthlyUsage: number;
  totalUsage30Days: number;
  totalUsage90Days: number;
  usageTrend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  daysOfStockRemaining: number;
  projectedStockoutDate?: string;
  usageHistory: UsageHistoryEntry[];
}

export interface UsageHistoryEntry {
  date: string;
  quantity: number;
  movementType: string;
  reference?: string;
}

export interface SmartOrderingDashboard {
  summary: {
    pendingAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    lowStockItems: number;
    itemsToReorder: number;
    estimatedOrderValue: number;
  };
  lowStockItems: Array<{
    id: string;
    name: string;
    category: string;
    currentStock: number;
    reorderLevel: number;
    daysRemaining?: number;
    preferredSupplier?: string;
  }>;
  upcomingShortages: Array<{
    id: string;
    name: string;
    projectedStockoutDate: string;
    daysUntilStockout: number;
    currentStock: number;
    avgDailyUsage: number;
  }>;
  recentOrders: Array<{
    id: string;
    poNumber: string;
    supplierName: string;
    totalItems: number;
    totalValue: number;
    status: string;
    createdAt: string;
  }>;
  topMovingItems: Array<{
    id: string;
    name: string;
    totalUsage: number;
    avgDailyUsage: number;
  }>;
}

export interface CreateReorderRuleInput {
  itemId: string;
  reorderPoint?: number;
  reorderQuantity?: number;
  maxStockLevel?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  preferredSupplierId?: string;
  autoCreatePo?: boolean;
  isActive?: boolean;
}

export interface ItemForecast {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  effectiveStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  avgDailyUsage: number;
  usageTrend: 'increasing' | 'decreasing' | 'stable';
  allocatedForJobs: number;
  onOrder: number;
  daysUntilStockout: number | null;
  stockoutDate: string | null;
  projectedStock: number;
  needsReorder: boolean;
  recommendedOrderDate: string | null;
  suggestedQuantity: number | null;
  preferredSupplierId?: string;
  supplierName?: string;
  usage: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
}

export interface ForecastResponse {
  forecastPeriodDays: number;
  summary: {
    totalItemsAnalyzed: number;
    criticalItems: number;
    warningItems: number;
    itemsNeedingReorder: number;
    estimatedTotalOrderValue: number;
  };
  forecasts: ItemForecast[];
  criticalItems: ItemForecast[];
  upcomingShortages: ItemForecast[];
}
