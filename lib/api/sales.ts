import type {
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  CreateQuoteInput,
  CreateQuoteItemInput,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStats,
  Quote,
  QuoteItem,
  QuoteStats,
  QuoteTemplate,
  RecordPaymentInput
} from '../../types';
import api from './client';

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

  getTemplates: async (): Promise<QuoteTemplate[]> => {
    const { data } = await api.get('/quotes/templates/list');
    return data;
  }
};

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
