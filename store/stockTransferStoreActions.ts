import { stockTransfersAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { AppState, StoreGet, StoreSet } from './storeTypes';

export const createStockTransferStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'fetchStockTransfers' | 'createStockTransfer'> => ({
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
      await get().fetchInventory();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create stock transfer');
      set({ error: message });
      throw error;
    }
  }
});
