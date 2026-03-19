import {
  developmentProjectsAPI,
  inventoryAPI,
  contactsAPI,
  jobsAPI,
  templatesAPI,
  movementsAPI,
  locationsAPI
} from '../lib/api';
import { kitAPI } from '../lib/kitAPI';
import { getErrorMessage } from '../lib/errors';
import { logSyncFailure } from '../lib/logging';
import { storage } from '../lib/storage';
import {
  loadOfflineStateSnapshot,
  normalizeOfflineStateSnapshot,
  persistOfflineStateSnapshot,
  type OfflineStateSnapshot
} from './offlineState';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

const fetchServerSnapshot = async (): Promise<OfflineStateSnapshot> => {
  const [inventory, contacts, jobs, developmentProjects, templates, kits, movements, locations] = await Promise.all([
    inventoryAPI.getAll(),
    contactsAPI.getAll(),
    jobsAPI.getAll(),
    developmentProjectsAPI.getAll(),
    templatesAPI.getAll(),
    kitAPI.getKits({ pageSize: 500 }).then((response) => response.kits),
    movementsAPI.getAll(),
    locationsAPI.getAll()
  ]);

  return normalizeOfflineStateSnapshot({
    inventory,
    contacts,
    jobs,
    developmentProjects,
    templates,
    kits,
    movements,
    locations,
    lastSync: Date.now()
  });
};

export const createSyncStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'loadFromStorage' | 'syncWithServer'> => ({
  loadFromStorage: async () => {
    try {
      const snapshot = await loadOfflineStateSnapshot();
      set(snapshot);
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  },

  syncWithServer: async () => {
    try {
      set({ isSyncing: true });

      const snapshot = await fetchServerSnapshot();
      set({
        ...snapshot,
        isSyncing: false
      });

      await persistOfflineStateSnapshot(snapshot);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to sync with server');
      logSyncFailure(error, { message });
      set({ isSyncing: false, error: message });
      await get().loadFromStorage();
    }
  }
});
