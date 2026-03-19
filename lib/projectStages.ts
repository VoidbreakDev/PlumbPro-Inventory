import type {
  AllocatedItem,
  DevelopmentHouseProfile,
  DevelopmentProject,
  DevelopmentStage,
  DevelopmentStageManualItemAdjustment,
  DevelopmentStageStatus,
  DevelopmentStageType,
  KitchenConfig,
  Kit,
  KitItem,
  KitVariation,
  StageModifierContribution,
  StageStockModifierSnapshot
} from '../types';

export const DEVELOPMENT_STAGE_LIBRARY: readonly DevelopmentStageType[] = [
  'Drain Underfloor',
  'Stormwater',
  'First Fix',
  'Chrome Off/Final Fix',
  'Bath Installs',
  'Hot Water Service Installs',
  'Rainwater Tanks',
  'Sump Tanks + Accessories'
] as const;

export const DEFAULT_DEVELOPMENT_HOUSE_PROFILE: DevelopmentHouseProfile = {
  storeys: 1,
  bathroomCount: 1,
  kitchenConfig: 'standard',
  hasButlersPantry: false,
  customOptions: []
};

const KITCHEN_CONFIG_MULTIPLIERS: Record<KitchenConfig, number> = {
  standard: 0,
  galley: 0.04,
  large: 0.08,
  custom: 0.1
};

const STAGE_MODIFIER_WEIGHTS: Record<
  DevelopmentStageType,
  { storeys: number; bathrooms: number; kitchen: number; pantry: number; custom: number }
> = {
  'Drain Underfloor': { storeys: 0.2, bathrooms: 0.08, kitchen: 0.04, pantry: 0.03, custom: 0.02 },
  Stormwater: { storeys: 0.16, bathrooms: 0.03, kitchen: 0.02, pantry: 0.02, custom: 0.03 },
  'First Fix': { storeys: 0.24, bathrooms: 0.18, kitchen: 0.1, pantry: 0.08, custom: 0.04 },
  'Chrome Off/Final Fix': { storeys: 0.12, bathrooms: 0.22, kitchen: 0.14, pantry: 0.08, custom: 0.05 },
  'Bath Installs': { storeys: 0.04, bathrooms: 0.35, kitchen: 0, pantry: 0, custom: 0.03 },
  'Hot Water Service Installs': { storeys: 0.1, bathrooms: 0.15, kitchen: 0.03, pantry: 0.02, custom: 0.03 },
  'Rainwater Tanks': { storeys: 0.06, bathrooms: 0.02, kitchen: 0.02, pantry: 0.02, custom: 0.02 },
  'Sump Tanks + Accessories': { storeys: 0.08, bathrooms: 0.02, kitchen: 0.02, pantry: 0.02, custom: 0.05 }
};

export const DEVELOPMENT_STAGE_STATUS_LABELS: Record<DevelopmentStageStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
  blocked: 'Blocked'
};

const roundTo = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const getVariationMatchKey = (item: Pick<KitItem, 'id' | 'inventoryItemId' | 'itemName'>) => {
  return item.inventoryItemId || item.id || item.itemName;
};

const mergeKitVariation = (items: KitItem[], variation?: KitVariation) => {
  if (!variation) {
    return items;
  }

  const excluded = new Set(variation.excludedItemIds || []);
  let resolvedItems = items.filter((item) => !excluded.has(item.id));

  if (variation.itemOverrides && variation.itemOverrides.length > 0) {
    const overrides = new Map(
      variation.itemOverrides.map((item) => [getVariationMatchKey(item), item])
    );

    resolvedItems = resolvedItems.map((item) => {
      const override = overrides.get(getVariationMatchKey(item));
      return override ? { ...item, ...override } : item;
    });
  }

  if (variation.additionalItems && variation.additionalItems.length > 0) {
    resolvedItems = [...resolvedItems, ...variation.additionalItems];
  }

  return resolvedItems;
};

