
export type ContactType = 'Supplier' | 'Plumber' | 'Customer' | 'Subcontractor';
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

export type DevelopmentProjectStatus = 'Planning' | 'Active' | 'Completed' | 'On Hold' | 'Cancelled';

export type DevelopmentStageType =
  | 'Drain Underfloor'
  | 'Stormwater'
  | 'First Fix'
  | 'Chrome Off/Final Fix'
  | 'Bath Installs'
  | 'Hot Water Service Installs'
  | 'Rainwater Tanks'
  | 'Sump Tanks + Accessories';

export type DevelopmentStageStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'blocked';

export type KitchenConfig = 'standard' | 'large' | 'galley' | 'custom';

export interface DevelopmentHouseProfile {
  storeys: number;
  bathroomCount: number;
  kitchenConfig: KitchenConfig;
  hasButlersPantry: boolean;
  customOptions: string[];
}

export interface StageModifierContribution {
  key: string;
  label: string;
  amount: number;
}

export interface StageStockModifierSnapshot {
  quantityMultiplier: number;
  variationMultiplier: number;
  finalMultiplier: number;
  contributions: StageModifierContribution[];
  generatedAt: string;
  houseProfile: DevelopmentHouseProfile;
}

export interface DevelopmentStageManualItemAdjustment {
  itemId: string;
  itemName?: string;
  quantity: number;
}

export interface Job {
  id: string;
  title: string;
  builder?: string;
  customerId?: string;
  jobType: string;
  assignedWorkerIds: string[]; // Updated to multiple workers
  status: JobStatus;
  date: string;
  jobAddress?: string;
  developmentProjectId?: string;
  developmentStageId?: string;
  developmentStageType?: DevelopmentStageType;
  allocatedItems: AllocatedItem[];
  isPicked: boolean; // Tracking if stock has been removed from inventory
}

export interface AllocatedItem {
  itemId: string;
  itemName?: string;
  quantity: number;
}

