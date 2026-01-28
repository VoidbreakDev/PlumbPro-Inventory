import axios from 'axios';
import { loadSettings } from './settings';
import type {
  InventoryItem,
  Contact,
  ContactStats,
  CustomerHistory,
  CustomerNote,
  CreateCustomerNoteInput,
  ServiceAgreement,
  CreateServiceAgreementInput,
  CustomerPricing,
  CreateCustomerPricingInput,
  Job,
  JobTemplate,
  StockMovement,
  SmartOrderSuggestion,
  Location,
  StockTransfer,
  Quote,
  QuoteItem,
  QuoteStats,
  QuoteTemplate,
  CreateQuoteInput,
  CreateQuoteItemInput,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStats,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  RecordPaymentInput,
  ReorderAlert,
  ReorderRule,
  UsageAnalytics,
  SmartOrderingDashboard,
  CreateReorderRuleInput,
  ForecastResponse
} from '../types';

export const DEFAULT_API_URL = 'http://localhost:5001/api';
export const DEFAULT_BACKEND_PORT = 5001;

// Detect if running in Electron desktop app
export const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Get server port from Electron or use default
function getApiBaseUrl(): string {
  if (isElectron) {
    // In Electron, server port may be injected by the main process
    const electronPort = (window as any).__PLUMBPRO_SERVER_PORT__ || 5000;
    return `http://localhost:${electronPort}/api`;
  }
  return import.meta.env.VITE_API_URL || DEFAULT_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');
export const hasExplicitApiUrl = Boolean(import.meta.env.VITE_API_URL) || isElectron;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear token but don't redirect - let the app handle it
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Dispatch custom event for auth error
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  register: async (email: string, password: string, fullName: string, companyName?: string) => {
    const { data } = await api.post('/auth/register', { email, password, fullName, companyName });
    return data;
  },

  getCurrentUser: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  }
};

