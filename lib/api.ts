import axios from 'axios';
import { loadSettings } from './settings';
import type {
  InventoryItem,
  Contact,
  Job,
  JobTemplate,
  StockMovement,
  SmartOrderSuggestion
} from '../types';

export const DEFAULT_API_URL = 'http://localhost:5000/api';
export const DEFAULT_BACKEND_PORT = 5000;
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');
export const hasExplicitApiUrl = Boolean(import.meta.env.VITE_API_URL);

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

  adjust: async (id: string, quantity: number, reason: string) => {
    const { data } = await api.post(`/inventory/${id}/adjust`, { quantity, reason });
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/inventory/${id}`);
    return data;
  }
};

// Contacts API
export const contactsAPI = {
  getAll: async (type?: string): Promise<Contact[]> => {
    const { data } = await api.get('/contacts', { params: { type } });
    return data;
  },

  getById: async (id: string): Promise<Contact> => {
    const { data } = await api.get(`/contacts/${id}`);
    return data;
  },

  create: async (contact: Omit<Contact, 'id'>): Promise<Contact> => {
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
  getSuggestions: async (): Promise<{ suggestions: SmartOrderSuggestion[] }> => {
    const { data } = await api.post('/smart-ordering/suggestions');
    return data;
  }
};

export default api;