const buildModifierContributions = (
  stageType: DevelopmentStageType,
  houseProfile: DevelopmentHouseProfile
) => {
  const weights = STAGE_MODIFIER_WEIGHTS[stageType];
  const contributions: StageModifierContribution[] = [];

  if (houseProfile.storeys > 1) {
    contributions.push({
      key: 'storeys',
      label: 'Additional storeys',
      amount: roundTo((houseProfile.storeys - 1) * weights.storeys)
    });
  }

  if (houseProfile.bathroomCount > 1) {
    contributions.push({
      key: 'bathrooms',
      label: 'Additional bathrooms',
      amount: roundTo((houseProfile.bathroomCount - 1) * weights.bathrooms)
    });
  }

  const kitchenAmount = roundTo(KITCHEN_CONFIG_MULTIPLIERS[houseProfile.kitchenConfig] * weights.kitchen);
  if (kitchenAmount > 0) {
    contributions.push({
      key: 'kitchen',
      label: `Kitchen config (${houseProfile.kitchenConfig})`,
      amount: kitchenAmount
    });
  }

  if (houseProfile.hasButlersPantry) {
    contributions.push({
      key: 'butlers_pantry',
      label: 'Butler\'s pantry',
      amount: roundTo(weights.pantry)
    });
  }

  if (houseProfile.customOptions.length > 0) {
    contributions.push({
      key: 'custom_options',
      label: 'Custom options',
      amount: roundTo(houseProfile.customOptions.length * weights.custom)
    });
  }

  return contributions.filter((entry) => entry.amount !== 0);
};

export const buildManualItemAdjustments = (
  baseItems: AllocatedItem[],
  editedItems: AllocatedItem[]
): DevelopmentStageManualItemAdjustment[] => {
  const baseMap = new Map(baseItems.map((item) => [item.itemId, item]));
  const editedMap = new Map(editedItems.map((item) => [item.itemId, item]));
  const adjustments: DevelopmentStageManualItemAdjustment[] = [];

  editedMap.forEach((item, itemId) => {
    const baseItem = baseMap.get(itemId);
    if (!baseItem || baseItem.quantity !== item.quantity) {
      adjustments.push({
        itemId,
        itemName: item.itemName || baseItem?.itemName,
        quantity: item.quantity
      });
    }
  });

  baseMap.forEach((item, itemId) => {
    if (!editedMap.has(itemId)) {
      adjustments.push({
        itemId,
        itemName: item.itemName,
        quantity: 0
      });
    }
  });

  return adjustments.sort((left, right) => left.itemId.localeCompare(right.itemId));
};

const applyManualAdjustments = (
  baseItems: AllocatedItem[],
  adjustments: DevelopmentStageManualItemAdjustment[] = []
) => {
  const adjusted = new Map(baseItems.map((item) => [item.itemId, { ...item }]));

  adjustments.forEach((adjustment) => {
    if (adjustment.quantity <= 0) {
      adjusted.delete(adjustment.itemId);
      return;
    }

    const existing = adjusted.get(adjustment.itemId);
    adjusted.set(adjustment.itemId, {
      itemId: adjustment.itemId,
      itemName: adjustment.itemName || existing?.itemName,
      quantity: adjustment.quantity
    });
  });

  return Array.from(adjusted.values()).sort((left, right) =>
    (left.itemName || left.itemId).localeCompare(right.itemName || right.itemId)
  );
};

export const buildStageStockPlan = (
  project: Pick<DevelopmentProject, 'houseProfile'>,
  stage: Pick<
    DevelopmentStage,
    'stageType' | 'baseKitId' | 'variationId' | 'manualItemAdjustments'
  >,
  kits: Kit[]
): {
  baseKitName?: string;
  variationName?: string;
  modifierSnapshot?: StageStockModifierSnapshot;
  resolvedAllocatedItems: AllocatedItem[];
} => {
  const baseKit = kits.find((kit) => kit.id === stage.baseKitId);
  if (!baseKit) {
    return {
      resolvedAllocatedItems: []
    };
  }

  const selectedVariation = baseKit.variations?.find((variation) => variation.id === stage.variationId);
  const contributions = buildModifierContributions(stage.stageType, project.houseProfile);
  const quantityMultiplier = roundTo(
    1 + contributions.reduce((total, entry) => total + entry.amount, 0)
  );
  const variationMultiplier = roundTo(selectedVariation?.costMultiplier ?? 1);
  const finalMultiplier = roundTo(quantityMultiplier * variationMultiplier);

  const resolvedInventoryItems = mergeKitVariation(baseKit.items, selectedVariation)
    .filter((item) => item.itemType === 'inventory' && item.inventoryItemId)
    .map((item) => ({
      itemId: item.inventoryItemId!,
      itemName: item.itemName,
      quantity: Math.max(1, Math.ceil(item.quantity * finalMultiplier))
    }));

  return {
    baseKitName: baseKit.name,
    variationName: selectedVariation?.name,
    modifierSnapshot: {
      quantityMultiplier,
      variationMultiplier,
      finalMultiplier,
      contributions,
      generatedAt: new Date().toISOString(),
      houseProfile: project.houseProfile
    },
    resolvedAllocatedItems: applyManualAdjustments(
      resolvedInventoryItems,
      stage.manualItemAdjustments || []
    )
  };
};
