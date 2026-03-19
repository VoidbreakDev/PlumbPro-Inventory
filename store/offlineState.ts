import type {
  Contact,
  DevelopmentProject,
  InventoryItem,
  Job,
  JobTemplate,
  Kit,
  Location,
  StockMovement
} from '../types';
import { storage } from '../lib/storage';

export interface OfflineStateSnapshot {
  inventory: InventoryItem[];
  contacts: Contact[];
  jobs: Job[];
  developmentProjects: DevelopmentProject[];
  templates: JobTemplate[];
  kits: Kit[];
  movements: StockMovement[];
  locations: Location[];
  lastSync: number | null;
}

export const normalizeOfflineStateSnapshot = (
  snapshot: Omit<OfflineStateSnapshot, 'kits'> & { kits: Kit[] }
): OfflineStateSnapshot => ({
  ...snapshot,
  kits: snapshot.kits
});

export const loadOfflineStateSnapshot = async (): Promise<OfflineStateSnapshot> => {
  const [inventory, contacts, jobs, developmentProjects, templates, kits, movements, locations, lastSync] = await Promise.all([
    storage.getInventory(),
    storage.getContacts(),
    storage.getJobs(),
    storage.getDevelopmentProjects(),
    storage.getTemplates(),
    storage.getKits(),
    storage.getMovements(),
    storage.getLocations(),
    storage.getLastSync()
  ]);

  return normalizeOfflineStateSnapshot({
    inventory,
    contacts,
    jobs,
    developmentProjects,
    templates,
    kits,
    movements,
    locations,
    lastSync
  });
};

export const persistOfflineStateSnapshot = async (snapshot: OfflineStateSnapshot): Promise<void> => {
  const operations: Promise<unknown>[] = [
    storage.setInventory(snapshot.inventory),
    storage.setContacts(snapshot.contacts),
    storage.setJobs(snapshot.jobs),
    storage.setDevelopmentProjects(snapshot.developmentProjects),
    storage.setTemplates(snapshot.templates),
    storage.setKits(snapshot.kits),
    storage.setMovements(snapshot.movements),
    storage.setLocations(snapshot.locations)
  ];

  if (snapshot.lastSync !== null) {
    operations.push(storage.setLastSync(snapshot.lastSync));
  }

  await Promise.all(operations);
};
