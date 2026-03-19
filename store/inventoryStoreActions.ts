import { inventoryAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createInventoryStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<
  AppState,
  | 'fetchInventory'
  | 'addInventoryItem'
  | 'updateInventoryItem'
  | 'adjustStock'
  | 'deleteInventoryItem'
  | 'deleteAllInventoryItems'
> => ({
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
  }
});
