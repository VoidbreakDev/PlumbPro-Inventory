/**
 * Customer Portal API Client
 * Handles all API calls for the customer portal
 */

import axios from 'axios';
import { API_ROOT_URL } from './api';

const api = axios.create({
  baseURL: `${API_ROOT_URL}/portal`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
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
  items?: Array<{
    item_name: string;
    quantity: number;
  }>;
}

export interface PortalQuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_type: string;
}

export interface PortalQuote extends PortalJob {
  quote_sent_at?: string;
  quote_expires_at?: string;
  items?: PortalQuoteItem[];
}

export interface PortalInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_type: string;
}

export interface PortalPayment {
  amount: number;
  payment_date: string;
  payment_method: string;
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
