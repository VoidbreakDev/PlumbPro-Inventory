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
    getAll: vi.fn()
  },
  stockTransfersApiMock: {
    getAll: vi.fn()
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

describe('useStore smart ordering and analytics actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
    storageMock.setKits.mockResolvedValue(undefined);
  });

  it('stores smart ordering suggestions and clears loading state', async () => {
    const suggestions = [{ itemId: 'item-1', suggestedQuantity: 5 }];

    smartOrderingApiMock.getSuggestions.mockResolvedValue({ suggestions });

    await useStore.getState().generateSmartSuggestions();

    expect(useStore.getState()).toMatchObject({
      smartSuggestions: suggestions,
      isLoading: false,
      error: null
    });
  });

  it('refreshes inventory after recalculating analytics classifications', async () => {
    const fetchInventoryMock = vi.fn().mockResolvedValue(undefined);

    analyticsApiMock.recalculateABC.mockResolvedValue({ success: true });
    useStore.setState({ fetchInventory: fetchInventoryMock });

    await useStore.getState().recalculateABC();

    expect(analyticsApiMock.recalculateABC).toHaveBeenCalledTimes(1);
    expect(fetchInventoryMock).toHaveBeenCalledTimes(1);
    expect(useStore.getState().isLoading).toBe(false);
  });

  it('persists kits when the local state setter is used', async () => {
    const kits = [{ id: 'kit-1', name: 'Starter Kit', items: [] }];

    useStore.getState().setKitsState(kits as any);

    expect(storageMock.setKits).toHaveBeenCalledWith(kits);
    expect(useStore.getState().kits).toEqual(kits);
  });
});
