import { analyticsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createAnalyticsStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'recalculateABC'> => ({
  recalculateABC: async () => {
    try {
      set({ isLoading: true });
      await analyticsAPI.recalculateABC();
      await get().fetchInventory();
      set({ isLoading: false });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to recalculate ABC classification');
      set({ isLoading: false, error: message });
      throw error;
    }
  }
});
