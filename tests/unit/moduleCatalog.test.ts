import { describe, expect, it } from 'vitest';

import { MODULE_CATALOG } from '../../app/moduleCatalog';

describe('module catalog', () => {
  it('tracks the surfaced advanced modules explicitly', () => {
    const mainModules = MODULE_CATALOG.filter((entry) => entry.surface === 'main');
    const advancedModules = MODULE_CATALOG.filter((entry) => entry.surface === 'advanced');

    expect(mainModules.map((entry) => entry.id)).toContain('project-stages');

    expect(advancedModules.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['van-stock', 'sync-dashboard', 'developer'])
    );
  });

  it('keeps the customer portal external and franchise deferred', () => {
    const portal = MODULE_CATALOG.find((entry) => entry.id === 'customer-portal');
    const franchise = MODULE_CATALOG.find((entry) => entry.id === 'franchise');

    expect(portal).toMatchObject({
      surface: 'external',
      route: '/portal/*',
      status: 'active'
    });

    expect(franchise).toMatchObject({
      surface: 'deferred',
      status: 'deferred'
    });
  });
});
