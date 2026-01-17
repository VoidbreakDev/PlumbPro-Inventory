import { create } from 'zustand';
import type {
  InventoryItem,
  Contact,
  Job,
  JobTemplate,
  StockMovement,
  SmartOrderSuggestion,
  Location,
  StockTransfer
} from '../types';
import {
  authAPI,
  inventoryAPI,
  contactsAPI,
  jobsAPI,
  templatesAPI,
  movementsAPI,
  smartOrderingAPI,
  locationsAPI,
  stockTransfersAPI,
  analyticsAPI
} from '../lib/api';
import { storage } from '../lib/storage';
import { getErrorMessage } from '../lib/errors';
import { logSyncFailure } from '../lib/logging';

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
  locations: Location[];
  stockTransfers: StockTransfer[];

  // UI State
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;

  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, companyName?: string) => Promise<void>;
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
  deleteAllInventoryItems: () => Promise<void>;

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

  // Location Actions
  fetchLocations: () => Promise<void>;
  addLocation: (location: Omit<Location, 'id'>) => Promise<void>;
  updateLocation: (id: string, updates: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;

  // Stock Transfer Actions
  fetchStockTransfers: (filters?: any) => Promise<void>;
  createStockTransfer: (transfer: {
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    reason?: string;
  }) => Promise<void>;

  // Analytics Actions
  recalculateABC: () => Promise<void>;

  // Utility Actions
  setError: (error: string | null) => void;
  clearError: () => void;

  // Local State Setters
  setInventoryState: (items: InventoryItem[]) => void;
  setJobsState: (jobs: Job[]) => void;
  setMovementsState: (movements: StockMovement[]) => void;
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
  locations: [],
  stockTransfers: [],
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
    } catch (error) {
      const message = getErrorMessage(error, 'Login failed');
      set({
        error: message,
        isLoading: false
      });
      throw error;
    }
  },

  register: async (email: string, password: string, fullName: string, companyName?: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.register(email, password, fullName, companyName);

      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      set({
        user: response.user,
        authToken: response.token,
        isAuthenticated: true,
        isLoading: false
      });

      // Sync data after registration (will be empty for new user)
      await get().syncWithServer();
    } catch (error) {
      const message = getErrorMessage(error, 'Registration failed');
      set({
        error: message,
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

      const [inventory, contacts, jobs, templates, movements, locations] = await Promise.all([
        inventoryAPI.getAll(),
        contactsAPI.getAll(),
        jobsAPI.getAll(),
        templatesAPI.getAll(),
        movementsAPI.getAll(),
        locationsAPI.getAll()
      ]);

      const syncTimestamp = Date.now();

      // Update state
      set({
        inventory,
        contacts,
        jobs,
        templates,
        movements,
        locations,
        lastSync: syncTimestamp,
        isSyncing: false
      });

      // Save to local storage
      await Promise.all([
        storage.setInventory(inventory),
        storage.setContacts(contacts),
        storage.setJobs(jobs),
        storage.setTemplates(templates),
        storage.setMovements(movements),
        storage.setLastSync(syncTimestamp)
      ]);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to sync with server');
      logSyncFailure(error, { message });
      set({ isSyncing: false, error: message });
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
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load inventory');
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  addInventoryItem: async (item) => {
    try {
      const newItem = await inventoryAPI.create(item);
      set((state) => ({
        inventory: [...state.inventory, newItem]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add inventory item');
      set({ error: message });
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
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update inventory item');
      set({ error: message });
      throw error;
    }
  },

  adjustStock: async (id, quantity, reason) => {
    try {
      await inventoryAPI.adjust(id, quantity, reason);
      await get().fetchInventory();
      await get().fetchMovements();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to adjust stock');
      set({ error: message });
      throw error;
    }
  },

  deleteInventoryItem: async (id) => {
    try {
      await inventoryAPI.delete(id);
      set((state) => ({
        inventory: state.inventory.filter((item) => item.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete inventory item');
      set({ error: message });
      throw error;
    }
  },

  deleteAllInventoryItems: async () => {
    try {
      await inventoryAPI.deleteAll();
      set({ inventory: [] });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete all inventory items');
      set({ error: message });
      throw error;
    }
  },

  // Contact Actions
  fetchContacts: async () => {
    try {
      const contacts = await contactsAPI.getAll();
      set({ contacts });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load contacts');
      set({ error: message });
      throw error;
    }
  },

  addContact: async (contact) => {
    try {
      const newContact = await contactsAPI.create(contact);
      set((state) => ({
        contacts: [...state.contacts, newContact]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add contact');
      set({ error: message });
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
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update contact');
      set({ error: message });
      throw error;
    }
  },

  deleteContact: async (id) => {
    try {
      await contactsAPI.delete(id);
      set((state) => ({
        contacts: state.contacts.filter((contact) => contact.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete contact');
      set({ error: message });
      throw error;
    }
  },

  // Job Actions
  fetchJobs: async () => {
    try {
      const jobs = await jobsAPI.getAll();
      set({ jobs });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load jobs');
      set({ error: message });
      throw error;
    }
  },

  addJob: async (job) => {
    try {
      const newJob = await jobsAPI.create(job);
      set((state) => ({
        jobs: [...state.jobs, newJob]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add job');
      set({ error: message });
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
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update job');
      set({ error: message });
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
      const message = getErrorMessage(error, 'Failed to pick job');
      set({ error: message });
      throw error;
    }
  },

  deleteJob: async (id) => {
    try {
      await jobsAPI.delete(id);
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete job');
      set({ error: message });
      throw error;
    }
  },

  // Template Actions
  fetchTemplates: async () => {
    try {
      const templates = await templatesAPI.getAll();
      set({ templates });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load templates');
      set({ error: message });
      throw error;
    }
  },

  addTemplate: async (template) => {
    try {
      const newTemplate = await templatesAPI.create(template);
      set((state) => ({
        templates: [...state.templates, newTemplate]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add template');
      set({ error: message });
      throw error;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      await templatesAPI.update(id, updates);
      await get().fetchTemplates();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update template');
      set({ error: message });
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    try {
      await templatesAPI.delete(id);
      set((state) => ({
        templates: state.templates.filter((template) => template.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete template');
      set({ error: message });
      throw error;
    }
  },

  // Movement Actions
  fetchMovements: async (filters) => {
    try {
      const movements = await movementsAPI.getAll(filters);
      set({ movements });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load movements');
      set({ error: message });
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
      const message = getErrorMessage(error, 'Failed to generate smart suggestions');
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Location Actions
  fetchLocations: async () => {
    try {
      const locations = await locationsAPI.getAll();
      set({ locations });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to fetch locations');
      set({ error: message });
      throw error;
    }
  },

  addLocation: async (location) => {
    try {
      const newLocation = await locationsAPI.create(location);
      set((state) => ({
        locations: [...state.locations, newLocation]
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add location');
      set({ error: message });
      throw error;
    }
  },

  updateLocation: async (id, updates) => {
    try {
      const updated = await locationsAPI.update(id, updates);
      set((state) => ({
        locations: state.locations.map((loc) =>
          loc.id === id ? updated : loc
        )
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update location');
      set({ error: message });
      throw error;
    }
  },

  deleteLocation: async (id) => {
    try {
      await locationsAPI.delete(id);
      set((state) => ({
        locations: state.locations.filter((loc) => loc.id !== id)
      }));
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete location');
      set({ error: message });
      throw error;
    }
  },

  // Stock Transfer Actions
  fetchStockTransfers: async (filters) => {
    try {
      const transfers = await stockTransfersAPI.getAll(filters);
      set({ stockTransfers: transfers });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to fetch stock transfers');
      set({ error: message });
      throw error;
    }
  },

  createStockTransfer: async (transfer) => {
    try {
      const newTransfer = await stockTransfersAPI.create(transfer);
      set((state) => ({
        stockTransfers: [newTransfer, ...state.stockTransfers]
      }));
      // Refresh inventory to get updated location stock
      await get().fetchInventory();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create stock transfer');
      set({ error: message });
      throw error;
    }
  },

  // Analytics Actions
  recalculateABC: async () => {
    try {
      set({ isLoading: true });
      await analyticsAPI.recalculateABC();
      // Refresh inventory to get updated classifications
      await get().fetchInventory();
      set({ isLoading: false });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to recalculate ABC classification');
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Local State Setters
  setInventoryState: (items) => set({ inventory: items }),
  setJobsState: (jobs) => set({ jobs }),
  setMovementsState: (movements) => set({ movements }),

  // Utility Actions
  setError: (error) => set({ error }),
  clearError: () => set({ error: null })
}));

export default useStore;
