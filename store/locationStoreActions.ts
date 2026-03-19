import { locationsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreSet } from './storeTypes';

export const createLocationStoreActions = (
  set: StoreSet
): Pick<AppState, 'fetchLocations' | 'addLocation' | 'updateLocation' | 'deleteLocation'> => ({
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
  }
});