// Inventory API
export const inventoryAPI = {
  getAll: async (): Promise<InventoryItem[]> => {
    const { data } = await api.get('/inventory');
    return data;
  },

  getById: async (id: string): Promise<InventoryItem> => {
    const { data } = await api.get(`/inventory/${id}`);
    return data;
  },

  create: async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const { data } = await api.post('/inventory', item);
    return data;
  },

  update: async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const { data } = await api.put(`/inventory/${id}`, updates);
    return data;
  },

  adjust: async (id: string, quantity: number, reason: string, locationId?: string) => {
    const { data } = await api.post(`/inventory/${id}/adjust`, { quantity, reason, locationId });
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/inventory/${id}`);
    return data;
  },

  deleteAll: async () => {
    const { data } = await api.post('/inventory/bulk-delete/all');
    return data;
  }
};

// Contacts API
export const contactsAPI = {
  getAll: async (filters?: {
    type?: string;
    status?: string;
    customerType?: string;
    search?: string;
    tags?: string;
    isVip?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Contact[]> => {
    const { data } = await api.get('/contacts', { params: filters });
    return data;
  },

  getStats: async (): Promise<ContactStats> => {
    const { data } = await api.get('/contacts/stats');
    return data;
  },

  getById: async (id: string): Promise<Contact> => {
    const { data } = await api.get(`/contacts/${id}`);
    return data;
  },

  getHistory: async (id: string): Promise<CustomerHistory> => {
    const { data } = await api.get(`/contacts/${id}/history`);
    return data;
  },

  create: async (contact: Partial<Contact>): Promise<Contact> => {
    const { data } = await api.post('/contacts', contact);
    return data;
  },

  update: async (id: string, updates: Partial<Contact>): Promise<Contact> => {
    const { data } = await api.put(`/contacts/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/contacts/${id}`);
    return data;
  },

  // Customer Notes
  getNotes: async (contactId: string): Promise<CustomerNote[]> => {
    const { data } = await api.get(`/contacts/${contactId}/notes`);
    return data;
  },

  addNote: async (contactId: string, note: CreateCustomerNoteInput): Promise<CustomerNote> => {
    const { data } = await api.post(`/contacts/${contactId}/notes`, note);
    return data;
  },

  updateNote: async (contactId: string, noteId: string, updates: Partial<CreateCustomerNoteInput & { isFollowUpCompleted?: boolean }>): Promise<CustomerNote> => {
    const { data } = await api.put(`/contacts/${contactId}/notes/${noteId}`, updates);
    return data;
  },

  deleteNote: async (contactId: string, noteId: string) => {
    const { data } = await api.delete(`/contacts/${contactId}/notes/${noteId}`);
    return data;
  },

  // Service Agreements
  getAgreements: async (contactId: string): Promise<ServiceAgreement[]> => {
    const { data } = await api.get(`/contacts/${contactId}/agreements`);
    return data;
  },

  createAgreement: async (contactId: string, agreement: CreateServiceAgreementInput): Promise<ServiceAgreement> => {
    const { data } = await api.post(`/contacts/${contactId}/agreements`, agreement);
    return data;
  },

  updateAgreement: async (contactId: string, agreementId: string, updates: Partial<CreateServiceAgreementInput>): Promise<ServiceAgreement> => {
    const { data } = await api.put(`/contacts/${contactId}/agreements/${agreementId}`, updates);
    return data;
  },

  deleteAgreement: async (contactId: string, agreementId: string) => {
    const { data } = await api.delete(`/contacts/${contactId}/agreements/${agreementId}`);
    return data;
  },

  // Customer Pricing
  getPricing: async (contactId: string): Promise<CustomerPricing[]> => {
    const { data } = await api.get(`/contacts/${contactId}/pricing`);
    return data;
  },

  createPricing: async (contactId: string, pricing: CreateCustomerPricingInput): Promise<CustomerPricing> => {
    const { data } = await api.post(`/contacts/${contactId}/pricing`, pricing);
    return data;
  },

  deletePricing: async (contactId: string, pricingId: string) => {
    const { data } = await api.delete(`/contacts/${contactId}/pricing/${pricingId}`);
    return data;
  }
};

// Jobs API
export const jobsAPI = {
  getAll: async (): Promise<Job[]> => {
    const { data } = await api.get('/jobs');
    return data;
  },

  getById: async (id: string): Promise<Job> => {
    const { data } = await api.get(`/jobs/${id}`);
    return data;
  },

  create: async (job: Omit<Job, 'id'>): Promise<Job> => {
    const { data } = await api.post('/jobs', job);
    return data;
  },

  update: async (id: string, updates: Partial<Job>): Promise<Job> => {
    const { data } = await api.put(`/jobs/${id}`, updates);
    return data;
  },

  pick: async (id: string) => {
    const { data } = await api.post(`/jobs/${id}/pick`);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/jobs/${id}`);
    return data;
  }
};

// Templates API
export const templatesAPI = {
  getAll: async (): Promise<JobTemplate[]> => {
    const { data } = await api.get('/templates');
    return data;
  },

  create: async (template: Omit<JobTemplate, 'id'>): Promise<JobTemplate> => {
    const { data } = await api.post('/templates', template);
    return data;
  },

  update: async (id: string, updates: Partial<JobTemplate>): Promise<JobTemplate> => {
    const { data } = await api.put(`/templates/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/templates/${id}`);
    return data;
  }
};

