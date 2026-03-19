import type { AppStateData } from './storeTypes';

export const initialAppState: AppStateData = {
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
};
