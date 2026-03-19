import { storage } from '../lib/storage';
import type { AppState, StoreSet } from './storeTypes';

export const createUtilityStoreActions = (
  set: StoreSet
): Pick<
  AppState,
  | 'setInventoryState'
  | 'setJobsState'
  | 'setDevelopmentProjectsState'
  | 'setKitsState'
  | 'setMovementsState'
  | 'setError'
  | 'clearError'
> => ({
  setInventoryState: (items) => set({ inventory: items }),
  setJobsState: (jobs) => set({ jobs }),
  setDevelopmentProjectsState: (developmentProjects) => set({ developmentProjects }),
  setKitsState: (kits) => {
    void storage.setKits(kits);
    set({ kits });
  },
  setMovementsState: (movements) => set({ movements }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null })
});
