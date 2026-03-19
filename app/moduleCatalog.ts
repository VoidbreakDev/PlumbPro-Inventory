export type ModuleSurface = 'main' | 'advanced' | 'embedded' | 'external' | 'deferred';

export interface ModuleCatalogEntry {
  id: string;
  label: string;
  surface: ModuleSurface;
  status: 'active' | 'beta' | 'deferred';
  route?: string;
  roles?: string[];
  notes: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    id: 'dashboard-overview',
    label: 'Dashboard Overview',
    surface: 'main',
    status: 'active',
    route: 'dashboard',
    notes: 'Primary operational landing view for stock alerts and scheduled work.'
  },
  {
    id: 'dashboard-analytics',
    label: 'Dashboard Analytics',
    surface: 'embedded',
    status: 'active',
    route: 'dashboard',
    notes: 'Surfaced inside the dashboard via the Analytics mode switch rather than as a separate top-level tab.'
  },
  {
    id: 'project-stages',
    label: 'Project Stages',
    surface: 'main',
    status: 'active',
    route: 'project-stages',
    notes: 'Tracks house-development projects, their plumbing stages, and the linked operational jobs that are scheduled from each stage.'
  },
  {
    id: 'van-stock',
    label: 'Van Stock',
    surface: 'advanced',
    status: 'beta',
    route: 'van-stock',
    notes: 'Now available from the Advanced group for operational teams managing service vehicle inventory.'
  },
  {
    id: 'sync-dashboard',
    label: 'Sync Dashboard',
    surface: 'advanced',
    status: 'active',
    route: 'sync-dashboard',
    notes: 'Available from the Advanced group for offline queue visibility and sync recovery.'
  },
  {
    id: 'developer',
    label: 'Developer',
    surface: 'advanced',
    status: 'beta',
    route: 'developer',
    roles: ['admin', 'owner'],
    notes: 'Available only to admin and owner roles because it exposes API keys, webhooks, and integration tooling.'
  },
  {
    id: 'customer-portal',
    label: 'Customer Portal',
    surface: 'external',
    status: 'active',
    route: '/portal/*',
    notes: 'Intentionally runs outside the staff shell as a customer-facing route with its own authentication flow.'
  },
  {
    id: 'franchise',
    label: 'Franchise',
    surface: 'deferred',
    status: 'deferred',
    notes: 'Deferred from the main shell until role gating, readiness criteria, and user journeys are defined more clearly.'
  }
];

export const MODULE_SURFACE_LABELS: Record<ModuleSurface, string> = {
  main: 'Main Shell',
  advanced: 'Advanced',
  embedded: 'Embedded',
  external: 'External Route',
  deferred: 'Deferred'
};

export const MODULE_STATUS_LABELS: Record<ModuleCatalogEntry['status'], string> = {
  active: 'Active',
  beta: 'Beta',
  deferred: 'Deferred'
};
