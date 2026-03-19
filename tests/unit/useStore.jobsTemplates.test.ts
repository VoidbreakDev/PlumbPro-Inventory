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
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    pick: vi.fn(),
    delete: vi.fn()
  },
  developmentProjectsApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStage: vi.fn(),
    delete: vi.fn()
  },
  templatesApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
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

const originalFetchJobs = useStore.getState().fetchJobs;
const originalFetchTemplates = useStore.getState().fetchTemplates;
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
    fetchJobs: originalFetchJobs,
    fetchTemplates: originalFetchTemplates,
    fetchInventory: originalFetchInventory,
    fetchMovements: originalFetchMovements
  });
};

describe('useStore job and template actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
  });

  it('updates local job state after create and update', async () => {
    const createdJob = { id: 'job-1', title: 'Leak Repair', status: 'Scheduled' };
    const updatedJob = { id: 'job-1', title: 'Leak Repair', status: 'Completed' };

    jobsApiMock.create.mockResolvedValue(createdJob);
    jobsApiMock.update.mockResolvedValue(updatedJob);

    await useStore.getState().addJob({ title: 'Leak Repair' } as any);
    expect(useStore.getState().jobs).toEqual([createdJob]);

    await useStore.getState().updateJob('job-1', { status: 'Completed' });
    expect(useStore.getState().jobs).toEqual([updatedJob]);
  });

  it('refreshes jobs, inventory, and movements after picking a job', async () => {
    const fetchJobsMock = vi.fn().mockResolvedValue(undefined);
    const fetchInventoryMock = vi.fn().mockResolvedValue(undefined);
    const fetchMovementsMock = vi.fn().mockResolvedValue(undefined);

    jobsApiMock.pick.mockResolvedValue({ success: true });
    useStore.setState({
      fetchJobs: fetchJobsMock,
      fetchInventory: fetchInventoryMock,
      fetchMovements: fetchMovementsMock
    });

    await useStore.getState().pickJob('job-1');

    expect(jobsApiMock.pick).toHaveBeenCalledWith('job-1');
    expect(fetchJobsMock).toHaveBeenCalledTimes(1);
    expect(fetchInventoryMock).toHaveBeenCalledTimes(1);
    expect(fetchMovementsMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes templates after update and removes deleted templates from local state', async () => {
    const fetchTemplatesMock = vi.fn().mockResolvedValue(undefined);
    const createdTemplate = { id: 'template-1', name: 'Standard Repair' };

    templatesApiMock.create.mockResolvedValue(createdTemplate);
    templatesApiMock.update.mockResolvedValue({ success: true });
    templatesApiMock.delete.mockResolvedValue({ success: true });

    useStore.setState({ fetchTemplates: fetchTemplatesMock });

    await useStore.getState().addTemplate({ name: 'Standard Repair' } as any);
    expect(useStore.getState().templates).toEqual([createdTemplate]);

    await useStore.getState().updateTemplate('template-1', { name: 'Updated Template' });
    expect(fetchTemplatesMock).toHaveBeenCalledTimes(1);

    await useStore.getState().deleteTemplate('template-1');
    expect(useStore.getState().templates).toEqual([]);
  });
});
