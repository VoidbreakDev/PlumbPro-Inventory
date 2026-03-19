import { movementsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreSet } from './storeTypes';

export const createMovementStoreActions = (
  set: StoreSet
): Pick<AppState, 'fetchMovements'> => ({
  fetchMovements: async (filters) => {
    try {
      const movements = await movementsAPI.getAll(filters);
      set({ movements });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load movements');
      set({ error: message });
      throw error;
    }
  }
});
