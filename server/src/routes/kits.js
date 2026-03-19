import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

let ensureTablesPromise = null;

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeTotals = (items = []) => ({
  totalCostPrice: items.reduce((sum, item) => sum + Number(item.lineCostTotal ?? (Number(item.unitCost || 0) * Number(item.quantity || 0))), 0),
  totalSellPrice: items.reduce((sum, item) => sum + Number(item.lineSellTotal ?? (Number(item.unitSellPrice || 0) * Number(item.quantity || 0))), 0),
  totalLaborHours: items
    .filter((item) => item.itemType === 'labor')
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
});

const normalizeKitItems = (items = []) =>
  items.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unitCost || 0);
    const unitSellPrice = Number(item.unitSellPrice || 0);

    return {
      id: item.id || crypto.randomUUID(),
      itemType: item.itemType || 'inventory',
      inventoryItemId: item.inventoryItemId || undefined,
      itemName: item.itemName || 'Line Item',
      itemCode: item.itemCode || undefined,
      category: item.category || undefined,
      laborType: item.laborType || undefined,
      hourlyRate: item.hourlyRate !== undefined ? Number(item.hourlyRate) : undefined,
      subcontractorType: item.subcontractorType || undefined,
      subKitId: item.subKitId || undefined,
      subKitName: item.subKitName || undefined,
      quantity,
      unit: item.unit || 'EA',
      unitCost,
      unitSellPrice,
      lineCostTotal: Number(item.lineCostTotal ?? quantity * unitCost),
      lineSellTotal: Number(item.lineSellTotal ?? quantity * unitSellPrice),
      alternativeItemIds: item.alternativeItemIds || [],
      isOptional: Boolean(item.isOptional),
      isConsumable: item.isConsumable !== undefined ? Boolean(item.isConsumable) : true,
      notes: item.notes || undefined,
      sortOrder: item.sortOrder !== undefined ? Number(item.sortOrder) : index
    };
  });

const normalizeVariations = (variations = []) =>
  variations.map((variation) => ({
    id: variation.id || crypto.randomUUID(),
    name: variation.name,
    description: variation.description || undefined,
    costMultiplier: Number(variation.costMultiplier || 1),
    itemOverrides: variation.itemOverrides ? normalizeKitItems(variation.itemOverrides) : undefined,
    additionalItems: variation.additionalItems ? normalizeKitItems(variation.additionalItems) : undefined,
    excludedItemIds: variation.excludedItemIds || []
  }));

const materializeItems = (kit, variationId) => {
  const baseItems = normalizeKitItems(kit.items || []);
  const variation = (kit.variations || []).find((candidate) => candidate.id === variationId);

  if (!variation) {
    return baseItems;
  }

  const excluded = new Set(variation.excludedItemIds || []);
  let items = baseItems
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({
      ...item,
      quantity: Number((item.quantity * Number(variation.costMultiplier || 1)).toFixed(3)),
      lineCostTotal: Number((item.quantity * Number(variation.costMultiplier || 1) * item.unitCost).toFixed(2)),
      lineSellTotal: Number((item.quantity * Number(variation.costMultiplier || 1) * item.unitSellPrice).toFixed(2))
    }));

  if (variation.itemOverrides?.length) {
    const overridesById = new Map(variation.itemOverrides.map((item) => [item.id, item]));
    items = items.map((item) => overridesById.get(item.id) || item);
  }

  if (variation.additionalItems?.length) {
    items = [...items, ...variation.additionalItems];
  }

  return normalizeKitItems(items);
};

const buildKit = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  kitType: row.kit_type,
  category: row.category,
  status: row.status,
  color: row.color || undefined,
  icon: row.icon || undefined,
  applicableJobTypes: parseJson(row.applicable_job_types_json, []),
  items: normalizeKitItems(parseJson(row.items_json, [])),
  variations: normalizeVariations(parseJson(row.variations_json, [])),
  totalCostPrice: Number(row.total_cost_price || 0),
  totalSellPrice: Number(row.total_sell_price || 0),
  totalLaborHours: Number(row.total_labor_hours || 0),
  defaultMarkupPercentage: Number(row.default_markup_percentage || 0),
  usageCount: Number(row.usage_count || 0),
  lastUsedAt: row.last_used_at || undefined,
  averageJobProfit: row.average_job_profit !== null && row.average_job_profit !== undefined ? Number(row.average_job_profit) : undefined,
  averageCompletionTime: row.average_completion_time !== null && row.average_completion_time !== undefined ? Number(row.average_completion_time) : undefined,
  tags: parseJson(row.tags_json, []),
  version: Number(row.version || 1),
  parentKitId: row.parent_kit_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by || undefined
});

