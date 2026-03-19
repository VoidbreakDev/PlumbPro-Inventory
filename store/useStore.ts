import { create } from 'zustand';
import { createAnalyticsStoreActions } from './analyticsStoreActions';
import { createAuthStoreActions } from './authStoreActions';
import { createContactStoreActions } from './contactStoreActions';
import { createDevelopmentStoreActions } from './developmentStoreActions';
import { initialAppState } from './initialState';
import { createInventoryStoreActions } from './inventoryStoreActions';
import { createJobStoreActions } from './jobStoreActions';
import { createLocationStoreActions } from './locationStoreActions';
import { createMovementStoreActions } from './movementStoreActions';
import { createSyncStoreActions } from './syncStoreActions';
import { createSmartOrderingStoreActions } from './smartOrderingStoreActions';
import { createStockTransferStoreActions } from './stockTransferStoreActions';
import { createTemplateStoreActions } from './templateStoreActions';
import type { AppState } from './storeTypes';
import { createUtilityStoreActions } from './utilityStoreActions';

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  ...initialAppState,
  ...createAuthStoreActions(set, get),
  ...createSyncStoreActions(set, get),
  ...createInventoryStoreActions(set, get),
  ...createContactStoreActions(set),
  ...createJobStoreActions(set, get),
  ...createDevelopmentStoreActions(set, get),
  ...createTemplateStoreActions(set, get),
  ...createMovementStoreActions(set),
  ...createSmartOrderingStoreActions(set),
  ...createLocationStoreActions(set),
  ...createStockTransferStoreActions(set, get),
  ...createAnalyticsStoreActions(set, get),
  ...createUtilityStoreActions(set)
}));

export default useStore;
