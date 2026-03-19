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
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    adjust: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn()
  },
  contactsApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
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
const originalFetchMovements = useStore.getState().fetchMovements;

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
    fetchInventory: originalFetchInventory,
    fetchMovements: originalFetchMovements
  });
};

describe('useStore inventory and contact actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
  });

  it('loads inventory and clears the loading state', async () => {
    const inventory = [{ id: 'item-1', name: 'Pipe', quantity: 12 }];

    inventoryApiMock.getAll.mockResolvedValue(inventory);

    await useStore.getState().fetchInventory();

    expect(inventoryApiMock.getAll).toHaveBeenCalledTimes(1);
    expect(useStore.getState()).toMatchObject({
      inventory,
      isLoading: false,
      error: null
    });
  });

  it('adjusts stock and refreshes dependent inventory and movement data', async () => {
    const fetchInventoryMock = vi.fn().mockResolvedValue(undefined);
    const fetchMovementsMock = vi.fn().mockResolvedValue(undefined);

    inventoryApiMock.adjust.mockResolvedValue({ success: true });
    useStore.setState({
      fetchInventory: fetchInventoryMock,
      fetchMovements: fetchMovementsMock
    });

    await useStore.getState().adjustStock('item-1', 3, 'Restock');

    expect(inventoryApiMock.adjust).toHaveBeenCalledWith('item-1', 3, 'Restock');
    expect(fetchInventoryMock).toHaveBeenCalledTimes(1);
    expect(fetchMovementsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps contact CRUD operations local-state driven', async () => {
    const addedContact = { id: 'contact-2', name: 'Fresh Contact', email: 'fresh@example.com' };
    const updatedContact = { id: 'contact-2', name: 'Updated Contact', email: 'fresh@example.com' };

    contactsApiMock.create.mockResolvedValue(addedContact);
    contactsApiMock.update.mockResolvedValue(updatedContact);
    contactsApiMock.delete.mockResolvedValue({ success: true });

    await useStore.getState().addContact({ name: 'Fresh Contact', email: 'fresh@example.com' } as any);
    expect(useStore.getState().contacts).toEqual([addedContact]);

    await useStore.getState().updateContact('contact-2', { name: 'Updated Contact' });
    expect(useStore.getState().contacts).toEqual([updatedContact]);

    await useStore.getState().deleteContact('contact-2');
    expect(useStore.getState().contacts).toEqual([]);
  });
});