// Stock Movements API
export const movementsAPI = {
  getAll: async (filters?: {
    type?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StockMovement[]> => {
    const { data } = await api.get('/movements', { params: filters });
    return data;
  }
};

// Smart Ordering API
export const smartOrderingAPI = {
  // AI-powered suggestions
  getSuggestions: async (): Promise<{ suggestions: SmartOrderSuggestion[] }> => {
    const { data } = await api.post('/smart-ordering/suggestions');
    return data;
  },

  // Dashboard
  getDashboard: async (): Promise<SmartOrderingDashboard> => {
    const { data } = await api.get('/smart-ordering/dashboard');
    return data;
  },

  // Reorder Alerts
  getAlerts: async (filters?: {
    status?: string;
    priority?: string;
    itemId?: string;
  }): Promise<ReorderAlert[]> => {
    const { data } = await api.get('/smart-ordering/alerts', { params: filters });
    return data;
  },

  acknowledgeAlert: async (alertId: string): Promise<ReorderAlert> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/acknowledge`);
    return data;
  },

  dismissAlert: async (alertId: string, reason?: string): Promise<ReorderAlert> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/dismiss`, { reason });
    return data;
  },

  createPOFromAlert: async (alertId: string): Promise<{ alert: ReorderAlert; purchaseOrder: any }> => {
    const { data } = await api.post(`/smart-ordering/alerts/${alertId}/create-po`);
    return data;
  },

  // Reorder Rules
  getRules: async (itemId?: string): Promise<ReorderRule[]> => {
    const params = itemId ? { itemId } : undefined;
    const { data } = await api.get('/smart-ordering/rules', { params });
    return data;
  },

  createOrUpdateRule: async (rule: CreateReorderRuleInput): Promise<ReorderRule> => {
    const { data } = await api.post('/smart-ordering/rules', rule);
    return data;
  },

  deleteRule: async (itemId: string): Promise<void> => {
    await api.delete(`/smart-ordering/rules/${itemId}`);
  },

  // Usage Analytics
  getUsageAnalytics: async (itemId: string): Promise<UsageAnalytics> => {
    const { data } = await api.get(`/smart-ordering/usage/${itemId}`);
    return data;
  },

  // Run stock check on all items
  checkAllStock: async (): Promise<{ alertsCreated: number; itemsChecked: number }> => {
    const { data } = await api.post('/smart-ordering/check-all');
    return data;
  },

  // Predictive ordering forecasts
  getForecasts: async (days?: number): Promise<ForecastResponse> => {
    const params = days ? { days } : undefined;
    const { data } = await api.get('/smart-ordering/forecasts', { params });
    return data;
  }
};

// Locations API
export const locationsAPI = {
  getAll: async (): Promise<Location[]> => {
    const { data } = await api.get('/locations');
    return data;
  },

  getById: async (id: string): Promise<Location> => {
    const { data } = await api.get(`/locations/${id}`);
    return data;
  },

  create: async (location: Omit<Location, 'id'>): Promise<Location> => {
    const { data } = await api.post('/locations', location);
    return data;
  },

  update: async (id: string, updates: Partial<Location>): Promise<Location> => {
    const { data } = await api.put(`/locations/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/locations/${id}`);
    return data;
  },

  getStock: async (id: string) => {
    const { data } = await api.get(`/locations/${id}/stock`);
    return data;
  }
};