const buildCategory = (row, kitCount = 0) => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  color: row.color,
  icon: row.icon || undefined,
  sortOrder: Number(row.sort_order || 0),
  kitCount
});

const buildAppliedItems = (items) =>
  items.map((item) => ({
    kitItemId: item.id,
    itemType: item.itemType,
    inventoryItemId: item.inventoryItemId,
    itemName: item.itemName,
    itemCode: item.itemCode,
    plannedQuantity: item.quantity,
    actualQuantity: undefined,
    wastedQuantity: undefined,
    status: 'planned',
    isOptional: Boolean(item.isOptional),
    wasModified: false,
    substitutedItemId: undefined,
    substitutedItemName: undefined,
    substitutionReason: undefined,
    unitCost: item.unitCost,
    unitSellPrice: item.unitSellPrice
  }));

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS kit_categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS kits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        kit_type TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        applicable_job_types_json TEXT,
        items_json TEXT NOT NULL,
        variations_json TEXT,
        total_cost_price REAL NOT NULL DEFAULT 0,
        total_sell_price REAL NOT NULL DEFAULT 0,
        total_labor_hours REAL NOT NULL DEFAULT 0,
        default_markup_percentage REAL NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        average_job_profit REAL,
        average_completion_time REAL,
        tags_json TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        parent_kit_id TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS kit_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kit_id TEXT NOT NULL,
        kit_name TEXT NOT NULL,
        kit_type TEXT NOT NULL,
        variation_id TEXT,
        variation_name TEXT,
        job_id TEXT NOT NULL,
        job_title TEXT,
        quote_id TEXT,
        applied_items_json TEXT NOT NULL,
        stock_reservation_id TEXT,
        reservation_status TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        applied_by TEXT NOT NULL,
        picked_at TEXT,
        picked_by TEXT,
        customizations TEXT
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS kit_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kit_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        variation_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_kits_user_updated ON kits (user_id, updated_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_kit_categories_user_sort ON kit_categories (user_id, sort_order)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_kit_apps_user_job ON kit_applications (user_id, job_id)');
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
};

const loadKits = async (userId) => {
  const result = await db.query('SELECT * FROM kits WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC', [userId]);
  return result.rows.map(buildKit);
};

const getKit = async (userId, kitId) => {
  const kits = await loadKits(userId);
  return kits.find((kit) => kit.id === kitId) || null;
};

const loadCategories = async (userId) => {
  const [categoryResult, kits] = await Promise.all([
    db.query('SELECT * FROM kit_categories WHERE user_id = $1 ORDER BY sort_order ASC, name ASC', [userId]),
    loadKits(userId)
  ]);

  return categoryResult.rows.map((row) =>
    buildCategory(row, kits.filter((kit) => kit.category === row.name).length)
  );
};

const loadApplications = async (userId) => {
  const result = await db.query('SELECT * FROM kit_applications WHERE user_id = $1 ORDER BY applied_at DESC', [userId]);
  return result.rows.map((row) => ({
    id: row.id,
    kitId: row.kit_id,
    kitName: row.kit_name,
    kitType: row.kit_type,
    variationId: row.variation_id || undefined,
    variationName: row.variation_name || undefined,
    jobId: row.job_id,
    jobTitle: row.job_title || undefined,
    quoteId: row.quote_id || undefined,
    appliedItems: parseJson(row.applied_items_json, []),
    stockReservationId: row.stock_reservation_id || undefined,
    reservationStatus: row.reservation_status,
    appliedAt: row.applied_at,
    appliedBy: row.applied_by,
    pickedAt: row.picked_at || undefined,
    pickedBy: row.picked_by || undefined,
    customizations: row.customizations || undefined
  }));
};

