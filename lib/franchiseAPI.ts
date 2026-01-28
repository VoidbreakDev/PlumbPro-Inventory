// Franchise Management API Client
import api from './api';

// Types
export interface FranchiseNetwork {
  id: string;
  name: string;
  code: string;
  legalName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  headquartersAddress: string | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersPostalCode: string | null;
  headquartersCountry: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCurrency: string;
  defaultTimezone: string;
  fiscalYearStart: number;
  whiteLabelConfig: WhiteLabelConfig;
  royaltyType: 'percentage' | 'fixed' | 'tiered' | 'none';
  royaltyPercentage: number | null;
  royaltyFixedAmount: number | null;
  royaltyTiers: RoyaltyTier[] | null;
  isActive: boolean;
  locationCount?: number;
  territoryCount?: number;
  totalMonthlyRevenue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhiteLabelConfig {
  enabled: boolean;
  customDomain: string | null;
  hideParentBranding: boolean;
  customEmailDomain: string | null;
  customSupportEmail: string | null;
  customTermsUrl: string | null;
  customPrivacyUrl: string | null;
}

export interface RoyaltyTier {
  from: number;
  upTo: number;
  rate: number;
}

export interface FranchiseLocation {
  id: string;
  networkId: string;
  userId: string;
  name: string;
  code: string;
  legalEntityName: string | null;
  businessRegistrationNumber: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  territoryId: string | null;
  territoryName?: string;
  currency: string;
  royaltyOverrideType: 'percentage' | 'fixed' | 'tiered' | null;
  royaltyOverridePercentage: number | null;
  royaltyOverrideFixed: number | null;
  monthlyRevenue: number;
  monthlyJobsCompleted: number;
  customerSatisfactionScore: number | null;
  complianceScore: number;
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  openedDate: string | null;
  terminationDate: string | null;
  whiteLabelOverrides: Record<string, any>;
  settings: Record<string, any>;
  ownerEmail?: string;
  ownerName?: string;
  networkName?: string;
  networkCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FranchiseTerritory {
  id: string;
  networkId: string;
  name: string;
  code: string;
  description: string | null;
  boundaryType: 'postal_codes' | 'polygon' | 'radius' | 'custom';
  postalCodes: string[] | null;
  boundaryPolygon: any | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  assignedToLocationId: string | null;
  assignedLocationName?: string;
  assignedLocationCode?: string;
  isExclusive: boolean;
  estimatedPopulation: number | null;
  estimatedHouseholds: number | null;
  marketPotentialScore: number | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FranchiseLead {
  id: string;
  networkId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  serviceType: string | null;
  description: string | null;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  estimatedValue: number | null;
  source: string | null;
  sourceDetails: Record<string, any> | null;
  campaignId: string | null;
  matchedTerritoryId: string | null;
  matchedTerritoryName?: string;
  assignedLocationId: string | null;
  assignedLocationName?: string;
  assignedAt: string | null;
  assignmentMethod: 'territory' | 'manual' | 'round_robin' | 'load_balanced' | 'auction' | null;
  status: 'new' | 'assigned' | 'contacted' | 'quoted' | 'won' | 'lost' | 'expired';
  firstResponseAt: string | null;
  responseTimeMinutes: number | null;
  outcomeNotes: string | null;
  jobId: string | null;
  quoteAmount: number | null;
  finalAmount: number | null;
  receivedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FranchiseRoyalty {
  id: string;
  networkId: string;
  locationId: string;
  locationName?: string;
  locationCode?: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  grossRevenue: number;
  deductions: number;
  taxableRevenue: number;
  royaltyType: string;
  royaltyRate: number | null;
  royaltyAmount: number;
  marketingFundAmount: number;
  technologyFee: number;
  otherFees: number;
  otherFeesDescription: string | null;
  totalDue: number;
  status: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'disputed' | 'waived';
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceRequirement {
  id: string;
  networkId: string;
  name: string;
  category: string;
  description: string | null;
  frequency: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  evidenceType: 'document' | 'photo' | 'checklist' | 'attestation' | 'inspection' | null;
  evidenceTemplate: Record<string, any> | null;
  weight: number;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceSubmission {
  id: string;
  requirementId: string;
  locationId: string;
  periodStart: string | null;
  periodEnd: string | null;
  submittedAt: string;
  submittedByName: string | null;
  evidenceData: Record<string, any> | null;
  documentUrls: string[] | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNotes: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceItem extends ComplianceRequirement {
  submissionId?: string;
  submissionStatus?: string;
  score?: number;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface FranchiseAnnouncement {
  id: string;
  networkId: string;
  title: string;
  content: string;
  category: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetAllLocations: boolean;
  targetLocationIds: string[] | null;
  targetTerritoryIds: string[] | null;
  publishAt: string;
  expiresAt: string | null;
  isPinned: boolean;
  requiresAcknowledgment: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  locations: {
    activeLocations: number;
    pendingLocations: number;
    suspendedLocations: number;
    totalMonthlyRevenue: number;
    avgComplianceScore: number;
  };
  leads: {
    totalLeads: number;
    wonLeads: number;
    lostLeads: number;
    pendingLeads: number;
    avgResponseTime: number;
  };
  royalties: {
    totalRoyalties: number;
    pendingRoyalties: number;
    overdueRoyalties: number;
    totalDue: number;
    totalPaid: number;
  };
  territories: {
    totalTerritories: number;
    availableTerritories: number;
  };
}

// Transform functions
function transformNetwork(data: any): FranchiseNetwork {
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    legalName: data.legal_name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    headquartersAddress: data.headquarters_address,
    headquartersCity: data.headquarters_city,
    headquartersState: data.headquarters_state,
    headquartersPostalCode: data.headquarters_postal_code,
    headquartersCountry: data.headquarters_country,
    phone: data.phone,
    email: data.email,
    website: data.website,
    defaultCurrency: data.default_currency,
    defaultTimezone: data.default_timezone,
    fiscalYearStart: data.fiscal_year_start,
    whiteLabelConfig: data.white_label_config || {},
    royaltyType: data.royalty_type,
    royaltyPercentage: data.royalty_percentage,
    royaltyFixedAmount: data.royalty_fixed_amount,
    royaltyTiers: data.royalty_tiers,
    isActive: data.is_active,
    locationCount: parseInt(data.location_count) || 0,
    territoryCount: parseInt(data.territory_count) || 0,
    totalMonthlyRevenue: parseFloat(data.total_monthly_revenue) || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformLocation(data: any): FranchiseLocation {
  return {
    id: data.id,
    networkId: data.network_id,
    userId: data.user_id,
    name: data.name,
    code: data.code,
    legalEntityName: data.legal_entity_name,
    businessRegistrationNumber: data.business_registration_number,
    vatNumber: data.vat_number,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    city: data.city,
    state: data.state,
    postalCode: data.postal_code,
    country: data.country,
    lat: data.lat,
    lng: data.lng,
    phone: data.phone,
    email: data.email,
    website: data.website,
    territoryId: data.territory_id,
    territoryName: data.territory_name,
    currency: data.currency,
    royaltyOverrideType: data.royalty_override_type,
    royaltyOverridePercentage: data.royalty_override_percentage,
    royaltyOverrideFixed: data.royalty_override_fixed,
    monthlyRevenue: parseFloat(data.monthly_revenue) || 0,
    monthlyJobsCompleted: parseInt(data.monthly_jobs_completed) || 0,
    customerSatisfactionScore: data.customer_satisfaction_score,
    complianceScore: parseFloat(data.compliance_score) || 100,
    status: data.status,
    openedDate: data.opened_date,
    terminationDate: data.termination_date,
    whiteLabelOverrides: data.white_label_overrides || {},
    settings: data.settings || {},
    ownerEmail: data.owner_email,
    ownerName: data.owner_name,
    networkName: data.network_name,
    networkCode: data.network_code,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformTerritory(data: any): FranchiseTerritory {
  return {
    id: data.id,
    networkId: data.network_id,
    name: data.name,
    code: data.code,
    description: data.description,
    boundaryType: data.boundary_type,
    postalCodes: data.postal_codes,
    boundaryPolygon: data.boundary_polygon,
    centerLat: data.center_lat,
    centerLng: data.center_lng,
    radiusKm: data.radius_km,
    assignedToLocationId: data.assigned_to_location_id,
    assignedLocationName: data.assigned_location_name,
    assignedLocationCode: data.assigned_location_code,
    isExclusive: data.is_exclusive,
    estimatedPopulation: data.estimated_population,
    estimatedHouseholds: data.estimated_households,
    marketPotentialScore: data.market_potential_score,
    isAvailable: data.is_available,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformLead(data: any): FranchiseLead {
  return {
    id: data.id,
    networkId: data.network_id,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    addressLine1: data.address_line1,
    addressLine2: data.address_line2,
    city: data.city,
    postalCode: data.postal_code,
    country: data.country,
    lat: data.lat,
    lng: data.lng,
    serviceType: data.service_type,
    description: data.description,
    urgency: data.urgency,
    estimatedValue: data.estimated_value,
    source: data.source,
    sourceDetails: data.source_details,
    campaignId: data.campaign_id,
    matchedTerritoryId: data.matched_territory_id,
    matchedTerritoryName: data.matched_territory_name,
    assignedLocationId: data.assigned_location_id,
    assignedLocationName: data.assigned_location_name,
    assignedAt: data.assigned_at,
    assignmentMethod: data.assignment_method,
    status: data.status,
    firstResponseAt: data.first_response_at,
    responseTimeMinutes: data.response_time_minutes,
    outcomeNotes: data.outcome_notes,
    jobId: data.job_id,
    quoteAmount: data.quote_amount,
    finalAmount: data.final_amount,
    receivedAt: data.received_at,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformRoyalty(data: any): FranchiseRoyalty {
  return {
    id: data.id,
    networkId: data.network_id,
    locationId: data.location_id,
    locationName: data.location_name,
    locationCode: data.location_code,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    periodType: data.period_type,
    grossRevenue: parseFloat(data.gross_revenue) || 0,
    deductions: parseFloat(data.deductions) || 0,
    taxableRevenue: parseFloat(data.taxable_revenue) || 0,
    royaltyType: data.royalty_type,
    royaltyRate: data.royalty_rate,
    royaltyAmount: parseFloat(data.royalty_amount) || 0,
    marketingFundAmount: parseFloat(data.marketing_fund_amount) || 0,
    technologyFee: parseFloat(data.technology_fee) || 0,
    otherFees: parseFloat(data.other_fees) || 0,
    otherFeesDescription: data.other_fees_description,
    totalDue: parseFloat(data.total_due) || 0,
    status: data.status,
    invoiceNumber: data.invoice_number,
    invoiceDate: data.invoice_date,
    dueDate: data.due_date,
    paidDate: data.paid_date,
    paidAmount: data.paid_amount,
    paymentMethod: data.payment_method,
    paymentReference: data.payment_reference,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformRequirement(data: any): ComplianceRequirement {
  return {
    id: data.id,
    networkId: data.network_id,
    name: data.name,
    category: data.category,
    description: data.description,
    frequency: data.frequency,
    evidenceType: data.evidence_type,
    evidenceTemplate: data.evidence_template,
    weight: data.weight,
    isCritical: data.is_critical,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformAnnouncement(data: any): FranchiseAnnouncement {
  return {
    id: data.id,
    networkId: data.network_id,
    title: data.title,
    content: data.content,
    category: data.category,
    priority: data.priority,
    targetAllLocations: data.target_all_locations,
    targetLocationIds: data.target_location_ids,
    targetTerritoryIds: data.target_territory_ids,
    publishAt: data.publish_at,
    expiresAt: data.expires_at,
    isPinned: data.is_pinned,
    requiresAcknowledgment: data.requires_acknowledgment,
    createdByName: data.created_by_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// API
export const franchiseAPI = {
  // ============================================
  // NETWORKS
  // ============================================
  getNetworks: async (): Promise<{ networks: FranchiseNetwork[] }> => {
    const { data } = await api.get('/franchise/networks');
    return { networks: data.networks.map(transformNetwork) };
  },

  getNetwork: async (id: string): Promise<{
    network: FranchiseNetwork;
    locations: FranchiseLocation[];
    territories: FranchiseTerritory[];
  }> => {
    const { data } = await api.get(`/franchise/networks/${id}`);
    return {
      network: transformNetwork(data.network),
      locations: data.locations.map(transformLocation),
      territories: data.territories.map(transformTerritory),
    };
  },

  createNetwork: async (input: {
    name: string;
    code: string;
    legalName?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    headquartersAddress?: string;
    headquartersCity?: string;
    headquartersState?: string;
    headquartersPostalCode?: string;
    headquartersCountry?: string;
    phone?: string;
    email?: string;
    website?: string;
    defaultCurrency?: string;
    defaultTimezone?: string;
    fiscalYearStart?: number;
    royaltyType?: 'percentage' | 'fixed' | 'tiered' | 'none';
    royaltyPercentage?: number;
    royaltyFixedAmount?: number;
    royaltyTiers?: RoyaltyTier[];
    whiteLabelConfig?: Partial<WhiteLabelConfig>;
  }): Promise<FranchiseNetwork> => {
    const { data } = await api.post('/franchise/networks', input);
    return transformNetwork(data);
  },

  updateNetwork: async (id: string, updates: Partial<{
    name: string;
    code: string;
    legalName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headquartersAddress: string;
    headquartersCity: string;
    headquartersState: string;
    headquartersPostalCode: string;
    headquartersCountry: string;
    phone: string;
    email: string;
    website: string;
    defaultCurrency: string;
    defaultTimezone: string;
    fiscalYearStart: number;
    royaltyType: 'percentage' | 'fixed' | 'tiered' | 'none';
    royaltyPercentage: number;
    royaltyFixedAmount: number;
    royaltyTiers: RoyaltyTier[];
    whiteLabelConfig: Partial<WhiteLabelConfig>;
    isActive: boolean;
  }>): Promise<FranchiseNetwork> => {
    const { data } = await api.put(`/franchise/networks/${id}`, updates);
    return transformNetwork(data);
  },

  getDashboardStats: async (networkId: string): Promise<DashboardStats> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/dashboard`);
    return {
      locations: {
        activeLocations: parseInt(data.locations.active_locations) || 0,
        pendingLocations: parseInt(data.locations.pending_locations) || 0,
        suspendedLocations: parseInt(data.locations.suspended_locations) || 0,
        totalMonthlyRevenue: parseFloat(data.locations.total_monthly_revenue) || 0,
        avgComplianceScore: parseFloat(data.locations.avg_compliance_score) || 100,
      },
      leads: {
        totalLeads: parseInt(data.leads.total_leads) || 0,
        wonLeads: parseInt(data.leads.won_leads) || 0,
        lostLeads: parseInt(data.leads.lost_leads) || 0,
        pendingLeads: parseInt(data.leads.pending_leads) || 0,
        avgResponseTime: parseFloat(data.leads.avg_response_time) || 0,
      },
      royalties: {
        totalRoyalties: parseInt(data.royalties.total_royalties) || 0,
        pendingRoyalties: parseInt(data.royalties.pending_royalties) || 0,
        overdueRoyalties: parseInt(data.royalties.overdue_royalties) || 0,
        totalDue: parseFloat(data.royalties.total_due) || 0,
        totalPaid: parseFloat(data.royalties.total_paid) || 0,
      },
      territories: {
        totalTerritories: parseInt(data.territories.total_territories) || 0,
        availableTerritories: parseInt(data.territories.available_territories) || 0,
      },
    };
  },

  // ============================================
  // LOCATIONS
  // ============================================
  getLocations: async (networkId: string, options?: {
    status?: string;
  }): Promise<{ locations: FranchiseLocation[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/locations`, { params: options });
    return { locations: data.locations.map(transformLocation) };
  },

  getLocation: async (id: string): Promise<{
    location: FranchiseLocation;
    royalties: FranchiseRoyalty[];
    compliance: ComplianceItem[];
  }> => {
    const { data } = await api.get(`/franchise/locations/${id}`);
    return {
      location: transformLocation(data.location),
      royalties: data.royalties.map(transformRoyalty),
      compliance: data.compliance.map((item: any) => ({
        ...transformRequirement(item),
        submissionId: item.submission_id,
        submissionStatus: item.submission_status,
        score: item.score,
        submittedAt: item.submitted_at,
        reviewedAt: item.reviewed_at,
        reviewNotes: item.review_notes,
      })),
    };
  },

  createLocation: async (networkId: string, input: {
    userId: string;
    name: string;
    code: string;
    legalEntityName?: string;
    businessRegistrationNumber?: string;
    vatNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    email?: string;
    website?: string;
    territoryId?: string;
    currency?: string;
    openedDate?: string;
    settings?: Record<string, any>;
  }): Promise<FranchiseLocation> => {
    const { data } = await api.post(`/franchise/networks/${networkId}/locations`, input);
    return transformLocation(data);
  },

  updateLocation: async (id: string, updates: Partial<{
    name: string;
    code: string;
    legalEntityName: string;
    businessRegistrationNumber: string;
    vatNumber: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat: number;
    lng: number;
    phone: string;
    email: string;
    website: string;
    territoryId: string;
    currency: string;
    royaltyOverrideType: 'percentage' | 'fixed' | 'tiered';
    royaltyOverridePercentage: number;
    royaltyOverrideFixed: number;
    status: 'pending' | 'active' | 'suspended' | 'terminated';
    openedDate: string;
    terminationDate: string;
    whiteLabelOverrides: Record<string, any>;
    settings: Record<string, any>;
  }>): Promise<FranchiseLocation> => {
    const { data } = await api.put(`/franchise/locations/${id}`, updates);
    return transformLocation(data);
  },

  // ============================================
  // TERRITORIES
  // ============================================
  getTerritories: async (networkId: string, options?: {
    available?: boolean;
  }): Promise<{ territories: FranchiseTerritory[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/territories`, {
      params: { available: options?.available?.toString() }
    });
    return { territories: data.territories.map(transformTerritory) };
  },

  createTerritory: async (networkId: string, input: {
    name: string;
    code: string;
    description?: string;
    boundaryType?: 'postal_codes' | 'polygon' | 'radius' | 'custom';
    postalCodes?: string[];
    boundaryPolygon?: any;
    centerLat?: number;
    centerLng?: number;
    radiusKm?: number;
    isExclusive?: boolean;
    estimatedPopulation?: number;
    estimatedHouseholds?: number;
    marketPotentialScore?: number;
  }): Promise<FranchiseTerritory> => {
    const { data } = await api.post(`/franchise/networks/${networkId}/territories`, input);
    return transformTerritory(data);
  },

  updateTerritory: async (id: string, updates: Partial<{
    name: string;
    code: string;
    description: string;
    boundaryType: 'postal_codes' | 'polygon' | 'radius' | 'custom';
    postalCodes: string[];
    boundaryPolygon: any;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    assignedToLocationId: string;
    isExclusive: boolean;
    isAvailable: boolean;
    estimatedPopulation: number;
    estimatedHouseholds: number;
    marketPotentialScore: number;
  }>): Promise<FranchiseTerritory> => {
    const { data } = await api.put(`/franchise/territories/${id}`, updates);
    return transformTerritory(data);
  },

  // ============================================
  // LEADS
  // ============================================
  getLeads: async (networkId: string, options?: {
    status?: string;
    locationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ leads: FranchiseLead[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/leads`, { params: options });
    return { leads: data.leads.map(transformLead) };
  },

  createLead: async (networkId: string, input: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lng?: number;
    serviceType?: string;
    description?: string;
    urgency?: 'low' | 'normal' | 'high' | 'emergency';
    estimatedValue?: number;
    source?: string;
    sourceDetails?: Record<string, any>;
    campaignId?: string;
    expiresAt?: string;
  }): Promise<FranchiseLead> => {
    const { data } = await api.post(`/franchise/networks/${networkId}/leads`, input);
    return transformLead(data);
  },

  assignLead: async (id: string, input: {
    locationId: string;
    assignmentMethod?: 'territory' | 'manual' | 'round_robin' | 'load_balanced' | 'auction';
  }): Promise<FranchiseLead> => {
    const { data } = await api.put(`/franchise/leads/${id}/assign`, input);
    return transformLead(data);
  },

  updateLeadStatus: async (id: string, input: {
    status: 'new' | 'assigned' | 'contacted' | 'quoted' | 'won' | 'lost' | 'expired';
    outcomeNotes?: string;
    quoteAmount?: number;
    finalAmount?: number;
    jobId?: string;
  }): Promise<FranchiseLead> => {
    const { data } = await api.put(`/franchise/leads/${id}/status`, input);
    return transformLead(data);
  },

  // ============================================
  // ROYALTIES
  // ============================================
  getRoyalties: async (networkId: string, options?: {
    status?: string;
    locationId?: string;
    periodStart?: string;
    periodEnd?: string;
  }): Promise<{ royalties: FranchiseRoyalty[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/royalties`, { params: options });
    return { royalties: data.royalties.map(transformRoyalty) };
  },

  calculateRoyalty: async (locationId: string, input: {
    periodStart: string;
    periodEnd: string;
    periodType?: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  }): Promise<FranchiseRoyalty> => {
    const { data } = await api.post(`/franchise/locations/${locationId}/royalties/calculate`, input);
    return transformRoyalty(data);
  },

  updateRoyaltyPayment: async (id: string, input: {
    status: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'disputed' | 'waived';
    paidAmount?: number;
    paymentMethod?: string;
    paymentReference?: string;
    invoiceNumber?: string;
  }): Promise<FranchiseRoyalty> => {
    const { data } = await api.put(`/franchise/royalties/${id}/payment`, input);
    return transformRoyalty(data);
  },

  // ============================================
  // COMPLIANCE
  // ============================================
  getComplianceRequirements: async (networkId: string, options?: {
    category?: string;
  }): Promise<{ requirements: ComplianceRequirement[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/compliance/requirements`, { params: options });
    return { requirements: data.requirements.map(transformRequirement) };
  },

  createComplianceRequirement: async (networkId: string, input: {
    name: string;
    category: string;
    description?: string;
    frequency?: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
    evidenceType?: 'document' | 'photo' | 'checklist' | 'attestation' | 'inspection';
    evidenceTemplate?: Record<string, any>;
    weight?: number;
    isCritical?: boolean;
  }): Promise<ComplianceRequirement> => {
    const { data } = await api.post(`/franchise/networks/${networkId}/compliance/requirements`, input);
    return transformRequirement(data);
  },

  getLocationCompliance: async (locationId: string): Promise<{
    items: ComplianceItem[];
    overallScore: number;
    hasCriticalFailure: boolean;
  }> => {
    const { data } = await api.get(`/franchise/locations/${locationId}/compliance`);
    return {
      items: data.items.map((item: any) => ({
        ...transformRequirement(item),
        submissionId: item.submission_id,
        submissionStatus: item.submission_status,
        score: item.score,
        submittedAt: item.submitted_at,
        reviewedAt: item.reviewed_at,
        reviewNotes: item.review_notes,
      })),
      overallScore: data.overallScore,
      hasCriticalFailure: data.hasCriticalFailure,
    };
  },

  submitCompliance: async (locationId: string, requirementId: string, input: {
    periodStart?: string;
    periodEnd?: string;
    evidenceData?: Record<string, any>;
    documentUrls?: string[];
    notes?: string;
    submittedByName?: string;
  }): Promise<ComplianceSubmission> => {
    const { data } = await api.post(`/franchise/locations/${locationId}/compliance/${requirementId}/submit`, input);
    return {
      id: data.id,
      requirementId: data.requirement_id,
      locationId: data.location_id,
      periodStart: data.period_start,
      periodEnd: data.period_end,
      submittedAt: data.submitted_at,
      submittedByName: data.submitted_by_name,
      evidenceData: data.evidence_data,
      documentUrls: data.document_urls,
      notes: data.notes,
      status: data.status,
      reviewedAt: data.reviewed_at,
      reviewedByName: data.reviewed_by_name,
      reviewNotes: data.review_notes,
      score: data.score,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  reviewCompliance: async (submissionId: string, input: {
    status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
    score?: number;
    reviewNotes?: string;
    reviewedByName?: string;
  }): Promise<ComplianceSubmission> => {
    const { data } = await api.put(`/franchise/compliance/submissions/${submissionId}/review`, input);
    return {
      id: data.id,
      requirementId: data.requirement_id,
      locationId: data.location_id,
      periodStart: data.period_start,
      periodEnd: data.period_end,
      submittedAt: data.submitted_at,
      submittedByName: data.submitted_by_name,
      evidenceData: data.evidence_data,
      documentUrls: data.document_urls,
      notes: data.notes,
      status: data.status,
      reviewedAt: data.reviewed_at,
      reviewedByName: data.reviewed_by_name,
      reviewNotes: data.review_notes,
      score: data.score,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  // ============================================
  // ANNOUNCEMENTS
  // ============================================
  getAnnouncements: async (networkId: string, options?: {
    category?: string;
    limit?: number;
  }): Promise<{ announcements: FranchiseAnnouncement[] }> => {
    const { data } = await api.get(`/franchise/networks/${networkId}/announcements`, { params: options });
    return { announcements: data.announcements.map(transformAnnouncement) };
  },

  createAnnouncement: async (networkId: string, input: {
    title: string;
    content: string;
    category?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    targetAllLocations?: boolean;
    targetLocationIds?: string[];
    targetTerritoryIds?: string[];
    publishAt?: string;
    expiresAt?: string;
    isPinned?: boolean;
    requiresAcknowledgment?: boolean;
    createdByName?: string;
  }): Promise<FranchiseAnnouncement> => {
    const { data } = await api.post(`/franchise/networks/${networkId}/announcements`, input);
    return transformAnnouncement(data);
  },

  acknowledgeAnnouncement: async (id: string, input: {
    locationId: string;
    acknowledgedByName?: string;
  }): Promise<{ acknowledged: boolean }> => {
    const { data } = await api.post(`/franchise/announcements/${id}/acknowledge`, input);
    return data;
  },
};

export default franchiseAPI;
