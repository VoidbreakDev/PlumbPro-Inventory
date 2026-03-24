/**
 * Shared constants for Team Management sub-components.
 */

export const roleLabels: Record<string, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Full access to all features and settings'
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-800',
    description: 'Full access except billing and team settings'
  },
  manager: {
    label: 'Manager',
    color: 'bg-blue-100 text-blue-800',
    description: 'Can manage jobs, quotes, invoices and team members'
  },
  member: {
    label: 'Member',
    color: 'bg-green-100 text-green-800',
    description: 'Can create and edit jobs, quotes, and inventory'
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-800',
    description: 'Read-only access to all data'
  }
};

export const roleLevelColors: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',      // Apprentice
  1: 'bg-green-100 text-green-700',    // Technician
  2: 'bg-blue-100 text-blue-700',      // Senior Tech
  3: 'bg-purple-100 text-purple-700',  // Supervisor
  4: 'bg-orange-100 text-orange-700',  // Manager
  5: 'bg-yellow-100 text-yellow-700',  // Owner
};
