import { describe, expect, it } from 'vitest';

import {
  buildManualItemAdjustments,
  buildStageStockPlan,
  DEFAULT_DEVELOPMENT_HOUSE_PROFILE,
  DEVELOPMENT_STAGE_LIBRARY
} from '../../lib/projectStages';

describe('project stages helpers', () => {
  it('keeps the fixed plumbing stage library in the expected order', () => {
    expect(DEVELOPMENT_STAGE_LIBRARY).toEqual([
      'Drain Underfloor',
      'Stormwater',
      'First Fix',
      'Chrome Off/Final Fix',
      'Bath Installs',
      'Hot Water Service Installs',
      'Rainwater Tanks',
      'Sump Tanks + Accessories'
    ]);
  });

  it('applies kit variations, house-profile modifiers, and manual overrides to resolved stock', () => {
    const project = {
      houseProfile: {
        ...DEFAULT_DEVELOPMENT_HOUSE_PROFILE,
        storeys: 2,
        bathroomCount: 3,
        kitchenConfig: 'large' as const,
        hasButlersPantry: true,
        customOptions: ['outdoor kitchen']
      }
    };

    const kits = [
      {
        id: 'kit-1',
        name: 'First Fix Kit',
        items: [
          {
            id: 'kit-item-1',
            itemType: 'inventory',
            inventoryItemId: 'pipe-100',
            itemName: 'PVC Pipe',
            quantity: 10
          },
          {
            id: 'kit-item-2',
            itemType: 'inventory',
            inventoryItemId: 'clamp-10',
            itemName: 'Pipe Clamp',
            quantity: 4
          }
        ],
        variations: [
          {
            id: 'var-premium',
            name: 'Premium',
            costMultiplier: 1.15,
            additionalItems: [
              {
                id: 'kit-item-3',
                itemType: 'inventory',
                inventoryItemId: 'valve-1',
                itemName: 'Isolation Valve',
                quantity: 1
              }
            ]
          }
        ]
      }
    ] as any;

    const stage = {
      stageType: 'First Fix' as const,
      baseKitId: 'kit-1',
      variationId: 'var-premium',
      manualItemAdjustments: [
        { itemId: 'pipe-100', itemName: 'PVC Pipe', quantity: 20 },
        { itemId: 'clamp-10', itemName: 'Pipe Clamp', quantity: 0 }
      ]
    };

    const result = buildStageStockPlan(project as any, stage as any, kits);

    expect(result.baseKitName).toBe('First Fix Kit');
    expect(result.variationName).toBe('Premium');
    expect(result.modifierSnapshot?.finalMultiplier).toBeGreaterThan(1.15);
    expect(result.resolvedAllocatedItems).toEqual([
      { itemId: 'valve-1', itemName: 'Isolation Valve', quantity: 2 },
      { itemId: 'pipe-100', itemName: 'PVC Pipe', quantity: 20 }
    ]);
  });

  it('captures manual edits as delta adjustments against generated stock', () => {
    const adjustments = buildManualItemAdjustments(
      [
        { itemId: 'a', itemName: 'Item A', quantity: 2 },
        { itemId: 'b', itemName: 'Item B', quantity: 5 }
      ],
      [
        { itemId: 'a', itemName: 'Item A', quantity: 4 },
        { itemId: 'c', itemName: 'Item C', quantity: 1 }
      ]
    );

    expect(adjustments).toEqual([
      { itemId: 'a', itemName: 'Item A', quantity: 4 },
      { itemId: 'b', itemName: 'Item B', quantity: 0 },
      { itemId: 'c', itemName: 'Item C', quantity: 1 }
    ]);
  });
});
