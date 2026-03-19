import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authApiMock,
  inventoryApiMock,
  contactsApiMock,
  jobsApiMock,
  developmentProjectsApiMock,
  templatesApiMock,
  movementsApiMock,
  smartOrderingApiMock,
  locationsApiMock,
  stockTransfersApiMock,
  analyticsApiMock,
  storageMock,
  persistAuthSessionMock,
  clearAuthSessionMock,
  logSyncFailureMock
} = vi.hoisted(() => ({
  authApiMock: {
    login: vi.fn(),
    register: vi.fn()
  },
  inventoryApiMock: {
    getAll: vi.fn()
  },
  contactsApiMock: {
    getAll: vi.fn()
  },
  jobsApiMock: {
    getAll: vi.fn()
  },
  developmentProjectsApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStage: vi.fn(),
    delete: vi.fn()
  },
  templatesApiMock: {
    getAll: vi.fn()
  },
  movementsApiMock: {
    getAll: vi.fn()
  },
  smartOrderingApiMock: {
    getSuggestions: vi.fn()
  },
  locationsApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  stockTransfersApiMock: {
    getAll: vi.fn(),
    create: vi.fn()
  },
  analyticsApiMock: {
    recalculateABC: vi.fn()
  },
  storageMock: {
    getInventory: vi.fn(),
    setInventory: vi.fn(),
    getContacts: vi.fn(),
    setContacts: vi.fn(),
    getJobs: vi.fn(),
    setJobs: vi.fn(),
    getDevelopmentProjects: vi.fn(),
    setDevelopmentProjects: vi.fn(),
    getTemplates: vi.fn(),
    setTemplates: vi.fn(),
    getKits: vi.fn(),
    setKits: vi.fn(),
    getMovements: vi.fn(),
    setMovements: vi.fn(),
    getLocations: vi.fn(),
    setLocations: vi.fn(),
    getLastSync: vi.fn(),
    setLastSync: vi.fn(),
    clearAll: vi.fn()
  },
  persistAuthSessionMock: vi.fn(),
  clearAuthSessionMock: vi.fn(),
  logSyncFailureMock: vi.fn()
}));

vi.mock('../../lib/api', () => ({
  authAPI: authApiMock,
  inventoryAPI: inventoryApiMock,
  contactsAPI: contactsApiMock,
  jobsAPI: jobsApiMock,
  developmentProjectsAPI: developmentProjectsApiMock,
  templatesAPI: templatesApiMock,
  movementsAPI: movementsApiMock,
  smartOrderingAPI: smartOrderingApiMock,
  locationsAPI: locationsApiMock,
  stockTransfersAPI: stockTransfersApiMock,
  analyticsAPI: analyticsApiMock
}));

vi.mock('../../lib/storage', () => ({
  storage: storageMock
}));

vi.mock('../../lib/authSession', () => ({
  persistAuthSession: persistAuthSessionMock,
  clearAuthSession: clearAuthSessionMock
}));

vi.mock('../../lib/logging', () => ({
  logSyncFailure: logSyncFailureMock
}));

import { useStore } from '../../store/useStore';

const originalFetchInventory = useStore.getState().fetchInventory;

const resetStoreState = () => {
  useStore.setState({
    user: null,
    isAuthenticated: false,
    authToken: null,
    inventory: [],
    contacts: [],
    jobs: [],
    developmentProjects: [],
    templates: [],
    kits: [],
    movements: [],
    smartSuggestions: [],
    locations: [],
    stockTransfers: [],
    isLoading: false,
    isSyncing: false,
    lastSync: null,
    error: null,
    fetchInventory: originalFetchInventory
  });
};

describe('useStore location and transfer actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
  });

  it('keeps location CRUD operations local-state driven', async () => {
    const createdLocation = { id: 'loc-1', name: 'Main Warehouse' };
    const updatedLocation = { id: 'loc-1', name: 'Van Stock' };

    locationsApiMock.create.mockResolvedValue(createdLocation);
    locationsApiMock.update.mockResolvedValue(updatedLocation);
    locationsApiMock.delete.mockResolvedValue({ success: true });

    await useStore.getState().addLocation({ name: 'Main Warehouse' } as any);
    expect(useStore.getState().locations).toEqual([createdLocation]);

    await useStore.getState().updateLocation('loc-1', { name: 'Van Stock' });
    expect(useStore.getState().locations).toEqual([updatedLocation]);

    await useStore.getState().deleteLocation('loc-1');
    expect(useStore.getState().locations).toEqual([]);
  });

  it('refreshes inventory after creating a stock transfer', async () => {
    const fetchInventoryMock = vi.fn().mockResolvedValue(undefined);
    const transfer = { id: 'transfer-1', itemId: 'item-1', quantity: 2 };

    stockTransfersApiMock.create.mockResolvedValue(transfer);
    useStore.setState({ fetchInventory: fetchInventoryMock });

    await useStore.getState().createStockTransfer({
      itemId: 'item-1',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      quantity: 2
    });

    expect(stockTransfersApiMock.create).toHaveBeenCalledWith({
      itemId: 'item-1',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      quantity: 2
    });
    expect(useStore.getState().stockTransfers).toEqual([transfer]);
    expect(fetchInventoryMock).toHaveBeenCalledTimes(1);
  });
});
