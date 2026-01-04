import { create } from 'zustand';
import type {
  InventoryItem,
  Contact,
  Job,
  JobTemplate,
  StockMovement,
  SmartOrderSuggestion
} from '../types';
import {
  inventoryAPI,
  contactsAPI,
  jobsAPI,
  templatesAPI,
  movementsAPI,
  smartOrderingAPI
} from '../lib/api';
import { storage } from '../lib/storage';

interface User {
  id: string;
  email: string;
  fullName: string;
  companyName?: string;
  role: string;
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;

  // Data
  inventory: InventoryItem[];
  contacts: Contact[];
  jobs: Job[];
  templates: JobTemplate[];
  movements: StockMovement[];
  smartSuggestions: SmartOrderSuggestion[];

  // UI State
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;

  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;

  // Data Actions
  loadFromStorage: () => Promise<void>;
  syncWithServer: () => Promise<void>;

  // Inventory Actions
  fetchInventory: () => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  adjustStock: (id: string, quantity: number, reason: string) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;

  // Contact Actions
  fetchContacts: () => Promise<void>;
  addContact: (contact: Omit<Contact, 'id'>) => Promise<void>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  // Job Actions
  fetchJobs: () => Promise<void>;
  addJob: (job: Omit<Job, 'id'>) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  pickJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;

  // Template Actions
  fetchTemplates: () => Promise<void>;
  addTemplate: (template: Omit<JobTemplate, 'id'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<JobTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Movement Actions
  fetchMovements: (filters?: any) => Promise<void>;

  // Smart Ordering Actions
  generateSmartSuggestions: () => Promise<void>;

  // Utility Actions
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  authToken: null,
  inventory: [],
  contacts: [],
  jobs: [],
  templates: [],
  movements: [],
  smartSuggestions: [],
  isLoading: false,
  isSyncing: false,
  lastSync: null,
  error: null,

  // Auth Actions
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.login(email, password);

      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      set({
        user: response.user,
        authToken: response.token,
        isAuthenticated: true,
        isLoading: false
      });

      // Sync data after login
      await get().syncWithServer();
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Login failed',
        isLoading: false
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    storage.clearAll();

    set({
      user: null,
      authToken: null,
      isAuthenticated: false,
      inventory: [],
      contacts: [],
      jobs: [],
      templates: [],
      movements: [],
      smartSuggestions: []
    });
  },

  setUser: (user: User, token: string) => {
    set({
      user,
      authToken: token,
      isAuthenticated: true
    });
  },

