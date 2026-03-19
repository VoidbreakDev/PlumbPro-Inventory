import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authApiMock,
  inventoryApiMock,
  contactsApiMock,
  jobsApiMock,
  developmentProjectsApiMock,
  templatesApiMock,
  kitApiMock,
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
  kitApiMock: {
    getKits: vi.fn()
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
  analyticsAPI: analyticsApiMock,
  movementsAPI: movementsApiMock,
  smartOrderingAPI: smartOrderingApiMock,
  locationsAPI: locationsApiMock,
  stockTransfersAPI: stockTransfersApiMock
}));

vi.mock('../../lib/kitAPI', () => ({
  kitAPI: kitApiMock
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
    error: null
  });
};

describe('useStore syncWithServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();

    storageMock.setInventory.mockResolvedValue(undefined);
    storageMock.setContacts.mockResolvedValue(undefined);
    storageMock.setJobs.mockResolvedValue(undefined);
    storageMock.setDevelopmentProjects.mockResolvedValue(undefined);
    storageMock.setTemplates.mockResolvedValue(undefined);
    storageMock.setKits.mockResolvedValue(undefined);
    storageMock.setMovements.mockResolvedValue(undefined);
    storageMock.setLocations.mockResolvedValue(undefined);
    storageMock.setLastSync.mockResolvedValue(undefined);
  });

  it('hydrates state from the server and persists locations for offline use', async () => {
    const timestamp = 1760000000000;
    vi.spyOn(Date, 'now').mockReturnValue(timestamp);

    const inventory = [{ id: 'item-1', name: 'Pipe', quantity: 8 }];
    const contacts = [{ id: 'contact-1', name: 'Acme Plumbing' }];
    const jobs = [{ id: 'job-1', title: 'Leak Repair' }];
    const developmentProjects = [{ id: 'project-1', title: 'Lot 12', stages: [] }];
    const templates = [{ id: 'template-1', name: 'Standard Repair' }];
    const kits = [{ id: 'kit-1', name: 'Hot Water Install', items: [] }];
    const movements = [{ id: 'move-1', itemId: 'item-1', quantity: -2 }];
    const locations = [{ id: 'loc-1', name: 'Main Warehouse' }];

    inventoryApiMock.getAll.mockResolvedValue(inventory);
    contactsApiMock.getAll.mockResolvedValue(contacts);
    jobsApiMock.getAll.mockResolvedValue(jobs);
    developmentProjectsApiMock.getAll.mockResolvedValue(developmentProjects);
    templatesApiMock.getAll.mockResolvedValue(templates);
    kitApiMock.getKits.mockResolvedValue({ kits });
    movementsApiMock.getAll.mockResolvedValue(movements);
    locationsApiMock.getAll.mockResolvedValue(locations);

    await useStore.getState().syncWithServer();

    expect(useStore.getState()).toMatchObject({
      inventory,
      contacts,
      jobs,
      developmentProjects,
      templates,
      kits,
      movements,
      locations,
      lastSync: timestamp,
      isSyncing: false,
      error: null
    });

    expect(storageMock.setInventory).toHaveBeenCalledWith(inventory);
    expect(storageMock.setContacts).toHaveBeenCalledWith(contacts);
    expect(storageMock.setJobs).toHaveBeenCalledWith(jobs);
    expect(storageMock.setDevelopmentProjects).toHaveBeenCalledWith(developmentProjects);
    expect(storageMock.setTemplates).toHaveBeenCalledWith(templates);
    expect(storageMock.setKits).toHaveBeenCalledWith(kits);
    expect(storageMock.setMovements).toHaveBeenCalledWith(movements);
    expect(storageMock.setLocations).toHaveBeenCalledWith(locations);
    expect(storageMock.setLastSync).toHaveBeenCalledWith(timestamp);
  });

  it('falls back to cached storage data and keeps the sync error when the server fails', async () => {
    const syncError = {
      response: {
        data: {
          error: 'Backend unavailable'
        }
      }
    };
    const cachedInventory = [{ id: 'item-offline', name: 'Valve', quantity: 4 }];
    const cachedContacts = [{ id: 'contact-offline', name: 'Offline Customer' }];
    const cachedJobs = [{ id: 'job-offline', title: 'Emergency Callout' }];
    const cachedDevelopmentProjects = [{ id: 'project-offline', title: 'Offline Build', stages: [] }];
    const cachedTemplates = [{ id: 'template-offline', name: 'Offline Template' }];
    const cachedKits = [{ id: 'kit-offline', name: 'Offline Kit', items: [] }];
    const cachedMovements = [{ id: 'move-offline', itemId: 'item-offline', quantity: 1 }];
    const cachedLocations = [{ id: 'loc-offline', name: 'Van Stock' }];
    const cachedLastSync = 1750000000000;

    inventoryApiMock.getAll.mockRejectedValue(syncError);
    contactsApiMock.getAll.mockResolvedValue([]);
    jobsApiMock.getAll.mockResolvedValue([]);
    developmentProjectsApiMock.getAll.mockResolvedValue([]);
    templatesApiMock.getAll.mockResolvedValue([]);
    kitApiMock.getKits.mockResolvedValue({ kits: [] });
    movementsApiMock.getAll.mockResolvedValue([]);
    locationsApiMock.getAll.mockResolvedValue([]);

    storageMock.getInventory.mockResolvedValue(cachedInventory);
    storageMock.getContacts.mockResolvedValue(cachedContacts);
    storageMock.getJobs.mockResolvedValue(cachedJobs);
    storageMock.getDevelopmentProjects.mockResolvedValue(cachedDevelopmentProjects);
    storageMock.getTemplates.mockResolvedValue(cachedTemplates);
    storageMock.getKits.mockResolvedValue(cachedKits);
    storageMock.getMovements.mockResolvedValue(cachedMovements);
    storageMock.getLocations.mockResolvedValue(cachedLocations);
    storageMock.getLastSync.mockResolvedValue(cachedLastSync);

    await useStore.getState().syncWithServer();

    expect(logSyncFailureMock).toHaveBeenCalledWith(syncError, {
      message: 'Backend unavailable'
    });

    expect(useStore.getState()).toMatchObject({
      inventory: cachedInventory,
      contacts: cachedContacts,
      jobs: cachedJobs,
      developmentProjects: cachedDevelopmentProjects,
      templates: cachedTemplates,
      kits: cachedKits,
      movements: cachedMovements,
      locations: cachedLocations,
      lastSync: cachedLastSync,
      isSyncing: false,
      error: 'Backend unavailable'
    });

    expect(storageMock.setInventory).not.toHaveBeenCalled();
    expect(storageMock.setLocations).not.toHaveBeenCalled();
  });
});
