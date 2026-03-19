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

const originalSyncWithServer = useStore.getState().syncWithServer;

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
    syncWithServer: originalSyncWithServer
  });
};

describe('useStore auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
    storageMock.clearAll.mockResolvedValue(undefined);
  });

  it('logs in, persists the session, and triggers a sync', async () => {
    const response = {
      token: 'token-123',
      user: {
        id: 'user-1',
        email: 'tech@example.com',
        fullName: 'Taylor Tech',
        role: 'admin'
      }
    };
    const syncWithServerMock = vi.fn().mockResolvedValue(undefined);

    authApiMock.login.mockResolvedValue(response);
    useStore.setState({ syncWithServer: syncWithServerMock });

    await useStore.getState().login('tech@example.com', 'super-secret');

    expect(authApiMock.login).toHaveBeenCalledWith('tech@example.com', 'super-secret');
    expect(persistAuthSessionMock).toHaveBeenCalledWith(response.token, response.user);
    expect(syncWithServerMock).toHaveBeenCalledTimes(1);
    expect(useStore.getState()).toMatchObject({
      user: response.user,
      authToken: response.token,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  });

  it('registers with an invite token and triggers the initial sync', async () => {
    const response = {
      token: 'token-456',
      user: {
        id: 'user-2',
        email: 'newhire@example.com',
        fullName: 'Nina Newhire',
        companyName: 'Pipe Co',
        role: 'member'
      }
    };
    const syncWithServerMock = vi.fn().mockResolvedValue(undefined);

    authApiMock.register.mockResolvedValue(response);
    useStore.setState({ syncWithServer: syncWithServerMock });

    await useStore.getState().register(
      'newhire@example.com',
      'temp-pass',
      'Nina Newhire',
      'Pipe Co',
      'invite-token-1'
    );

    expect(authApiMock.register).toHaveBeenCalledWith(
      'newhire@example.com',
      'temp-pass',
      'Nina Newhire',
      'Pipe Co',
      'invite-token-1'
    );
    expect(persistAuthSessionMock).toHaveBeenCalledWith(response.token, response.user);
    expect(syncWithServerMock).toHaveBeenCalledTimes(1);
    expect(useStore.getState()).toMatchObject({
      user: response.user,
      authToken: response.token,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  });

  it('clears auth and in-memory store data on logout', () => {
    useStore.setState({
      user: {
        id: 'user-3',
        email: 'owner@example.com',
        fullName: 'Olive Owner',
        role: 'owner'
      },
      isAuthenticated: true,
      authToken: 'token-789',
      inventory: [{ id: 'item-1' }] as any,
      contacts: [{ id: 'contact-1' }] as any,
      jobs: [{ id: 'job-1' }] as any,
      developmentProjects: [{ id: 'project-1' }] as any,
      templates: [{ id: 'template-1' }] as any,
      kits: [{ id: 'kit-1' }] as any,
      movements: [{ id: 'movement-1' }] as any,
      smartSuggestions: [{ id: 'suggestion-1' }] as any,
      locations: [{ id: 'location-1' }] as any,
      stockTransfers: [{ id: 'transfer-1' }] as any,
      isLoading: true,
      isSyncing: true,
      lastSync: 1760000000000,
      error: 'Stale error'
    });

    useStore.getState().logout();

    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(storageMock.clearAll).toHaveBeenCalledTimes(1);
    expect(useStore.getState()).toMatchObject({
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
  });
});
