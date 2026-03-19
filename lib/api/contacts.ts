import type {
  Contact,
  ContactStats,
  CreateCustomerNoteInput,
  CreateCustomerPricingInput,
  CreateServiceAgreementInput,
  CustomerHistory,
  CustomerNote,
  CustomerPricing,
  ServiceAgreement
} from '../../types';
import api from './client';

type ContactFilters = {
  type?: string;
  status?: string;
  customerType?: string;
  search?: string;
  tags?: string;
  isVip?: boolean;
  limit?: number;
  offset?: number;
};

export const contactsAPI = {
  getAll: async (filters?: ContactFilters): Promise<Contact[]> => {
    const { data } = await api.get('/contacts', { params: filters });
    return data;
  },

  getContacts: async (filters?: ContactFilters): Promise<Contact[]> => {
    return contactsAPI.getAll(filters);
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

  getPricing: async (contactId: string): Promise<CustomerPricing[]> => {
    const { data } = await api.get(`/contacts/${contactId}/pricing`);
    return data;
  },

  createPricing: async (contactId: string, pricing: CreateCustomerPricingInput): Promise<CustomerPricing> => {
    const { data } = await api.post(`/contacts/${contactId}/pricing`, pricing);
    return data;
  },

  updatePricing: async (contactId: string, pricingId: string, updates: Partial<CreateCustomerPricingInput>): Promise<CustomerPricing> => {
    const { data } = await api.put(`/contacts/${contactId}/pricing/${pricingId}`, updates);
    return data;
  },

  deletePricing: async (contactId: string, pricingId: string) => {
    const { data } = await api.delete(`/contacts/${contactId}/pricing/${pricingId}`);
    return data;
  }
};
