/**
 * Invoices API Client
 * Handles all API calls for invoice management
 */

import axios from 'axios';
import { API_ROOT_URL } from './api';
import { clearAuthSession, getAuthToken } from './authSession';

const api = axios.create({
  baseURL: `${API_ROOT_URL}/invoices`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  item_type: 'material' | 'labor' | 'service' | 'other';
  inventory_item_id?: string;
  sort_order?: number;
}

export interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  reference?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  contact_id: string;
  job_id?: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes?: string;
  terms?: string;
  sent_at?: string;
  paid_at?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  job_title?: string;
  items: InvoiceItem[];
  payments?: Payment[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceStats {
  outstanding_count: number;
  overdue_count: number;
  paid_count: number;
  outstanding_amount: number;
  due_amount: number;
  collected_30d: number;
}

export interface CreateInvoiceRequest {
  contact_id: string;
  job_id?: string;
  issue_date?: string;
  due_date?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
    item_type?: string;
    inventory_item_id?: string;
  }>;
  notes?: string;
  terms?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  payment_method: 'credit_card' | 'bank_transfer' | 'cash' | 'check' | 'stripe' | 'other';
  payment_date?: string;
  reference?: string;
  notes?: string;
}

export const invoicesAPI = {
  // Get all invoices
  getInvoices: async (params?: { status?: string; contact_id?: string; limit?: number; offset?: number }): Promise<Invoice[]> => {
    const response = await api.get('/', { params });
    return response.data;
  },

  // Get invoice statistics
  getStats: async (): Promise<InvoiceStats> => {
    const response = await api.get('/stats/summary');
    return response.data;
  },

  // Get single invoice
  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get(`/${id}`);
    return response.data;
  },

  // Create invoice
  createInvoice: async (data: CreateInvoiceRequest): Promise<Invoice> => {
    const response = await api.post('/', data);
    return response.data;
  },

  // Update invoice
  updateInvoice: async (id: string, data: Partial<CreateInvoiceRequest>): Promise<Invoice> => {
    const response = await api.put(`/${id}`, data);
    return response.data;
  },

  // Send invoice to customer
  sendInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.post(`/${id}/send`);
    return response.data;
  },

  // Record payment
  recordPayment: async (id: string, data: RecordPaymentRequest): Promise<Payment> => {
    const response = await api.post(`/${id}/payments`, data);
    return response.data;
  },

  // Delete invoice (draft only)
  deleteInvoice: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/${id}`);
    return response.data;
  },

  // Create Stripe payment intent
  createPaymentIntent: async (id: string): Promise<{ clientSecret: string; amount: number }> => {
    const response = await api.post(`/${id}/payment-intent`);
    return response.data;
  }
};

export default invoicesAPI;
