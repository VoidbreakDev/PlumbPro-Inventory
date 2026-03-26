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

type SnapshotDomain = keyof Omit<OfflineStateSnapshot, 'lastSync'>;

const snapshotLoaders: Record<SnapshotDomain, () => Promise<OfflineStateSnapshot[SnapshotDomain]>> = {
  inventory: () => inventoryAPI.getAll(),
  contacts: () => contactsAPI.getAll(),
  jobs: () => jobsAPI.getAll(),
  developmentProjects: () => developmentProjectsAPI.getAll(),
  templates: () => templatesAPI.getAll(),
  kits: () => kitAPI.getKits({ pageSize: 500 }).then((response) => response.kits),
  movements: () => movementsAPI.getAll(),
  locations: () => locationsAPI.getAll()
};

const fetchServerSnapshot = async (): Promise<{
  snapshot: OfflineStateSnapshot;
  failedDomains: SnapshotDomain[];
  firstError: unknown;
}> => {
  const fallbackSnapshot = await loadOfflineStateSnapshot();
  const entries = Object.entries(snapshotLoaders) as Array<[SnapshotDomain, () => Promise<OfflineStateSnapshot[SnapshotDomain]>]>;
  const settledResults = await Promise.allSettled(
    entries.map(async ([domain, loader]) => [domain, await loader()] as const)
  );

  const nextSnapshot = {
    ...fallbackSnapshot
  };
  const failedDomains: SnapshotDomain[] = [];
  let firstError: unknown = null;

  settledResults.forEach((result, index) => {
    const [domain] = entries[index];

    if (result.status === 'fulfilled') {
      nextSnapshot[domain] = result.value[1];
      return;
    }

    failedDomains.push(domain);
    firstError ??= result.reason;
  });

  return {
    snapshot: normalizeOfflineStateSnapshot({
      ...nextSnapshot,
      lastSync: Date.now()
    }),
    failedDomains,
    firstError
  };
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

      const { snapshot, failedDomains, firstError } = await fetchServerSnapshot();

      if (failedDomains.length === Object.keys(snapshotLoaders).length) {
        throw firstError || new Error('All snapshot domains failed to sync');
      }

      set({
        ...snapshot,
        isSyncing: false,
        error: null
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
