import type {
  CreateDevelopmentProjectInput,
  DevelopmentProject,
  UpdateDevelopmentProjectInput,
  UpdateDevelopmentStageInput,
  InventoryItem,
  Contact,
  Job,
  JobTemplate,
  Kit,
  StockMovement,
  SmartOrderSuggestion,
  Location,
  StockTransfer
} from '../types';

export interface User {
  id: string;
  email: string;
  fullName: string;
  companyName?: string;
  role: string;
}

export interface AppStateData {
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  inventory: InventoryItem[];
  contacts: Contact[];
  jobs: Job[];
  developmentProjects: DevelopmentProject[];
  templates: JobTemplate[];
  kits: Kit[];
  movements: StockMovement[];
  smartSuggestions: SmartOrderSuggestion[];
  locations: Location[];
  stockTransfers: StockTransfer[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
}

export interface AppState extends AppStateData {
  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, companyName?: string, inviteToken?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;

  // Data Actions
  loadFromStorage: () => Promise<void>;
  syncWithServer: () => Promise<void>;

  // Inventory Actions
  fetchInventory: () => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  adjustStock: (id: string, quantity: number, reason: string) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  deleteAllInventoryItems: () => Promise<void>;

  // Contact Actions
  fetchContacts: () => Promise<void>;
  addContact: (contact: Omit<Contact, 'id'>) => Promise<void>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  // Job Actions
  fetchJobs: () => Promise<void>;
  addJob: (job: Omit<Job, 'id'>) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  pickJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;

  // Development Project Actions
  fetchDevelopmentProjects: () => Promise<void>;
  createDevelopmentProject: (project: CreateDevelopmentProjectInput) => Promise<void>;
  updateDevelopmentProject: (id: string, updates: UpdateDevelopmentProjectInput) => Promise<void>;
  updateDevelopmentStage: (
    projectId: string,
    stageId: string,
    updates: UpdateDevelopmentStageInput
  ) => Promise<void>;
  deleteDevelopmentProject: (id: string) => Promise<void>;

  // Template Actions
  fetchTemplates: () => Promise<void>;
  addTemplate: (template: Omit<JobTemplate, 'id'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<JobTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Movement Actions
  fetchMovements: (filters?: any) => Promise<void>;

  // Smart Ordering Actions
  generateSmartSuggestions: () => Promise<void>;

  // Location Actions
  fetchLocations: () => Promise<void>;
  addLocation: (location: Omit<Location, 'id'>) => Promise<void>;
  updateLocation: (id: string, updates: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;

  // Stock Transfer Actions
  fetchStockTransfers: (filters?: any) => Promise<void>;
  createStockTransfer: (transfer: {
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    reason?: string;
  }) => Promise<void>;

  // Analytics Actions
  recalculateABC: () => Promise<void>;

  // Utility Actions
  setError: (error: string | null) => void;
  clearError: () => void;

  // Local State Setters
  setInventoryState: (items: InventoryItem[]) => void;
  setJobsState: (jobs: Job[]) => void;
  setDevelopmentProjectsState: (projects: DevelopmentProject[]) => void;
  setKitsState: (kits: Kit[]) => void;
  setMovementsState: (movements: StockMovement[]) => void;
}

export type StoreSet = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)
) => void;

export type StoreGet = () => AppState;
