import { smartOrderingAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreSet } from './storeTypes';

export const createSmartOrderingStoreActions = (
  set: StoreSet
): Pick<AppState, 'generateSmartSuggestions'> => ({
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
  }
});