const loadReservations = async (userId) => {
  const result = await db.query('SELECT * FROM kit_reservations WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map((row) => ({
    id: row.id,
    kitId: row.kit_id,
    jobId: row.job_id,
    variationId: row.variation_id || undefined,
    status: row.status,
    createdAt: row.created_at
  }));
};

const saveKit = async (userId, kitId, payload, existing = null) => {
  const now = new Date().toISOString();
  const items = normalizeKitItems(payload.items || existing?.items || []);
  const variations = normalizeVariations(payload.variations || existing?.variations || []);
  const totals = computeTotals(items);
  const kit = {
    ...existing,
    ...payload,
    id: kitId,
    items,
    variations,
    applicableJobTypes: payload.applicableJobTypes || existing?.applicableJobTypes || [],
    tags: payload.tags || existing?.tags || [],
    status: payload.status || existing?.status || 'draft',
    color: payload.color || existing?.color || '#2563EB',
    version: existing ? Number(existing.version || 1) + 1 : 1,
    usageCount: existing?.usageCount || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...totals
  };

  if (existing) {
    await db.query(`
      UPDATE kits
      SET name = $3,
          description = $4,
          kit_type = $5,
          category = $6,
          status = $7,
          color = $8,
          icon = $9,
          applicable_job_types_json = $10,
          items_json = $11,
          variations_json = $12,
          total_cost_price = $13,
          total_sell_price = $14,
          total_labor_hours = $15,
          default_markup_percentage = $16,
          usage_count = $17,
          last_used_at = $18,
          average_job_profit = $19,
          average_completion_time = $20,
          tags_json = $21,
          version = $22,
          parent_kit_id = $23,
          created_by = $24,
          updated_at = $25
      WHERE user_id = $1 AND id = $2
    `, [
      userId,
      kitId,
      kit.name,
      kit.description || null,
      kit.kitType,
      kit.category,
      kit.status,
      kit.color || null,
      kit.icon || null,
      JSON.stringify(kit.applicableJobTypes || []),
      JSON.stringify(kit.items),
      JSON.stringify(kit.variations || []),
      kit.totalCostPrice,
      kit.totalSellPrice,
      kit.totalLaborHours,
      numberOrNull(kit.defaultMarkupPercentage) ?? 0,
      numberOrNull(kit.usageCount) ?? 0,
      kit.lastUsedAt || null,
      numberOrNull(kit.averageJobProfit),
      numberOrNull(kit.averageCompletionTime),
      JSON.stringify(kit.tags || []),
      kit.version,
      kit.parentKitId || null,
      kit.createdBy || null,
      now
    ]);
  } else {
    await db.query(`
      INSERT INTO kits (
        id, user_id, name, description, kit_type, category, status, color, icon,
        applicable_job_types_json, items_json, variations_json, total_cost_price,
        total_sell_price, total_labor_hours, default_markup_percentage, usage_count,
        last_used_at, average_job_profit, average_completion_time, tags_json, version,
        parent_kit_id, created_by, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26
      )
    `, [
      kitId,
      userId,
      kit.name,
      kit.description || null,
      kit.kitType,
      kit.category,
      kit.status,
      kit.color || null,
      kit.icon || null,
      JSON.stringify(kit.applicableJobTypes || []),
      JSON.stringify(kit.items),
      JSON.stringify(kit.variations || []),
      kit.totalCostPrice,
      kit.totalSellPrice,
      kit.totalLaborHours,
      numberOrNull(kit.defaultMarkupPercentage) ?? 0,
      numberOrNull(kit.usageCount) ?? 0,
      kit.lastUsedAt || null,
      numberOrNull(kit.averageJobProfit),
      numberOrNull(kit.averageCompletionTime),
      JSON.stringify(kit.tags || []),
      kit.version,
      kit.parentKitId || null,
      kit.createdBy || null,
      kit.createdAt,
      kit.updatedAt
    ]);
  }

  return getKit(userId, kitId);
};