  // Load from local storage (offline mode)
  loadFromStorage: async () => {
    try {
      const [inventory, contacts, jobs, templates, movements, lastSync] = await Promise.all([
        storage.getInventory(),
        storage.getContacts(),
        storage.getJobs(),
        storage.getTemplates(),
        storage.getMovements(),
        storage.getLastSync()
      ]);

      set({
        inventory,
        contacts,
        jobs,
        templates,
        movements,
        lastSync
      });
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  },

  // Sync with server
  syncWithServer: async () => {
    try {
      set({ isSyncing: true });

      const [inventory, contacts, jobs, templates, movements] = await Promise.all([
        inventoryAPI.getAll(),
        contactsAPI.getAll(),
        jobsAPI.getAll(),
        templatesAPI.getAll(),
        movementsAPI.getAll()
      ]);

      // Update state
      set({
        inventory,
        contacts,
        jobs,
        templates,
        movements,
        lastSync: Date.now(),
        isSyncing: false
      });

      // Save to local storage
      await Promise.all([
        storage.setInventory(inventory),
        storage.setContacts(contacts),
        storage.setJobs(jobs),
        storage.setTemplates(templates),
        storage.setMovements(movements),
        storage.setLastSync(Date.now())
      ]);
    } catch (error) {
      console.error('Sync failed:', error);
      set({ isSyncing: false });
      // Load from storage as fallback
      await get().loadFromStorage();
    }
  },

  // Inventory Actions
  fetchInventory: async () => {
    try {
      set({ isLoading: true });
      const inventory = await inventoryAPI.getAll();
      set({ inventory, isLoading: false });
      await storage.setInventory(inventory);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  addInventoryItem: async (item) => {
    try {
      const newItem = await inventoryAPI.create(item);
      set((state) => ({
        inventory: [...state.inventory, newItem]
      }));
      await storage.setInventory(get().inventory);
    } catch (error) {
      throw error;
    }
  },

  updateInventoryItem: async (id, updates) => {
    try {
      const updated = await inventoryAPI.update(id, updates);
      set((state) => ({
        inventory: state.inventory.map((item) =>
          item.id === id ? { ...item, ...updated } : item
        )
      }));
      await storage.setInventory(get().inventory);
    } catch (error) {
      throw error;
    }
  },

  adjustStock: async (id, quantity, reason) => {
    try {
      await inventoryAPI.adjust(id, quantity, reason);
      await get().fetchInventory();
      await get().fetchMovements();
    } catch (error) {
      throw error;
    }
  },

  deleteInventoryItem: async (id) => {
    try {
      await inventoryAPI.delete(id);
      set((state) => ({
        inventory: state.inventory.filter((item) => item.id !== id)
      }));
      await storage.setInventory(get().inventory);
    } catch (error) {
      throw error;
    }
  },

  // Contact Actions
  fetchContacts: async () => {
    try {
      const contacts = await contactsAPI.getAll();
      set({ contacts });
      await storage.setContacts(contacts);
    } catch (error) {
      throw error;
    }
  },

  addContact: async (contact) => {
    try {
      const newContact = await contactsAPI.create(contact);
      set((state) => ({
        contacts: [...state.contacts, newContact]
      }));
      await storage.setContacts(get().contacts);
    } catch (error) {
      throw error;
    }
  },

  updateContact: async (id, updates) => {
    try {
      const updated = await contactsAPI.update(id, updates);
      set((state) => ({
        contacts: state.contacts.map((contact) =>
          contact.id === id ? { ...contact, ...updated } : contact
        )
      }));
      await storage.setContacts(get().contacts);
    } catch (error) {
      throw error;
    }
  },

  deleteContact: async (id) => {
    try {
      await contactsAPI.delete(id);
      set((state) => ({
        contacts: state.contacts.filter((contact) => contact.id !== id)
      }));
      await storage.setContacts(get().contacts);
    } catch (error) {
      throw error;
    }
  },

  // Job Actions
  fetchJobs: async () => {
    try {
      const jobs = await jobsAPI.getAll();
      set({ jobs });
      await storage.setJobs(jobs);
    } catch (error) {
      throw error;
    }
  },

  addJob: async (job) => {
    try {
      const newJob = await jobsAPI.create(job);
      set((state) => ({
        jobs: [...state.jobs, newJob]
      }));
      await storage.setJobs(get().jobs);
    } catch (error) {
      throw error;
    }
  },

  updateJob: async (id, updates) => {
    try {
      const updated = await jobsAPI.update(id, updates);
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, ...updated } : job
        )
      }));
      await storage.setJobs(get().jobs);
    } catch (error) {
      throw error;
    }
  },

  pickJob: async (id) => {
    try {
      await jobsAPI.pick(id);
      await get().fetchJobs();
      await get().fetchInventory();
      await get().fetchMovements();
    } catch (error) {
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      await jobsAPI.delete(id);
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id)
      }));
      await storage.setJobs(get().jobs);
    } catch (error) {
      throw error;
    }
  },

  // Template Actions
  fetchTemplates: async () => {
    try {
      const templates = await templatesAPI.getAll();
      set({ templates });
      await storage.setTemplates(templates);
    } catch (error) {
      throw error;
    }
  },

  addTemplate: async (template) => {
    try {
      const newTemplate = await templatesAPI.create(template);
      set((state) => ({
        templates: [...state.templates, newTemplate]
      }));
      await storage.setTemplates(get().templates);
    } catch (error) {
      throw error;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      await templatesAPI.update(id, updates);
      await get().fetchTemplates();
    } catch (error) {
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    try {
      await templatesAPI.delete(id);
      set((state) => ({
        templates: state.templates.filter((template) => template.id !== id)
      }));
      await storage.setTemplates(get().templates);
    } catch (error) {
      throw error;
    }
  },

  // Movement Actions
  fetchMovements: async (filters) => {
    try {
      const movements = await movementsAPI.getAll(filters);
      set({ movements });
      await storage.setMovements(movements);
    } catch (error) {
      throw error;
    }
  },

  // Smart Ordering Actions
  generateSmartSuggestions: async () => {
    try {
      set({ isLoading: true });
      const response = await smartOrderingAPI.getSuggestions();
      set({
        smartSuggestions: response.suggestions,
        isLoading: false
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Utility Actions
  setError: (error) => set({ error }),
  clearError: () => set({ error: null })
}));

export default useStore;