// Stock Transfers API
export const stockTransfersAPI = {
  getAll: async (filters?: {
    itemId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StockTransfer[]> => {
    const { data } = await api.get('/stock-transfers', { params: filters });
    return data;
  },

  create: async (transfer: {
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    reason?: string;
  }): Promise<StockTransfer> => {
    const { data } = await api.post('/stock-transfers', transfer);
    return data;
  }
};

// Analytics API (ABC Classification and Dead Stock)
export const analyticsAPI = {
  getABCClassification: async () => {
    const { data } = await api.get('/analytics/abc-classification');
    return data;
  },

  recalculateABC: async () => {
    const { data } = await api.post('/analytics/recalculate-abc');
    return data;
  },

  getDeadStock: async () => {
    const { data } = await api.get('/analytics/dead-stock');
    return data;
  }
};

// Quotes API
export const quotesAPI = {
  getAll: async (filters?: {
    status?: string;
    customer_id?: string;
    job_id?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
  }): Promise<Quote[]> => {
    const { data } = await api.get('/quotes', { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Quote> => {
    const { data } = await api.get(`/quotes/${id}`);
    return data;
  },

  getStats: async (): Promise<QuoteStats> => {
    const { data } = await api.get('/quotes/stats');
    return data;
  },

  create: async (quote: CreateQuoteInput): Promise<Quote> => {
    const { data } = await api.post('/quotes', quote);
    return data;
  },

  update: async (id: string, updates: Partial<CreateQuoteInput>): Promise<Quote> => {
    const { data } = await api.put(`/quotes/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/quotes/${id}`);
    return data;
  },

  send: async (id: string) => {
    const { data } = await api.post(`/quotes/${id}/send`);
    return data;
  },

  approve: async (id: string, notes?: string) => {
    const { data } = await api.post(`/quotes/${id}/approve`, { notes });
    return data;
  },

  reject: async (id: string, reason?: string) => {
    const { data } = await api.post(`/quotes/${id}/reject`, { reason });
    return data;
  },

  duplicate: async (id: string) => {
    const { data } = await api.post(`/quotes/${id}/duplicate`);
    return data;
  },

  revise: async (id: string) => {
    const { data } = await api.post(`/quotes/${id}/revise`);
    return data;
  },

  createFromJob: async (jobId: string, options?: {
    customerId?: string;
    customerName?: string;
    defaultMarkup?: number;
  }) => {
    const { data } = await api.post(`/quotes/from-job/${jobId}`, options);
    return data;
  },

  // Quote items
  addItem: async (quoteId: string, item: CreateQuoteItemInput): Promise<QuoteItem> => {
    const { data } = await api.post(`/quotes/${quoteId}/items`, item);
    return data;
  },

  updateItem: async (quoteId: string, itemId: string, updates: Partial<CreateQuoteItemInput>): Promise<QuoteItem> => {
    const { data } = await api.put(`/quotes/${quoteId}/items/${itemId}`, updates);
    return data;
  },

  removeItem: async (quoteId: string, itemId: string) => {
    const { data } = await api.delete(`/quotes/${quoteId}/items/${itemId}`);
    return data;
  },

  // Templates
  getTemplates: async (): Promise<QuoteTemplate[]> => {
    const { data } = await api.get('/quotes/templates/list');
    return data;
  }
};

// Invoices API
export const invoicesAPI = {
  getAll: async (filters?: {
    status?: string;
    customer_id?: string;
    job_id?: string;
    quote_id?: string;
    from_date?: string;
    to_date?: string;
    overdue_only?: boolean;
    search?: string;
  }): Promise<Invoice[]> => {
    const { data } = await api.get('/invoices', { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const { data } = await api.get(`/invoices/${id}`);
    return data;
  },

  getStats: async (): Promise<InvoiceStats> => {
    const { data } = await api.get('/invoices/stats');
    return data;
  },

  create: async (invoice: CreateInvoiceInput): Promise<Invoice> => {
    const { data } = await api.post('/invoices', invoice);
    return data;
  },

  update: async (id: string, updates: Partial<CreateInvoiceInput>): Promise<Invoice> => {
    const { data } = await api.put(`/invoices/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/invoices/${id}`);
    return data;
  },

  send: async (id: string) => {
    const { data } = await api.post(`/invoices/${id}/send`);
    return data;
  },

  markViewed: async (id: string) => {
    const { data } = await api.post(`/invoices/${id}/viewed`);
    return data;
  },

  void: async (id: string, reason?: string) => {
    const { data } = await api.post(`/invoices/${id}/void`, { reason });
    return data;
  },

  duplicate: async (id: string) => {
    const { data } = await api.post(`/invoices/${id}/duplicate`);
    return data;
  },

  sendReminder: async (id: string) => {
    const { data } = await api.post(`/invoices/${id}/reminder`);
    return data;
  },

  createFromQuote: async (quoteId: string) => {
    const { data } = await api.post(`/invoices/from-quote/${quoteId}`);
    return data;
  },

  createFromJob: async (jobId: string, options?: {
    customerId?: string;
    customerName?: string;
    includeLabor?: boolean;
  }) => {
    const { data } = await api.post(`/invoices/from-job/${jobId}`, options);
    return data;
  },

  // Invoice items
  addItem: async (invoiceId: string, item: CreateInvoiceItemInput): Promise<InvoiceItem> => {
    const { data } = await api.post(`/invoices/${invoiceId}/items`, item);
    return data;
  },

  updateItem: async (invoiceId: string, itemId: string, updates: Partial<CreateInvoiceItemInput>): Promise<InvoiceItem> => {
    const { data } = await api.put(`/invoices/${invoiceId}/items/${itemId}`, updates);
    return data;
  },

  removeItem: async (invoiceId: string, itemId: string) => {
    const { data } = await api.delete(`/invoices/${invoiceId}/items/${itemId}`);
    return data;
  },

  // Payments
  getPayments: async (invoiceId: string): Promise<InvoicePayment[]> => {
    const { data } = await api.get(`/invoices/${invoiceId}/payments`);
    return data;
  },

  recordPayment: async (invoiceId: string, payment: RecordPaymentInput): Promise<InvoicePayment> => {
    const { data } = await api.post(`/invoices/${invoiceId}/payments`, payment);
    return data;
  },

  deletePayment: async (invoiceId: string, paymentId: string) => {
    const { data } = await api.delete(`/invoices/${invoiceId}/payments/${paymentId}`);
    return data;
  }
};

export default api;