export interface DevelopmentStage {
  id: string;
  projectId: string;
  stageType: DevelopmentStageType;
  sortOrder: number;
  status: DevelopmentStageStatus;
  plannedDate?: string;
  assignedWorkerIds: string[];
  linkedJobId?: string;
  linkedJobStatus?: JobStatus;
  baseKitId?: string;
  baseKitName?: string;
  variationId?: string;
  variationName?: string;
  modifierSnapshot?: StageStockModifierSnapshot;
  resolvedAllocatedItems: AllocatedItem[];
  manualItemAdjustments?: DevelopmentStageManualItemAdjustment[];
  isApplicable: boolean;
  notes?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DevelopmentProject {
  id: string;
  title: string;
  builder?: string;
  customerId?: string;
  siteAddress?: string;
  targetStartDate?: string;
  targetCompletionDate?: string;
  notes?: string;
  houseProfile: DevelopmentHouseProfile;
  overallStatus: DevelopmentProjectStatus;
  stages: DevelopmentStage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDevelopmentProjectInput {
  title: string;
  builder?: string;
  customerId?: string;
  siteAddress?: string;
  targetStartDate?: string;
  targetCompletionDate?: string;
  notes?: string;
  houseProfile: DevelopmentHouseProfile;
  skippedStageTypes?: DevelopmentStageType[];
}

export interface UpdateDevelopmentProjectInput {
  title?: string;
  builder?: string;
  customerId?: string;
  siteAddress?: string;
  targetStartDate?: string;
  targetCompletionDate?: string;
  notes?: string;
  houseProfile?: DevelopmentHouseProfile;
  overallStatus?: DevelopmentProjectStatus;
}

export interface UpdateDevelopmentStageInput {
  status?: DevelopmentStageStatus;
  plannedDate?: string;
  assignedWorkerIds?: string[];
  baseKitId?: string;
  baseKitName?: string;
  variationId?: string;
  variationName?: string;
  modifierSnapshot?: StageStockModifierSnapshot;
  resolvedAllocatedItems?: AllocatedItem[];
  manualItemAdjustments?: DevelopmentStageManualItemAdjustment[];
  isApplicable?: boolean;
  notes?: string;
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

// ====================================
// Kit/BOM Management Types
// ====================================

export type KitType = 'service' | 'installation' | 'repair' | 'maintenance' | 'emergency' | 'inspection';
export type KitItemType = 'inventory' | 'labor' | 'subcontractor' | 'sub-kit';
export type KitStatus = 'active' | 'draft' | 'archived';

/**
 * Main Kit/BOM (Bill of Materials) Interface
 * Represents a predefined set of materials and labor for common jobs
 */
export interface Kit {
  id: string;
  name: string;
  description?: string;
  kitType: KitType;
  category: string; // e.g., "Bathroom", "Kitchen", "Hot Water", "Blocked Drain", "Gas Fitting"
  status: KitStatus;
  
  // Visual
  color?: string; // Hex color for visual identification
  icon?: string; // Lucide icon name
  
  // Job type linkage - what types of jobs this kit applies to
  applicableJobTypes: string[];
  
  // Items in the kit
  items: KitItem[];
  
  // Variations (e.g., Small/Medium/Large bathroom)
  variations?: KitVariation[];
  
  // Pricing Summary (calculated from items)
  totalCostPrice: number;
  totalSellPrice: number;
  totalLaborHours: number;
  
  // Markup settings
  defaultMarkupPercentage: number;
  
  // Metadata
  usageCount: number;
  lastUsedAt?: string;
  averageJobProfit?: number;
  averageCompletionTime?: number; // in hours
  
  // Tags for searching/filtering
  tags: string[];
  
  // Version control
  version: number;
  parentKitId?: string; // If this is a variant/copy of another kit
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Individual item within a kit
 */
export interface KitItem {
  id: string;
  itemType: KitItemType;
  
  // For inventory items
  inventoryItemId?: string;
  itemName: string;
  itemCode?: string;
  category?: string;
  
  // For labor items
  laborType?: string; // e.g., "Licensed Plumber", "Apprentice", "Gas Fitter"
  hourlyRate?: number;
  
  // For subcontractor items
  subcontractorType?: string;
  
  // For sub-kits (nested kits)
  subKitId?: string;
  subKitName?: string;
  
  // Quantities
  quantity: number;
  unit: string;
  
  // Pricing (stored at time of kit creation for historical accuracy)
  unitCost: number;
  unitSellPrice: number;
  lineCostTotal: number;
  lineSellTotal: number;
  
  // Alternatives - if primary item not available
  alternativeItemIds?: string[];
  
  // Item configuration
  isOptional: boolean;
  isConsumable: boolean; // Single-use vs returnable (e.g., tools)
  notes?: string;
  
  // Sort order for display
  sortOrder: number;
}

/**
 * Kit Variations - Different configurations of the same kit
 * Example: "Small Bathroom", "Standard Bathroom", "Luxury Bathroom"
 */
export interface KitVariation {
  id: string;
  name: string; // e.g., "Small", "Standard", "Large", "Basic", "Premium"
  description?: string;
  
  // Pricing multiplier (e.g., 0.8 for small, 1.2 for large)
  costMultiplier: number;
  
  // Override items for this variation
  // If empty, uses base kit items with multiplier applied
  itemOverrides?: KitItem[];
  
  // Additional items unique to this variation
  additionalItems?: KitItem[];
  
  // Items to remove from base kit
  excludedItemIds?: string[];
}

/**
 * Kit Category for organization
 */
export interface KitCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sortOrder: number;
  kitCount: number;
}

/**
 * Kit Application - When a kit is applied to a job
 */
export interface KitApplication {
  id: string;
  kitId: string;
  kitName: string;
  kitType: KitType;
  variationId?: string;
  variationName?: string;
  
  // Linked entities
  jobId: string;
  jobTitle?: string;
  quoteId?: string;
  
  // Actual items planned/used
  appliedItems: AppliedKitItem[];
  
  // Stock management
  stockReservationId?: string;
  reservationStatus: 'pending' | 'reserved' | 'picked' | 'partial' | 'complete';
  
  // Usage tracking
  appliedAt: string;
  appliedBy: string;
  pickedAt?: string;
  pickedBy?: string;
  
  // Customization notes
  customizations?: string;
}

/**
 * Individual item within a kit application
 */
export interface AppliedKitItem {
  kitItemId: string;
  itemType: KitItemType;
  
  // Inventory linkage
  inventoryItemId?: string;
  itemName: string;
  itemCode?: string;
  
  // Quantities
  plannedQuantity: number;
  actualQuantity?: number;
  wastedQuantity?: number; // For tracking waste/returns
  
  // Status
  status: 'planned' | 'reserved' | 'picked' | 'used' | 'returned' | 'wasted';
  
  // Original kit configuration
  isOptional: boolean;
  wasModified: boolean; // User changed quantity or substituted item
  
  // Substitution tracking
  substitutedItemId?: string;
  substitutedItemName?: string;
  substitutionReason?: string;
  
  // Pricing (locked at application time)
  unitCost: number;
  unitSellPrice: number;
}

/**
 * Kit Stock Availability Check Result
 */
export interface KitAvailability {
  kitId: string;
  kitName: string;
  
  availabilityStatus: 'available' | 'partial' | 'unavailable';
  
  // Item-level availability
  items: {
    kitItemId: string;
    itemName: string;
    requiredQty: number;
    availableQty: number;
    allocatedQty: number;
    canFulfill: boolean;
    shortageQty: number;
    locationAvailability?: LocationStock[];
  }[];
  
  // Summary
  totalItems: number;
  availableItems: number;
  shortageItems: number;
  optionalItemsShort: number;
  
  // Alternatives available
  alternativesAvailable: boolean;
}

/**
 * Kit Usage Analytics
 */
export interface KitAnalytics {
  kitId: string;
  kitName: string;
  
  usageStats: {
    totalApplications: number;
    thisMonth: number;
    thisQuarter: number;
    thisYear: number;
    averagePerMonth: number;
  };
  
  financialStats: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    averageProfitMargin: number;
    averageJobValue: number;
  };
  
  efficiencyStats: {
    averagePrepTime: number; // Time from job creation to stock pick
    averageCompletionTime: number; // Actual job duration
    stockoutFrequency: number; // How often kits can't be fulfilled
    modificationRate: number; // How often kits are customized
  };
  
  popularVariations?: {
    variationId: string;
    variationName: string;
    usageCount: number;
    percentage: number;
  }[];
}

/**
 * Kit Comparison (for comparing similar kits)
 */
export interface KitComparison {
  kits: {
    kitId: string;
    kitName: string;
    category: string;
    totalCost: number;
    totalSellPrice: number;
    laborHours: number;
    itemCount: number;
  }[];
  
  itemComparison: {
    itemName: string;
    category: string;
    quantities: Record<string, number>; // kitId -> quantity
    priceComparison: Record<string, number>; // kitId -> line total
  }[];
}

/**
 * AI Kit Recommendation
 */
export interface KitRecommendation {
  kit: Kit;
  matchScore: number; // 0-100
  matchReason: string;
  estimatedJobDuration: number;
  estimatedProfit: number;
  stockAvailability: KitAvailability;
  
  // If kit needs modifications
  suggestedModifications?: {
    itemId: string;
    currentQty: number;
    suggestedQty: number;
    reason: string;
  }[];
}

/**
 * Create/Update Kit Input
 */
export interface CreateKitInput {
  name: string;
  description?: string;
  kitType: KitType;
  category: string;
  color?: string;
  icon?: string;
  applicableJobTypes: string[];
  items: CreateKitItemInput[];
  variations?: CreateKitVariationInput[];
  defaultMarkupPercentage?: number;
  tags?: string[];
}

export interface CreateKitItemInput {
  itemType: KitItemType;
  inventoryItemId?: string;
  itemName: string;
  itemCode?: string;
  laborType?: string;
  hourlyRate?: number;
  subcontractorType?: string;
  subKitId?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  unitSellPrice: number;
  alternativeItemIds?: string[];
  isOptional: boolean;
  isConsumable: boolean;
  notes?: string;
  sortOrder: number;
}

export interface CreateKitVariationInput {
  name: string;
  description?: string;
  costMultiplier: number;
  itemOverrides?: CreateKitItemInput[];
  additionalItems?: CreateKitItemInput[];
  excludedItemIds?: string[];
}

export interface ApplyKitToJobInput {
  kitId: string;
  jobId: string;
  variationId?: string;
  customizations?: string;
  // Allow overriding quantities at application time
  itemOverrides?: {
    kitItemId: string;
    quantity: number;
    substitutedItemId?: string;
  }[];
}

export interface KitFilterOptions {
  search?: string;
  kitType?: KitType;
  category?: string;
  status?: KitStatus;
  tags?: string[];
  jobType?: string;
  sortBy?: 'name' | 'usageCount' | 'profit' | 'recent';
  sortDirection?: 'asc' | 'desc';
}

// ====================================
// Voice Notes & Speech-to-Text Types
// ====================================

export type VoiceNoteStatus = 'recording' | 'processing' | 'pending' | 'transcribed' | 'error';

export interface VoiceNote {
  id: string;
  jobId?: string;
  contactId?: string;
  userId: string;
  userName?: string;
  
  // Audio file
  audioUrl: string;
  audioDuration: number; // in seconds
  fileSize?: number;
  mimeType: string;
  
  // Transcription
  transcription?: string;
  transcriptionStatus: VoiceNoteStatus;
  transcriptionError?: string;
  language?: string;
  confidence?: number; // Speech recognition confidence (0-1)
  
  // Categorized content (AI-extracted)
  extractedItems?: ExtractedVoiceItem[];
  summary?: string;
  actionItems?: string[];
  
  // Metadata
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedVoiceItem {
  type: 'inventory' | 'task' | 'contact' | 'date' | 'location' | 'issue' | 'other';
  text: string;
  confidence: number;
  startTime?: number; // Timestamp in audio (seconds)
  endTime?: number;
}

export interface CreateVoiceNoteInput {
  jobId?: string;
  contactId?: string;
  audioBlob: Blob;
  audioDuration: number;
  language?: string;
  transcription?: string;
}

export interface VoiceNoteFilterOptions {
  jobId?: string;
  contactId?: string;
  userId?: string;
  transcriptionStatus?: VoiceNoteStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string; // Search in transcription
}

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  segments?: {
    startTime: number;
    endTime: number;
    text: string;
    confidence: number;
  }[];
}

// ====================================
// Asset Management Types (Vehicles & Tools)
// ====================================

export type AssetType = 'vehicle' | 'tool' | 'equipment' | 'machinery';
export type AssetStatus = 'active' | 'maintenance' | 'retired' | 'lost' | 'stolen';
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
export type MaintenanceType = 'routine' | 'repair' | 'inspection' | 'test_tag' | 'compliance';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';

export interface Asset {
  id: string;
  name: string;
  description?: string;
  assetType: AssetType;
  assetCode: string; // Internal tracking code (e.g., "VAN-001", "TOOL-045")
  
  // Identification
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  year?: number;
  
  // Purchase info
  purchaseDate?: string;
  purchasePrice?: number;
  supplierId?: string;
  supplierName?: string;
  warrantyExpiry?: string;
  
  // Current status
  status: AssetStatus;
  condition: AssetCondition;
  currentLocation?: string;
  assignedTo?: string; // User ID
  assignedToName?: string;
  
  // For vehicles
  registrationNumber?: string;
  vin?: string;
  fuelType?: string;
  currentOdometer?: number;
  lastServiceOdometer?: number;
  nextServiceOdometer?: number;
  
  // Insurance & compliance
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  complianceDocuments?: ComplianceDocument[];
  
  // Photos
  photos?: string[];
  
  // Maintenance schedule
  maintenanceSchedule?: MaintenanceSchedule;
  
  // Metadata
  notes?: string;
  tags?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceDocument {
  id: string;
  type: 'insurance' | 'registration' | 'license' | 'certification' | 'warranty' | 'other';
  title: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: 'valid' | 'expiring' | 'expired';
}

export interface MaintenanceSchedule {
  frequencyMonths?: number;
  frequencyKilometers?: number; // For vehicles
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  lastTestTagDate?: string; // For electrical tools
  nextTestTagDate?: string;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetName?: string;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  
  // Scheduling
  scheduledDate: string;
  completedDate?: string;
  
  // Details
  description: string;
  workPerformed?: string;
  partsUsed?: string[];
  cost?: number;
  
  // Provider
  performedBy?: string;
  performedByName?: string;
  serviceProvider?: string;
  
  // Results
  conditionAfter?: AssetCondition;
  odometerReading?: number; // For vehicles
  testTagExpiry?: string; // For electrical tools
  
  // Documents
  invoiceUrl?: string;
  certificateUrl?: string;
  photos?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface AssetAllocation {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  
  // Allocation to job/user
  jobId?: string;
  jobTitle?: string;
  userId?: string;
  userName?: string;
  
  // GPS Check-in/Check-out for vehicles
  checkOutLocation?: GeoLocation;
  checkInLocation?: GeoLocation;
  
  // Times
  allocatedAt: string;
  expectedReturnAt?: string;
  checkOutAt?: string;
  checkInAt?: string;
  
  // Condition tracking
  conditionAtCheckOut?: AssetCondition;
  conditionAtCheckIn?: AssetCondition;
  odometerAtCheckOut?: number;
  odometerAtCheckIn?: number;
  
  // Status
  status: 'allocated' | 'checked_out' | 'checked_in' | 'overdue';
  
  notes?: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}

// ====================================
// Subcontractor Management Types
// ====================================

export interface Subcontractor extends Contact {
  // Business Details
  abn: string;
  businessName?: string;
  tradingName?: string;
  
  // Classification
  tradeType: string[]; // e.g., ['Electrical', 'HVAC', 'Concrete']
  expertise?: string[]; // Specific skills
  
  // Insurance & Compliance
  insuranceDocuments: InsuranceDocument[];
  licenseDocuments: LicenseDocument[];
  complianceStatus: 'compliant' | 'pending' | 'non_compliant' | 'expired';
  
  // Performance
  rating?: number;
  totalJobs?: number;
  completedJobs?: number;
  averageJobValue?: number;
  
  // Availability
  availabilityStatus: 'available' | 'busy' | 'limited' | 'unavailable';
  typicalLeadTime?: number; // Days
  preferredJobTypes?: string[];
  serviceArea?: string[]; // Postcodes or regions
  
  // Rates
  hourlyRate?: number;
  dailyRate?: number;
  callOutFee?: number;
  
  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // Bank Details (for payments - optional)
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
}

export interface InsuranceDocument {
  id: string;
  type: 'public_liability' | 'professional_indemnity' | 'workers_compensation' | 'vehicle' | 'tool' | 'income_protection' | 'other';
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  issueDate: string;
  expiryDate: string;
  documentUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  status: 'valid' | 'expiring' | 'expired' | 'pending_verification';
}

export interface LicenseDocument {
  id: string;
  type: 'trade_license' | 'contractor_license' | 'safety_certificate' | 'white_card' | 'working_with_children' | 'other';
  licenseNumber: string;
  issuingAuthority: string;
  issueDate?: string;
  expiryDate: string;
  documentUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  status: 'valid' | 'expiring' | 'expired' | 'pending_verification';
}

export interface SubcontractorJob {
  id: string;
  subcontractorId: string;
  jobId: string;
  jobTitle: string;
  
  // Work details
  scopeOfWork: string;
  estimatedHours?: number;
  actualHours?: number;
  hourlyRate: number;
  totalValue: number;
  
  // Status
  status: 'quoted' | 'approved' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  
  // Timeline
  quotedAt?: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  invoicedAt?: string;
  paidAt?: string;
  
  // Documents
  quoteUrl?: string;
  invoiceUrl?: string;
  completionPhotos?: string[];
  
  // Rating
  rating?: number;
  review?: string;
  wouldRecommend?: boolean;
}

// ====================================
// Lead Pipeline Types
// ====================================

export type LeadSource = 'website' | 'phone' | 'referral' | 'social_media' | 'email' | 'walk_in' | 'advertisement' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'quoted' | 'negotiation' | 'won' | 'lost' | 'on_hold';
export type LeadPriority = 'hot' | 'warm' | 'cold';
export type LostReason = 'price' | 'timing' | 'competitor' | 'no_response' | 'not_qualified' | 'other';

export interface Lead {
  id: string;
  leadNumber: string; // e.g., "LEAD-2026-001"
  
  // Contact info
  contactName: string;
  companyName?: string;
  email?: string;
  phone: string;
  address?: string;
  
  // Lead details
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  
  // Job info
  jobType?: string;
  description?: string;
  estimatedValue?: number;
  estimatedStartDate?: string;
  
  // Assignment
  assignedTo?: string; // User ID
  assignedToName?: string;
  
  // Timeline
  receivedAt: string;
  firstContactAt?: string;
  lastContactAt?: string;
  quotedAt?: string;
  convertedAt?: string;
  
  // If lost
  lostReason?: LostReason;
  lostReasonDetail?: string;
  
  // Conversion
  quoteId?: string;
  jobId?: string;
  customerId?: string;
  
  // Follow-up
  nextFollowUpDate?: string;
  nextFollowUpType?: 'call' | 'email' | 'sms' | 'visit';
  followUpNotes?: string;
  
  // Communications
  communications: LeadCommunication[];
  
  // Tags
  tags?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface LeadCommunication {
  id: string;
  leadId: string;
  type: 'inbound' | 'outbound';
  method: 'phone' | 'email' | 'sms' | 'meeting' | 'other';
  userId?: string;
  userName?: string;
  timestamp: string;
  summary: string;
  notes?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
}

export interface LeadPipelineStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  quotedLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number; // Percentage
  averageTimeToQuote: number; // Days
  averageTimeToWin: number; // Days
  totalPipelineValue: number;
  
  bySource: Record<LeadSource, { count: number; won: number; conversionRate: number }>;
  byStatus: Record<LeadStatus, { count: number; value: number }>;
}

// ====================================
// Technician Performance Types
// ====================================

export interface TechnicianPerformance {
  userId: string;
  userName: string;
  
  // Job metrics
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  completionRate: number; // Percentage
  
  // Time metrics
  averageJobDuration: number; // Hours
  onTimeArrivalRate: number; // Percentage
  averageResponseTime: number; // Minutes
  
  // Financial metrics
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageJobValue: number;
  profitMargin: number; // Percentage
  
  // Quality metrics
  callbackCount: number;
  callbackRate: number; // Percentage
  customerRating: number; // Average rating
  
  // Efficiency metrics
  averageTravelTime: number; // Minutes per job
  materialsUtilization: number; // Percentage of planned materials used
  
  // Period comparison
  periodLabel: string; // e.g., "This Month", "Last Month"
  previousPeriod?: TechnicianPerformance;
  trends: {
    jobsTrend: 'up' | 'down' | 'stable';
    revenueTrend: 'up' | 'down' | 'stable';
    profitTrend: 'up' | 'down' | 'stable';
    ratingTrend: 'up' | 'down' | 'stable';
  };
}

export interface TechnicianComparison {
  period: string;
  technicians: TechnicianPerformance[];
  rankings: {
    byRevenue: string[]; // User IDs
    byJobs: string[];
    byProfit: string[];
    byRating: string[];
    byEfficiency: string[];
  };
}

// ====================================
// Cash Flow Forecasting Types
// ====================================

export interface CashFlowForecast {
  generatedAt: string;
  forecastPeriodDays: number;
  
  // Starting position
  currentBalance: number;
  
  // Projected inflows
  expectedIncome: {
    fromInvoices: ProjectedCashItem[];
    fromQuotes: ProjectedCashItem[]; // Expected conversions
    total: number;
  };
  
  // Projected outflows
  expectedOutflows: {
    purchaseOrders: ProjectedCashItem[];
    payroll: ProjectedCashItem[];
    expenses: ProjectedCashItem[];
    total: number;
  };
  
  // Daily projections
  dailyProjections: DailyCashProjection[];
  
  // Summary
  netCashFlow: number;
  projectedBalance: number;
  lowestBalanceDate?: string;
  lowestBalanceAmount?: number;
  
  // Alerts
  alerts: CashFlowAlert[];
}

export interface ProjectedCashItem {
  id: string;
  description: string;
  expectedDate: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
  source?: string; // e.g., invoice number, PO number
}

export interface DailyCashProjection {
  date: string;
  startingBalance: number;
  inflows: number;
  outflows: number;
  netFlow: number;
  endingBalance: number;
}

export interface CashFlowAlert {
  type: 'negative_balance' | 'low_balance' | 'large_outflow' | 'missed_payment';
  severity: 'critical' | 'warning' | 'info';
  date: string;
  message: string;
  suggestedAction?: string;
}
