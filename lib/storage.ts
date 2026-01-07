import localforage from 'localforage';
import type {
  InventoryItem,
  Contact,
  Job,
  JobTemplate,
  StockMovement,
  AppSettings
} from '../types';

// Configure localforage
localforage.config({
  name: 'PlumbProInventory',
  storeName: 'plumbpro_data',
  description: 'Offline storage for PlumbPro Inventory'
});

// Storage keys
const KEYS = {
  INVENTORY: 'inventory_items',
  CONTACTS: 'contacts',
  JOBS: 'jobs',
  TEMPLATES: 'job_templates',
  MOVEMENTS: 'stock_movements',
  LAST_SYNC: 'last_sync_timestamp',
  SETTINGS: 'app_settings',
  RECENT_SEARCHES: 'recent_searches'
};

// Generic storage functions
export const storage = {
  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    return (await localforage.getItem(KEYS.INVENTORY)) || [];
  },

  async setInventory(items: InventoryItem[]): Promise<void> {
    await localforage.setItem(KEYS.INVENTORY, items);
  },

  // Contacts
  async getContacts(): Promise<Contact[]> {
    return (await localforage.getItem(KEYS.CONTACTS)) || [];
  },

  async setContacts(contacts: Contact[]): Promise<void> {
    await localforage.setItem(KEYS.CONTACTS, contacts);
  },

  // Jobs
  async getJobs(): Promise<Job[]> {
    return (await localforage.getItem(KEYS.JOBS)) || [];
  },

  async setJobs(jobs: Job[]): Promise<void> {
    await localforage.setItem(KEYS.JOBS, jobs);
  },

  // Templates
  async getTemplates(): Promise<JobTemplate[]> {
    return (await localforage.getItem(KEYS.TEMPLATES)) || [];
  },

  async setTemplates(templates: JobTemplate[]): Promise<void> {
    await localforage.setItem(KEYS.TEMPLATES, templates);
  },

  // Movements
  async getMovements(): Promise<StockMovement[]> {
    return (await localforage.getItem(KEYS.MOVEMENTS)) || [];
  },

  async setMovements(movements: StockMovement[]): Promise<void> {
    await localforage.setItem(KEYS.MOVEMENTS, movements);
  },

  // Last sync
  async getLastSync(): Promise<number | null> {
    return await localforage.getItem(KEYS.LAST_SYNC);
  },

  async setLastSync(timestamp: number): Promise<void> {
    await localforage.setItem(KEYS.LAST_SYNC, timestamp);
  },

  // Settings
  async getSettings(): Promise<AppSettings | null> {
    return (await localforage.getItem(KEYS.SETTINGS)) || null;
  },

  async setSettings(settings: AppSettings): Promise<void> {
    await localforage.setItem(KEYS.SETTINGS, settings);
  },

  // Recent searches
  async getRecentSearches(): Promise<string[] | null> {
    return (await localforage.getItem(KEYS.RECENT_SEARCHES)) || null;
  },

  async setRecentSearches(recentSearches: string[]): Promise<void> {
    await localforage.setItem(KEYS.RECENT_SEARCHES, recentSearches);
  },

  // Clear all data
  async clearAll(): Promise<void> {
    await localforage.clear();
  }
};

export default storage;