const saveCategory = async (userId, categoryId, payload, existing = null) => {
  const now = new Date().toISOString();
  if (existing) {
    await db.query(`
      UPDATE kit_categories
      SET name = $3,
          description = $4,
          color = $5,
          icon = $6,
          sort_order = $7,
          updated_at = $8
      WHERE user_id = $1 AND id = $2
    `, [
      userId,
      categoryId,
      payload.name,
      payload.description || null,
      payload.color,
      payload.icon || null,
      numberOrNull(payload.sortOrder) ?? 0,
      now
    ]);
  } else {
    await db.query(`
      INSERT INTO kit_categories (id, user_id, name, description, color, icon, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      categoryId,
      userId,
      payload.name,
      payload.description || null,
      payload.color,
      payload.icon || null,
      numberOrNull(payload.sortOrder) ?? 0,
      now,
      now
    ]);
  }
};

const getInventoryMap = async (userId) => {
  try {
    const result = await db.query('SELECT id, name, quantity FROM inventory_items WHERE user_id = $1', [userId]);
    return new Map(result.rows.map((row) => [row.id, row]));
  } catch (_error) {
    return new Map();
  }
};

const buildAvailability = async (userId, kit, variationId = null) => {
  const inventoryMap = await getInventoryMap(userId);
  const reservationRows = await loadReservations(userId);
  const activeReservations = reservationRows.filter((reservation) => reservation.kitId === kit.id && reservation.status === 'reserved');
  const items = materializeItems(kit, variationId);

  const itemAvailability = items.map((item) => {
    const inventoryItem = item.inventoryItemId ? inventoryMap.get(item.inventoryItemId) : null;
    const requiredQty = Number(item.quantity || 0);
    const reservedQty = activeReservations.length > 0 && item.inventoryItemId
      ? activeReservations.length * requiredQty
      : 0;
    const availableQty = inventoryItem ? Math.max(Number(inventoryItem.quantity || 0) - reservedQty, 0) : requiredQty;
    const canFulfill = !inventoryItem || availableQty >= requiredQty || item.isOptional;

    return {
      kitItemId: item.id,
      itemName: item.itemName,
      requiredQty,
      availableQty,
      allocatedQty: reservedQty,
      canFulfill,
      shortageQty: canFulfill ? 0 : Math.max(requiredQty - availableQty, 0),
      locationAvailability: []
    };
  });

  const shortageItems = itemAvailability.filter((item) => item.shortageQty > 0).length;

  return {
    kitId: kit.id,
    kitName: kit.name,
    availabilityStatus: shortageItems === 0 ? 'available' : itemAvailability.some((item) => item.canFulfill) ? 'partial' : 'unavailable',
    items: itemAvailability,
    totalItems: itemAvailability.length,
    availableItems: itemAvailability.filter((item) => item.canFulfill).length,
    shortageItems,
    optionalItemsShort: itemAvailability.filter((item) => item.shortageQty > 0 && items.find((candidate) => candidate.id === item.kitItemId)?.isOptional).length,
    alternativesAvailable: itemAvailability.some((item) => {
      const source = items.find((candidate) => candidate.id === item.kitItemId);
      return Boolean(source?.alternativeItemIds?.length);
    })
  };
};

router.use(authenticateToken);
router.use(async (_req, _res, next) => {
  try {
    await ensureTables();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await loadCategories(req.user.userId);
    res.json(categories);
  } catch (error) {
    console.error('Kit categories error:', error);
    res.status(500).json({ error: 'Failed to load kit categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    await saveCategory(req.user.userId, id, {
      name: req.body.name,
      description: req.body.description,
      color: req.body.color || '#64748B',
      icon: req.body.icon,
      sortOrder: req.body.sortOrder ?? 0
    });
    const categories = await loadCategories(req.user.userId);
    res.status(201).json(categories.find((category) => category.id === id));
  } catch (error) {
    console.error('Kit category create error:', error);
    res.status(500).json({ error: 'Failed to create kit category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const existingResult = await db.query('SELECT * FROM kit_categories WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    if (!existingResult.rows[0]) {
      return res.status(404).json({ error: 'Category not found' });
    }
    await saveCategory(req.user.userId, req.params.id, {
      name: req.body.name || existingResult.rows[0].name,
      description: req.body.description ?? existingResult.rows[0].description,
      color: req.body.color || existingResult.rows[0].color,
      icon: req.body.icon ?? existingResult.rows[0].icon,
      sortOrder: req.body.sortOrder ?? existingResult.rows[0].sort_order
    }, existingResult.rows[0]);
    const categories = await loadCategories(req.user.userId);
    res.json(categories.find((category) => category.id === req.params.id));
  } catch (error) {
    console.error('Kit category update error:', error);
    res.status(500).json({ error: 'Failed to update kit category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM kit_categories WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Kit category delete error:', error);
    res.status(500).json({ error: 'Failed to delete kit category' });
  }
});

router.get('/filters', async (req, res) => {
  try {
    const kits = await loadKits(req.user.userId);
    const categories = await loadCategories(req.user.userId);
    const jobTypes = Array.from(new Set(kits.flatMap((kit) => kit.applicableJobTypes || []))).sort((left, right) => left.localeCompare(right));
    const tags = Array.from(new Set(kits.flatMap((kit) => kit.tags || []))).sort((left, right) => left.localeCompare(right));

    res.json({ categories, jobTypes, tags });
  } catch (error) {
    console.error('Kit filters error:', error);
    res.status(500).json({ error: 'Failed to load kit filters' });
  }
});

router.get('/applications', async (req, res) => {
  try {
    let applications = await loadApplications(req.user.userId);
    if (req.query.jobId) {
      applications = applications.filter((application) => application.jobId === req.query.jobId);
    }
    if (req.query.kitId) {
      applications = applications.filter((application) => application.kitId === req.query.kitId);
    }
    res.json(applications);
  } catch (error) {
    console.error('Kit applications error:', error);
    res.status(500).json({ error: 'Failed to load kit applications' });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.body.kitId);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    const appliedItems = buildAppliedItems(materializeItems(kit, req.body.variationId));
    const applicationId = crypto.randomUUID();
    const appliedAt = new Date().toISOString();
    const variation = kit.variations?.find((candidate) => candidate.id === req.body.variationId);

    await db.query(`
      INSERT INTO kit_applications (
        id, user_id, kit_id, kit_name, kit_type, variation_id, variation_name,
        job_id, job_title, quote_id, applied_items_json, stock_reservation_id,
        reservation_status, applied_at, applied_by, picked_at, picked_by, customizations
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18
      )
    `, [
      applicationId,
      req.user.userId,
      kit.id,
      kit.name,
      kit.kitType,
      req.body.variationId || null,
      variation?.name || null,
      req.body.jobId,
      req.body.jobTitle || null,
      req.body.quoteId || null,
      JSON.stringify(appliedItems),
      null,
      'pending',
      appliedAt,
      req.user.fullName || req.user.email || req.user.userId,
      null,
      null,
      req.body.customizations || null
    ]);

    await saveKit(req.user.userId, kit.id, {
      ...kit,
      usageCount: Number(kit.usageCount || 0) + 1,
      lastUsedAt: appliedAt,
      averageJobProfit: kit.totalSellPrice - kit.totalCostPrice
    }, kit);

    const applications = await loadApplications(req.user.userId);
    res.status(201).json(applications.find((application) => application.id === applicationId));
  } catch (error) {
    console.error('Kit apply error:', error);
    res.status(500).json({ error: 'Failed to apply kit to job' });
  }
});

router.put('/applications/:id', async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM kit_applications WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Kit application not found' });
    }
    const row = existing.rows[0];
    await db.query(`
      UPDATE kit_applications
      SET applied_items_json = $3,
          stock_reservation_id = $4,
          reservation_status = $5,
          picked_at = $6,
          picked_by = $7,
          customizations = $8
      WHERE user_id = $1 AND id = $2
    `, [
      req.user.userId,
      req.params.id,
      JSON.stringify(req.body.appliedItems || parseJson(row.applied_items_json, [])),
      req.body.stockReservationId || row.stock_reservation_id,
      req.body.reservationStatus || row.reservation_status,
      req.body.pickedAt || row.picked_at,
      req.body.pickedBy || row.picked_by,
      req.body.customizations || row.customizations
    ]);
    const applications = await loadApplications(req.user.userId);
    res.json(applications.find((application) => application.id === req.params.id));
  } catch (error) {
    console.error('Kit application update error:', error);
    res.status(500).json({ error: 'Failed to update kit application' });
  }
});

router.delete('/applications/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM kit_applications WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Kit application delete error:', error);
    res.status(500).json({ error: 'Failed to remove kit from job' });
  }
});

router.post('/applications/:id/pick', async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM kit_applications WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Kit application not found' });
    }
    const currentItems = parseJson(existing.rows[0].applied_items_json, []);
    const pickedIds = new Set(req.body.pickedItemIds || []);
    const updatedItems = currentItems.map((item) =>
      pickedIds.has(item.kitItemId) ? { ...item, status: 'picked' } : item
    );
    await db.query(`
      UPDATE kit_applications
      SET applied_items_json = $3,
          reservation_status = 'picked',
          picked_at = $4,
          picked_by = $5
      WHERE user_id = $1 AND id = $2
    `, [
      req.user.userId,
      req.params.id,
      JSON.stringify(updatedItems),
      new Date().toISOString(),
      req.user.fullName || req.user.email || req.user.userId
    ]);
    const applications = await loadApplications(req.user.userId);
    res.json(applications.find((application) => application.id === req.params.id));
  } catch (error) {
    console.error('Kit pick items error:', error);
    res.status(500).json({ error: 'Failed to pick kit items' });
  }
});

router.post('/availability', async (req, res) => {
  try {
    const kits = await Promise.all((req.body.kitIds || []).map((kitId) => getKit(req.user.userId, kitId)));
    const availability = [];
    for (const kit of kits.filter(Boolean)) {
      availability.push(await buildAvailability(req.user.userId, kit));
    }
    res.json(availability);
  } catch (error) {
    console.error('Kit multiple availability error:', error);
    res.status(500).json({ error: 'Failed to check kit availability' });
  }
});

router.get('/popular', async (req, res) => {
  try {
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const kits = await loadKits(req.user.userId);
    res.json(kits.sort((left, right) => right.usageCount - left.usageCount).slice(0, limit));
  } catch (error) {
    console.error('Kit popular error:', error);
    res.status(500).json({ error: 'Failed to load popular kits' });
  }
});

router.get('/profitable', async (req, res) => {
  try {
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const kits = await loadKits(req.user.userId);
    res.json(
      kits
        .sort((left, right) => (right.totalSellPrice - right.totalCostPrice) - (left.totalSellPrice - left.totalCostPrice))
        .slice(0, limit)
    );
  } catch (error) {
    console.error('Kit profitable error:', error);
    res.status(500).json({ error: 'Failed to load profitable kits' });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const kits = await Promise.all((req.body.kitIds || []).map((kitId) => getKit(req.user.userId, kitId)));
    const filteredKits = kits.filter(Boolean);
    const itemNames = Array.from(new Set(filteredKits.flatMap((kit) => kit.items.map((item) => item.itemName))));
    res.json({
      kits: filteredKits.map((kit) => ({
        kitId: kit.id,
        kitName: kit.name,
        category: kit.category,
        totalCost: kit.totalCostPrice,
        totalSellPrice: kit.totalSellPrice,
        laborHours: kit.totalLaborHours,
        itemCount: kit.items.length
      })),
      itemComparison: itemNames.map((itemName) => {
        const matchingItems = filteredKits.map((kit) => ({
          kit,
          item: kit.items.find((candidate) => candidate.itemName === itemName)
        }));
        return {
          itemName,
          category: matchingItems.find((entry) => entry.item?.category)?.item?.category || '',
          quantities: Object.fromEntries(matchingItems.map(({ kit, item }) => [kit.id, item?.quantity || 0])),
          priceComparison: Object.fromEntries(matchingItems.map(({ kit, item }) => [kit.id, item?.lineSellTotal || 0]))
        };
      })
    });
  } catch (error) {
    console.error('Kit compare error:', error);
    res.status(500).json({ error: 'Failed to compare kits' });
  }
});

router.post('/recommendations', async (req, res) => {
  try {
    const jobDescription = String(req.body.jobDescription || '').toLowerCase();
    const jobType = String(req.body.jobType || '').toLowerCase();
    const keywords = new Set(jobDescription.split(/[^a-z0-9]+/).filter((token) => token.length > 2));
    const kits = await loadKits(req.user.userId);

    const recommendations = [];
    for (const kit of kits.filter((candidate) => candidate.status === 'active')) {
      let score = 0;
      const matchReasons = [];

      if (jobType && kit.applicableJobTypes.some((candidate) => candidate.toLowerCase() === jobType)) {
        score += 45;
        matchReasons.push('Matches job type');
      }

      kit.tags.forEach((tag) => {
        if (keywords.has(tag.toLowerCase())) {
          score += 10;
          matchReasons.push(`Tag match: ${tag}`);
        }
      });

      const searchableText = `${kit.name} ${kit.description || ''} ${kit.category} ${kit.applicableJobTypes.join(' ')}`.toLowerCase();
      keywords.forEach((keyword) => {
        if (searchableText.includes(keyword)) {
          score += 5;
        }
      });

      score += Math.min(kit.usageCount, 20);

      if (score <= 0) {
        continue;
      }

      const availability = await buildAvailability(req.user.userId, kit);
      recommendations.push({
        kit,
        matchScore: Math.min(score, 100),
        matchReason: matchReasons[0] || 'Keyword match',
        estimatedJobDuration: kit.totalLaborHours,
        estimatedProfit: kit.totalSellPrice - kit.totalCostPrice,
        stockAvailability: availability,
        suggestedModifications: []
      });
    }

    res.json(recommendations.sort((left, right) => right.matchScore - left.matchScore));
  } catch (error) {
    console.error('Kit recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate kit recommendations' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const itemId = req.query.itemId;
    const kits = await loadKits(req.user.userId);
    res.json(
      kits.filter((kit) => kit.items.some((item) => item.inventoryItemId === itemId))
    );
  } catch (error) {
    console.error('Kit suggestions error:', error);
    res.status(500).json({ error: 'Failed to load kit suggestions' });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      search,
      kitType,
      category,
      status,
      jobType,
      tags,
      sortBy = 'recent',
      sortDirection = 'desc',
      page = 1,
      pageSize = 100
    } = req.query;

    let kits = await loadKits(req.user.userId);

    if (search) {
      const normalized = String(search).toLowerCase();
      kits = kits.filter((kit) =>
        kit.name.toLowerCase().includes(normalized) ||
        (kit.description || '').toLowerCase().includes(normalized) ||
        kit.tags.some((tag) => tag.toLowerCase().includes(normalized))
      );
    }
    if (kitType) {
      kits = kits.filter((kit) => kit.kitType === kitType);
    }
    if (category) {
      kits = kits.filter((kit) => kit.category === category);
    }
    if (status) {
      kits = kits.filter((kit) => kit.status === status);
    }
    if (jobType) {
      kits = kits.filter((kit) => kit.applicableJobTypes.includes(jobType));
    }
    const tagFilters = Array.isArray(tags) ? tags : tags ? [tags] : [];
    if (tagFilters.length > 0) {
      kits = kits.filter((kit) => tagFilters.every((tag) => kit.tags.includes(tag)));
    }

    const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
    kits = kits.sort((left, right) => {
      switch (sortBy) {
        case 'name':
          return left.name.localeCompare(right.name) * sortMultiplier;
        case 'usageCount':
          return (left.usageCount - right.usageCount) * sortMultiplier;
        case 'profit':
          return ((left.totalSellPrice - left.totalCostPrice) - (right.totalSellPrice - right.totalCostPrice)) * sortMultiplier;
        case 'recent':
        default:
          return (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()) * sortMultiplier;
      }
    });

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericPageSize = Math.max(Number(pageSize) || 100, 1);
    const start = (numericPage - 1) * numericPageSize;

    res.json({
      kits: kits.slice(start, start + numericPageSize),
      total: kits.length,
      page: numericPage,
      pageSize: numericPageSize
    });
  } catch (error) {
    console.error('Kits list error:', error);
    res.status(500).json({ error: 'Failed to load kits' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    res.json(kit);
  } catch (error) {
    console.error('Kit get error:', error);
    res.status(500).json({ error: 'Failed to load kit' });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await saveKit(req.user.userId, crypto.randomUUID(), {
      ...req.body,
      createdBy: req.user.fullName || req.user.email || req.user.userId
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Kit create error:', error);
    res.status(500).json({ error: 'Failed to create kit' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getKit(req.user.userId, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    const updated = await saveKit(req.user.userId, req.params.id, req.body, existing);
    res.json(updated);
  } catch (error) {
    console.error('Kit update error:', error);
    res.status(500).json({ error: 'Failed to update kit' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM kit_reservations WHERE user_id = $1 AND kit_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM kit_applications WHERE user_id = $1 AND kit_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM kits WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Kit delete error:', error);
    res.status(500).json({ error: 'Failed to delete kit' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    const duplicated = await saveKit(req.user.userId, crypto.randomUUID(), {
      ...kit,
      id: undefined,
      name: req.body.newName || `${kit.name} (Copy)`,
      parentKitId: kit.id,
      usageCount: 0,
      lastUsedAt: undefined,
      version: 1
    });
    res.status(201).json(duplicated);
  } catch (error) {
    console.error('Kit duplicate error:', error);
    res.status(500).json({ error: 'Failed to duplicate kit' });
  }
});

router.put('/:id/archive', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    const updated = await saveKit(req.user.userId, req.params.id, {
      ...kit,
      status: 'archived'
    }, kit);
    res.json(updated);
  } catch (error) {
    console.error('Kit archive error:', error);
    res.status(500).json({ error: 'Failed to archive kit' });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    res.json(await buildAvailability(req.user.userId, kit, req.query.variationId || null));
  } catch (error) {
    console.error('Kit availability error:', error);
    res.status(500).json({ error: 'Failed to check kit availability' });
  }
});

router.post('/:id/reserve', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    const reservationId = crypto.randomUUID();
    await db.query(
      'INSERT INTO kit_reservations (id, user_id, kit_id, job_id, variation_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [reservationId, req.user.userId, kit.id, req.body.jobId, req.body.variationId || null, 'reserved', new Date().toISOString()]
    );
    res.status(201).json({ reservationId });
  } catch (error) {
    console.error('Kit reserve error:', error);
    res.status(500).json({ error: 'Failed to reserve stock for kit' });
  }
});

router.delete('/reservations/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM kit_reservations WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Kit reservation delete error:', error);
    res.status(500).json({ error: 'Failed to release kit reservation' });
  }
});

router.get('/:id/analytics', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    const applications = (await loadApplications(req.user.userId)).filter((application) => application.kitId === kit.id);
    const profits = applications.map(() => kit.totalSellPrice - kit.totalCostPrice);
    res.json({
      kitId: kit.id,
      kitName: kit.name,
      usageStats: {
        totalApplications: applications.length,
        thisMonth: applications.filter((application) => new Date(application.appliedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
        thisQuarter: applications.filter((application) => new Date(application.appliedAt) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length,
        thisYear: applications.filter((application) => new Date(application.appliedAt) >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)).length,
        averagePerMonth: applications.length / 12
      },
      financialStats: {
        totalRevenue: applications.length * kit.totalSellPrice,
        totalCost: applications.length * kit.totalCostPrice,
        totalProfit: profits.reduce((sum, value) => sum + value, 0),
        averageProfitMargin: kit.totalSellPrice > 0 ? ((kit.totalSellPrice - kit.totalCostPrice) / kit.totalSellPrice) * 100 : 0,
        averageJobValue: kit.totalSellPrice
      },
      efficiencyStats: {
        averagePrepTime: 0,
        averageCompletionTime: kit.averageCompletionTime || kit.totalLaborHours,
        stockoutFrequency: 0,
        modificationRate: 0
      },
      popularVariations: (kit.variations || []).map((variation) => ({
        variationId: variation.id,
        variationName: variation.name,
        usageCount: applications.filter((application) => application.variationId === variation.id).length,
        percentage: applications.length > 0
          ? (applications.filter((application) => application.variationId === variation.id).length / applications.length) * 100
          : 0
      }))
    });
  } catch (error) {
    console.error('Kit analytics error:', error);
    res.status(500).json({ error: 'Failed to load kit analytics' });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const kit = await getKit(req.user.userId, req.params.id);
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }
    res.json(kit);
  } catch (error) {
    console.error('Kit export error:', error);
    res.status(500).json({ error: 'Failed to export kit' });
  }
});

router.get('/import-template', (_req, res) => {
  res.type('text/csv').send('name,description,kitType,category,status\n');
});

export default router;
