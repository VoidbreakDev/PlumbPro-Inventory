/**
 * Customer Portal API Client
 * Handles all API calls for the customer portal
 */

import axios from 'axios';
import { API_ROOT_URL } from './api';

const PORTAL_TOKEN_KEY = 'portal_token';

const getPortalToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionToken = window.sessionStorage.getItem(PORTAL_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  const legacyToken = window.localStorage.getItem(PORTAL_TOKEN_KEY);
  if (legacyToken) {
    window.sessionStorage.setItem(PORTAL_TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(PORTAL_TOKEN_KEY);
    return legacyToken;
  }

  return null;
};

export const setPortalToken = (token: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PORTAL_TOKEN_KEY, token);
  window.localStorage.removeItem(PORTAL_TOKEN_KEY);
};

export const clearPortalToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PORTAL_TOKEN_KEY);
  window.localStorage.removeItem(PORTAL_TOKEN_KEY);
};

const api = axios.create({
  baseURL: `${API_ROOT_URL}/portal`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getPortalToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  businessName: string;
}

export interface PortalAuthResponse {
  token: string;
  customer: PortalCustomer;
}

export interface PortalJob {
  id: string;
  title: string;
  job_type: string;
  status: string;
  date: string;
  is_picked: boolean;
  quote_status?: string;
  quote_total?: number;
  workers?: Array<{ name: string; type: string }>;
  items?: Array<Record<string, unknown>>;
}

export interface PortalQuoteItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_type: string;
}

export interface PortalQuote {
  id: string;
  title: string;
  job_type: string;
  status: string;
  date: string;
  is_picked: boolean;
  quote_status?: string;
  quote_total?: number;
  workers?: Array<{ name: string; type: string }>;
  quote_sent_at?: string;
  quote_expires_at?: string;
  items?: PortalQuoteItem[];
}

export interface PortalInvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_type: string;
}

export interface PortalPayment {
  id?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes?: string;
  items?: PortalInvoiceItem[];
  payments?: PortalPayment[];
}

export interface PortalDashboard {
  stats: {
    total_jobs: number;
    completed_jobs: number;
    pending_quotes: number;
    unpaid_invoices: number;
    outstanding_amount: number;
  };
  recentJobs: PortalJob[];
  pendingQuotes: PortalQuote[];
  unpaidInvoices: PortalInvoice[];
}

export const portalAPI = {
  // Auth
  requestMagicLink: async (email: string): Promise<{ message: string; magicLink?: string }> => {
    const response = await api.post('/auth/magic-link', { email });
    return response.data;
  },

  verifyToken: async (token: string): Promise<PortalAuthResponse> => {
    const response = await api.post('/auth/verify', { token });
    return response.data;
  },

  // Dashboard
  getDashboard: async (): Promise<PortalDashboard> => {
    const response = await api.get('/dashboard');
    return response.data;
  },

  // Jobs
  getJobs: async (status?: string): Promise<PortalJob[]> => {
    const response = await api.get('/jobs', { params: { status } });
    return response.data;
  },

  getJob: async (id: string): Promise<PortalJob> => {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  },

  // Quotes
  getQuotes: async (): Promise<PortalQuote[]> => {
    const response = await api.get('/quotes');
    return response.data;
  },

  approveQuote: async (id: string, notes?: string): Promise<{ message: string }> => {
    const response = await api.post(`/quotes/${id}/approve`, { notes });
    return response.data;
  },

  declineQuote: async (id: string, reason?: string): Promise<{ message: string }> => {
    const response = await api.post(`/quotes/${id}/decline`, { reason });
    return response.data;
  },

  // Invoices
  getInvoices: async (status?: string): Promise<PortalInvoice[]> => {
    const response = await api.get('/invoices', { params: { status } });
    return response.data;
  },

  getInvoice: async (id: string): Promise<PortalInvoice> => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  }
};

export default portalAPI;
