import { describe, expect, it } from 'vitest';

import {
  getNavigationLabel,
  getVisibleNavigationConfig,
  isTabVisible
} from '../../components/Navigation';

const getVisibleTabIds = (role?: string | null) => {
  return getVisibleNavigationConfig(role).flatMap((item) =>
    'children' in item ? item.children.map((child) => child.id) : [item.id]
  );
};

describe('navigation visibility', () => {
  it('surfaces operational advanced modules to standard users', () => {
    const tabIds = getVisibleTabIds('user');

    expect(tabIds).toContain('van-stock');
    expect(tabIds).toContain('sync-dashboard');
    expect(tabIds).toContain('project-stages');
    expect(tabIds).not.toContain('developer');
  });

  it('shows developer tooling to admins only', () => {
    expect(isTabVisible('developer', 'admin')).toBe(true);
    expect(isTabVisible('developer', 'owner')).toBe(true);
    expect(isTabVisible('developer', 'manager')).toBe(false);
  });

  it('returns configured labels for surfaced advanced modules', () => {
    expect(getNavigationLabel('van-stock')).toBe('Van Stock');
    expect(getNavigationLabel('sync-dashboard')).toBe('Sync Dashboard');
    expect(getNavigationLabel('project-stages')).toBe('Project Stages');
    expect(getNavigationLabel('developer')).toBe('Developer');
  });
});
