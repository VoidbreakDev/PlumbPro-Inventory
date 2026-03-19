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

const computeDocumentStatus = (document) => {
  if (!document.expiryDate) {
    return document.status || 'valid';
  }

  const today = new Date();
  const expiry = new Date(document.expiryDate);
  const diffDays = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return 'expired';
  }

  if (diffDays <= 30) {
    return 'expiring';
  }

  return 'valid';
};

const formatLocation = (location) => {
  if (!location) {
    return undefined;
  }

  const latitude = Number(location.latitude || 0).toFixed(5);
  const longitude = Number(location.longitude || 0).toFixed(5);
  return `${latitude}, ${longitude}`;
};

const mapAsset = (row) => {
  const complianceDocuments = parseJson(row.compliance_documents_json, []).map((document) => ({
    ...document,
    status: computeDocumentStatus(document)
  }));

  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    assetType: row.asset_type,
    assetCode: row.asset_code,
    serialNumber: row.serial_number || undefined,
    model: row.model || undefined,
    manufacturer: row.manufacturer || undefined,
    year: row.year ? Number(row.year) : undefined,
    purchaseDate: row.purchase_date || undefined,
    purchasePrice: row.purchase_price !== null && row.purchase_price !== undefined ? Number(row.purchase_price) : undefined,
    supplierId: row.supplier_id || undefined,
    supplierName: row.supplier_name || undefined,
    warrantyExpiry: row.warranty_expiry || undefined,
    status: row.status,
    condition: row.condition,
    currentLocation: row.current_location || undefined,
    assignedTo: row.assigned_to || undefined,
    assignedToName: row.assigned_to_name || undefined,
    registrationNumber: row.registration_number || undefined,
    vin: row.vin || undefined,
    fuelType: row.fuel_type || undefined,
    currentOdometer: row.current_odometer !== null && row.current_odometer !== undefined ? Number(row.current_odometer) : undefined,
    lastServiceOdometer: row.last_service_odometer !== null && row.last_service_odometer !== undefined ? Number(row.last_service_odometer) : undefined,
    nextServiceOdometer: row.next_service_odometer !== null && row.next_service_odometer !== undefined ? Number(row.next_service_odometer) : undefined,
    insuranceProvider: row.insurance_provider || undefined,
    insurancePolicyNumber: row.insurance_policy_number || undefined,
    insuranceExpiry: row.insurance_expiry || undefined,
    complianceDocuments,
    photos: parseJson(row.photos_json, []),
    maintenanceSchedule: parseJson(row.maintenance_schedule_json, undefined),
    notes: row.notes || undefined,
    tags: parseJson(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapMaintenance = (row) => ({
  id: row.id,
  assetId: row.asset_id,
  assetName: row.asset_name || undefined,
  maintenanceType: row.maintenance_type,
  status: row.status,
  scheduledDate: row.scheduled_date,
  completedDate: row.completed_date || undefined,
  description: row.description,
  workPerformed: row.work_performed || undefined,
  partsUsed: parseJson(row.parts_used_json, []),
  cost: row.cost !== null && row.cost !== undefined ? Number(row.cost) : undefined,
  performedBy: row.performed_by || undefined,
  performedByName: row.performed_by_name || undefined,
  serviceProvider: row.service_provider || undefined,
  conditionAfter: row.condition_after || undefined,
  odometerReading: row.odometer_reading !== null && row.odometer_reading !== undefined ? Number(row.odometer_reading) : undefined,
  testTagExpiry: row.test_tag_expiry || undefined,
  invoiceUrl: row.invoice_url || undefined,
  certificateUrl: row.certificate_url || undefined,
  photos: parseJson(row.photos_json, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapAllocation = (row) => ({
  id: row.id,
  assetId: row.asset_id,
  assetName: row.asset_name,
  assetType: row.asset_type,
  jobId: row.job_id || undefined,
  jobTitle: row.job_title || undefined,
  userId: row.assigned_user_id || undefined,
  userName: row.assigned_user_name || undefined,
  checkOutLocation: parseJson(row.check_out_location_json, undefined),
  checkInLocation: parseJson(row.check_in_location_json, undefined),
  allocatedAt: row.allocated_at,
  expectedReturnAt: row.expected_return_at || undefined,
  checkOutAt: row.check_out_at || undefined,
  checkInAt: row.check_in_at || undefined,
  conditionAtCheckOut: row.condition_at_check_out || undefined,
  conditionAtCheckIn: row.condition_at_check_in || undefined,
  odometerAtCheckOut: row.odometer_at_check_out !== null && row.odometer_at_check_out !== undefined ? Number(row.odometer_at_check_out) : undefined,
  odometerAtCheckIn: row.odometer_at_check_in !== null && row.odometer_at_check_in !== undefined ? Number(row.odometer_at_check_in) : undefined,
  status: row.status,
  notes: row.notes || undefined
});

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        asset_type TEXT NOT NULL,
        asset_code TEXT NOT NULL,
        serial_number TEXT,
        model TEXT,
        manufacturer TEXT,
        year INTEGER,
        purchase_date TEXT,
        purchase_price REAL,
        supplier_id TEXT,
        supplier_name TEXT,
        warranty_expiry TEXT,
        status TEXT NOT NULL,
        condition TEXT NOT NULL,
        current_location TEXT,
        assigned_to TEXT,
        assigned_to_name TEXT,
        registration_number TEXT,
        vin TEXT,
        fuel_type TEXT,
        current_odometer REAL,
        last_service_odometer REAL,
        next_service_odometer REAL,
        insurance_provider TEXT,
        insurance_policy_number TEXT,
        insurance_expiry TEXT,
        compliance_documents_json TEXT,
        photos_json TEXT,
        maintenance_schedule_json TEXT,
        notes TEXT,
        tags_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS asset_maintenance_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        asset_name TEXT,
        maintenance_type TEXT NOT NULL,
        status TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        completed_date TEXT,
        description TEXT NOT NULL,
        work_performed TEXT,
        parts_used_json TEXT,
        cost REAL,
        performed_by TEXT,
        performed_by_name TEXT,
        service_provider TEXT,
        condition_after TEXT,
        odometer_reading REAL,
        test_tag_expiry TEXT,
        invoice_url TEXT,
        certificate_url TEXT,
        photos_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS asset_allocations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        asset_name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        job_id TEXT,
        job_title TEXT,
        assigned_user_id TEXT,
        assigned_user_name TEXT,
        check_out_location_json TEXT,
        check_in_location_json TEXT,
        allocated_at TEXT NOT NULL,
        expected_return_at TEXT,
        check_out_at TEXT,
        check_in_at TEXT,
        condition_at_check_out TEXT,
        condition_at_check_in TEXT,
        odometer_at_check_out REAL,
        odometer_at_check_in REAL,
        status TEXT NOT NULL,
        notes TEXT
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_assets_user_updated ON assets (user_id, updated_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_assets_maintenance_user_asset ON asset_maintenance_records (user_id, asset_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_assets_allocations_user_asset ON asset_allocations (user_id, asset_id)');
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
};

const loadAssets = async (userId) => {
  const result = await db.query(
    'SELECT * FROM assets WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC',
    [userId]
  );
  return result.rows.map(mapAsset);
};

const loadMaintenanceRecords = async (userId, assetId = null) => {
  const params = [userId];
  let query = 'SELECT * FROM asset_maintenance_records WHERE user_id = $1';

  if (assetId) {
    params.push(assetId);
    query += ` AND asset_id = $${params.length}`;
  }

  query += ' ORDER BY scheduled_date DESC, created_at DESC';
  const result = await db.query(query, params);
  return result.rows.map(mapMaintenance);
};

const loadAllocations = async (userId) => {
  const result = await db.query(
    'SELECT * FROM asset_allocations WHERE user_id = $1 ORDER BY allocated_at DESC',
    [userId]
  );
  return result.rows.map(mapAllocation);
};

const getAsset = async (userId, assetId) => {
  const result = await db.query(
    'SELECT * FROM assets WHERE user_id = $1 AND id = $2',
    [userId, assetId]
  );
  return result.rows[0] ? mapAsset(result.rows[0]) : null;
};

const saveAsset = async (userId, assetId, payload, existing = null) => {
  const now = new Date().toISOString();
  const asset = {
    ...existing,
    ...payload,
    id: assetId,
    status: payload.status || existing?.status || 'active',
    condition: payload.condition || existing?.condition || 'good',
    assetType: payload.assetType || existing?.assetType || 'tool',
    complianceDocuments: (payload.complianceDocuments || existing?.complianceDocuments || []).map((document) => ({
      ...document,
      status: computeDocumentStatus(document)
    })),
    photos: payload.photos || existing?.photos || [],
    maintenanceSchedule: payload.maintenanceSchedule || existing?.maintenanceSchedule || undefined,
    tags: payload.tags || existing?.tags || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    await db.query(`
      UPDATE assets
      SET name = $3,
          description = $4,
          asset_type = $5,
          asset_code = $6,
          serial_number = $7,
          model = $8,
          manufacturer = $9,
          year = $10,
          purchase_date = $11,
          purchase_price = $12,
          supplier_id = $13,
          supplier_name = $14,
          warranty_expiry = $15,
          status = $16,
          condition = $17,
          current_location = $18,
          assigned_to = $19,
          assigned_to_name = $20,
          registration_number = $21,
          vin = $22,
          fuel_type = $23,
          current_odometer = $24,
          last_service_odometer = $25,
          next_service_odometer = $26,
          insurance_provider = $27,
          insurance_policy_number = $28,
          insurance_expiry = $29,
          compliance_documents_json = $30,
          photos_json = $31,
          maintenance_schedule_json = $32,
          notes = $33,
          tags_json = $34,
          updated_at = $35
      WHERE user_id = $1 AND id = $2
    `, [
      userId,
      assetId,
      asset.name,
      asset.description || null,
      asset.assetType,
      asset.assetCode,
      asset.serialNumber || null,
      asset.model || null,
      asset.manufacturer || null,
      numberOrNull(asset.year),
      asset.purchaseDate || null,
      numberOrNull(asset.purchasePrice),
      asset.supplierId || null,
      asset.supplierName || null,
      asset.warrantyExpiry || null,
      asset.status,
      asset.condition,
      asset.currentLocation || null,
      asset.assignedTo || null,
      asset.assignedToName || null,
      asset.registrationNumber || null,
      asset.vin || null,
      asset.fuelType || null,
      numberOrNull(asset.currentOdometer),
      numberOrNull(asset.lastServiceOdometer),
      numberOrNull(asset.nextServiceOdometer),
      asset.insuranceProvider || null,
      asset.insurancePolicyNumber || null,
      asset.insuranceExpiry || null,
      JSON.stringify(asset.complianceDocuments || []),
      JSON.stringify(asset.photos || []),
      asset.maintenanceSchedule ? JSON.stringify(asset.maintenanceSchedule) : null,
      asset.notes || null,
      JSON.stringify(asset.tags || []),
      now
    ]);
  } else {
    await db.query(`
      INSERT INTO assets (
        user_id, id, name, description, asset_type, asset_code, serial_number, model,
        manufacturer, year, purchase_date, purchase_price, supplier_id, supplier_name,
        warranty_expiry, status, condition, current_location, assigned_to, assigned_to_name,
        registration_number, vin, fuel_type, current_odometer, last_service_odometer,
        next_service_odometer, insurance_provider, insurance_policy_number, insurance_expiry,
        compliance_documents_json, photos_json, maintenance_schedule_json, notes, tags_json,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32, $33, $34,
        $35, $36
      )
    `, [
      userId,
      assetId,
      asset.name,
      asset.description || null,
      asset.assetType,
      asset.assetCode,
      asset.serialNumber || null,
      asset.model || null,
      asset.manufacturer || null,
      numberOrNull(asset.year),
      asset.purchaseDate || null,
      numberOrNull(asset.purchasePrice),
      asset.supplierId || null,
      asset.supplierName || null,
      asset.warrantyExpiry || null,
      asset.status,
      asset.condition,
      asset.currentLocation || null,
      asset.assignedTo || null,
      asset.assignedToName || null,
      asset.registrationNumber || null,
      asset.vin || null,
      asset.fuelType || null,
      numberOrNull(asset.currentOdometer),
      numberOrNull(asset.lastServiceOdometer),
      numberOrNull(asset.nextServiceOdometer),
      asset.insuranceProvider || null,
      asset.insurancePolicyNumber || null,
      asset.insuranceExpiry || null,
      JSON.stringify(asset.complianceDocuments || []),
      JSON.stringify(asset.photos || []),
      asset.maintenanceSchedule ? JSON.stringify(asset.maintenanceSchedule) : null,
      asset.notes || null,
      JSON.stringify(asset.tags || []),
      asset.createdAt,
      asset.updatedAt
    ]);
  }

  return getAsset(userId, assetId);
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

router.get('/stats/maintenance', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [assets, maintenanceRecords] = await Promise.all([
      loadAssets(userId),
      loadMaintenanceRecords(userId)
    ]);
    const now = new Date();

    res.json({
      totalAssets: assets.length,
      overdueMaintenance: maintenanceRecords.filter((record) => record.status !== 'completed' && new Date(record.scheduledDate) < now).length,
      upcomingMaintenance: maintenanceRecords.filter((record) => {
        if (record.status === 'completed') return false;
        const scheduledDate = new Date(record.scheduledDate);
        const diffDays = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }).length,
      expiringCompliance: assets.flatMap((asset) => asset.complianceDocuments || []).filter((document) => document.status === 'expiring').length
    });
  } catch (error) {
    console.error('Asset maintenance stats error:', error);
    res.status(500).json({ error: 'Failed to load maintenance statistics' });
  }
});

router.get('/maintenance/overdue', async (req, res) => {
  try {
    const records = await loadMaintenanceRecords(req.user.userId);
    const overdue = records.filter((record) => record.status !== 'completed' && new Date(record.scheduledDate) < new Date());
    res.json(overdue);
  } catch (error) {
    console.error('Asset overdue maintenance error:', error);
    res.status(500).json({ error: 'Failed to load overdue maintenance' });
  }
});

router.get('/maintenance/upcoming', async (req, res) => {
  try {
    const days = Math.max(Number(req.query.days) || 30, 1);
    const records = await loadMaintenanceRecords(req.user.userId);
    const now = new Date();
    const upcoming = records.filter((record) => {
      if (record.status === 'completed') {
        return false;
      }
      const scheduled = new Date(record.scheduledDate);
      const diffDays = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= days;
    });
    res.json(upcoming);
  } catch (error) {
    console.error('Asset upcoming maintenance error:', error);
    res.status(500).json({ error: 'Failed to load upcoming maintenance' });
  }
});

router.get('/compliance/expiring', async (req, res) => {
  try {
    const days = Math.max(Number(req.query.days) || 30, 1);
    const now = new Date();
    const assets = await loadAssets(req.user.userId);
    const expiring = assets.flatMap((asset) =>
      (asset.complianceDocuments || [])
        .filter((document) => {
          if (!document.expiryDate) {
            return false;
          }
          const diffDays = (new Date(document.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= days;
        })
        .map((document) => ({ asset, document }))
    );

    res.json(expiring);
  } catch (error) {
    console.error('Asset expiring compliance error:', error);
    res.status(500).json({ error: 'Failed to load expiring compliance' });
  }
});

router.get('/maintenance', async (req, res) => {
  try {
    const records = await loadMaintenanceRecords(req.user.userId, req.query.assetId || null);
    res.json(records);
  } catch (error) {
    console.error('Asset maintenance list error:', error);
    res.status(500).json({ error: 'Failed to load maintenance records' });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.body.assetId);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const now = new Date().toISOString();
    const recordId = crypto.randomUUID();

    await db.query(`
      INSERT INTO asset_maintenance_records (
        id, user_id, asset_id, asset_name, maintenance_type, status, scheduled_date,
        completed_date, description, work_performed, parts_used_json, cost, performed_by,
        performed_by_name, service_provider, condition_after, odometer_reading,
        test_tag_expiry, invoice_url, certificate_url, photos_json, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23
      )
    `, [
      recordId,
      req.user.userId,
      asset.id,
      asset.name,
      req.body.maintenanceType || 'routine',
      req.body.status || 'scheduled',
      req.body.scheduledDate || now,
      req.body.completedDate || null,
      req.body.description || 'Maintenance task',
      req.body.workPerformed || null,
      JSON.stringify(req.body.partsUsed || []),
      numberOrNull(req.body.cost),
      req.body.performedBy || null,
      req.body.performedByName || null,
      req.body.serviceProvider || null,
      req.body.conditionAfter || null,
      numberOrNull(req.body.odometerReading),
      req.body.testTagExpiry || null,
      req.body.invoiceUrl || null,
      req.body.certificateUrl || null,
      JSON.stringify(req.body.photos || []),
      now,
      now
    ]);

    const created = await loadMaintenanceRecords(req.user.userId, asset.id);
    res.status(201).json(created.find((record) => record.id === recordId));
  } catch (error) {
    console.error('Asset maintenance create error:', error);
    res.status(500).json({ error: 'Failed to create maintenance record' });
  }
});

router.put('/maintenance/:id', async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM asset_maintenance_records WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const row = existing.rows[0];
    const now = new Date().toISOString();

    await db.query(`
      UPDATE asset_maintenance_records
      SET maintenance_type = $3,
          status = $4,
          scheduled_date = $5,
          completed_date = $6,
          description = $7,
          work_performed = $8,
          parts_used_json = $9,
          cost = $10,
          performed_by = $11,
          performed_by_name = $12,
          service_provider = $13,
          condition_after = $14,
          odometer_reading = $15,
          test_tag_expiry = $16,
          invoice_url = $17,
          certificate_url = $18,
          photos_json = $19,
          updated_at = $20
      WHERE id = $1 AND user_id = $2
    `, [
      req.params.id,
      req.user.userId,
      req.body.maintenanceType || row.maintenance_type,
      req.body.status || row.status,
      req.body.scheduledDate || row.scheduled_date,
      req.body.completedDate || row.completed_date,
      req.body.description || row.description,
      req.body.workPerformed || row.work_performed,
      JSON.stringify(req.body.partsUsed || parseJson(row.parts_used_json, [])),
      numberOrNull(req.body.cost ?? row.cost),
      req.body.performedBy || row.performed_by,
      req.body.performedByName || row.performed_by_name,
      req.body.serviceProvider || row.service_provider,
      req.body.conditionAfter || row.condition_after,
      numberOrNull(req.body.odometerReading ?? row.odometer_reading),
      req.body.testTagExpiry || row.test_tag_expiry,
      req.body.invoiceUrl || row.invoice_url,
      req.body.certificateUrl || row.certificate_url,
      JSON.stringify(req.body.photos || parseJson(row.photos_json, [])),
      now
    ]);

    const updatedList = await loadMaintenanceRecords(req.user.userId);
    res.json(updatedList.find((record) => record.id === req.params.id));
  } catch (error) {
    console.error('Asset maintenance update error:', error);
    res.status(500).json({ error: 'Failed to update maintenance record' });
  }
});

router.post('/maintenance/:id/complete', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM asset_maintenance_records WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const existing = result.rows[0];

    await db.query(`
      UPDATE asset_maintenance_records
      SET status = 'completed',
          completed_date = $3,
          work_performed = $4,
          cost = $5,
          odometer_reading = $6,
          photos_json = $7,
          updated_at = $8
      WHERE id = $1 AND user_id = $2
    `, [
      req.params.id,
      req.user.userId,
      req.body.completedDate || new Date().toISOString(),
      req.body.workPerformed || existing.work_performed,
      numberOrNull(req.body.cost ?? existing.cost),
      numberOrNull(req.body.odometerReading ?? existing.odometer_reading),
      JSON.stringify(req.body.photos || parseJson(existing.photos_json, [])),
      new Date().toISOString()
    ]);

    const updatedRecords = await loadMaintenanceRecords(req.user.userId);
    res.json(updatedRecords.find((record) => record.id === req.params.id));
  } catch (error) {
    console.error('Asset maintenance complete error:', error);
    res.status(500).json({ error: 'Failed to complete maintenance record' });
  }
});

router.post('/allocate', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.body.assetId);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const allocationId = crypto.randomUUID();
    const allocatedAt = new Date().toISOString();
    await db.query(`
      INSERT INTO asset_allocations (
        id, user_id, asset_id, asset_name, asset_type, job_id, job_title, assigned_user_id,
        assigned_user_name, check_out_location_json, check_in_location_json, allocated_at,
        expected_return_at, check_out_at, check_in_at, condition_at_check_out,
        condition_at_check_in, odometer_at_check_out, odometer_at_check_in, status, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      )
    `, [
      allocationId,
      req.user.userId,
      asset.id,
      asset.name,
      asset.assetType,
      req.body.jobId || null,
      req.body.jobTitle || null,
      req.body.userId || req.user.userId,
      req.body.userName || req.user.fullName || req.user.email || null,
      null,
      null,
      allocatedAt,
      req.body.expectedReturnAt || null,
      null,
      null,
      asset.condition,
      null,
      null,
      null,
      'allocated',
      req.body.notes || null
    ]);

    await saveAsset(req.user.userId, asset.id, {
      ...asset,
      assignedTo: req.body.userId || req.user.userId,
      assignedToName: req.body.userName || req.user.fullName || req.user.email || asset.assignedToName
    }, asset);

    const allocations = await loadAllocations(req.user.userId);
    res.status(201).json(allocations.find((allocation) => allocation.id === allocationId));
  } catch (error) {
    console.error('Asset allocate error:', error);
    res.status(500).json({ error: 'Failed to allocate asset' });
  }
});

router.post('/checkout/:id', async (req, res) => {
  try {
    const allocationResult = await db.query(
      'SELECT * FROM asset_allocations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (!allocationResult.rows[0]) {
      return res.status(404).json({ error: 'Asset allocation not found' });
    }

    const allocation = allocationResult.rows[0];
    const asset = await getAsset(req.user.userId, allocation.asset_id);

    await db.query(`
      UPDATE asset_allocations
      SET check_out_location_json = $3,
          check_out_at = $4,
          condition_at_check_out = $5,
          odometer_at_check_out = $6,
          status = 'checked_out',
          notes = COALESCE($7, notes)
      WHERE id = $1 AND user_id = $2
    `, [
      req.params.id,
      req.user.userId,
      JSON.stringify(req.body.location || null),
      new Date().toISOString(),
      asset?.condition || 'good',
      numberOrNull(req.body.odometerReading),
      req.body.notes || null
    ]);

    if (asset) {
      await saveAsset(req.user.userId, asset.id, {
        ...asset,
        currentLocation: formatLocation(req.body.location),
        currentOdometer: req.body.odometerReading ?? asset.currentOdometer
      }, asset);
    }

    const allocations = await loadAllocations(req.user.userId);
    res.json(allocations.find((currentAllocation) => currentAllocation.id === req.params.id));
  } catch (error) {
    console.error('Asset checkout error:', error);
    res.status(500).json({ error: 'Failed to check out asset' });
  }
});

router.post('/checkin/:id', async (req, res) => {
  try {
    const allocationResult = await db.query(
      'SELECT * FROM asset_allocations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (!allocationResult.rows[0]) {
      return res.status(404).json({ error: 'Asset allocation not found' });
    }

    const allocation = allocationResult.rows[0];
    const asset = await getAsset(req.user.userId, allocation.asset_id);

    await db.query(`
      UPDATE asset_allocations
      SET check_in_location_json = $3,
          check_in_at = $4,
          condition_at_check_in = $5,
          odometer_at_check_in = $6,
          status = 'checked_in',
          notes = COALESCE($7, notes)
      WHERE id = $1 AND user_id = $2
    `, [
      req.params.id,
      req.user.userId,
      JSON.stringify(req.body.location || null),
      new Date().toISOString(),
      req.body.condition || asset?.condition || 'good',
      numberOrNull(req.body.odometerReading),
      req.body.notes || null
    ]);

    if (asset) {
      await saveAsset(req.user.userId, asset.id, {
        ...asset,
        assignedTo: undefined,
        assignedToName: undefined,
        condition: req.body.condition || asset.condition,
        currentLocation: formatLocation(req.body.location),
        currentOdometer: req.body.odometerReading ?? asset.currentOdometer
      }, asset);
    }

    const allocations = await loadAllocations(req.user.userId);
    res.json(allocations.find((currentAllocation) => currentAllocation.id === req.params.id));
  } catch (error) {
    console.error('Asset checkin error:', error);
    res.status(500).json({ error: 'Failed to check in asset' });
  }
});

router.get('/allocations', async (req, res) => {
  try {
    let allocations = await loadAllocations(req.user.userId);

    allocations = allocations.filter((allocation) => allocation.status !== 'checked_in');

    if (req.query.userId) {
      allocations = allocations.filter((allocation) => allocation.userId === req.query.userId);
    }

    res.json(allocations);
  } catch (error) {
    console.error('Asset allocations list error:', error);
    res.status(500).json({ error: 'Failed to load asset allocations' });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      type,
      status,
      assignedTo,
      search,
      page = 1,
      pageSize = 100
    } = req.query;

    let assets = await loadAssets(req.user.userId);

    if (type) {
      assets = assets.filter((asset) => asset.assetType === type);
    }
    if (status) {
      assets = assets.filter((asset) => asset.status === status);
    }
    if (assignedTo) {
      assets = assets.filter((asset) => asset.assignedTo === assignedTo);
    }
    if (search) {
      const normalized = String(search).toLowerCase();
      assets = assets.filter((asset) =>
        asset.name.toLowerCase().includes(normalized) ||
        asset.assetCode.toLowerCase().includes(normalized) ||
        (asset.model || '').toLowerCase().includes(normalized) ||
        (asset.registrationNumber || '').toLowerCase().includes(normalized)
      );
    }

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericPageSize = Math.max(Number(pageSize) || 100, 1);
    const start = (numericPage - 1) * numericPageSize;

    res.json({
      assets: assets.slice(start, start + numericPageSize),
      total: assets.length
    });
  } catch (error) {
    console.error('Assets list error:', error);
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    console.error('Asset get error:', error);
    res.status(500).json({ error: 'Failed to load asset' });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await saveAsset(req.user.userId, crypto.randomUUID(), req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Asset create error:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getAsset(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const updated = await saveAsset(req.user.userId, req.params.id, req.body, existing);
    res.json(updated);
  } catch (error) {
    console.error('Asset update error:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await db.query('DELETE FROM asset_maintenance_records WHERE user_id = $1 AND asset_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM asset_allocations WHERE user_id = $1 AND asset_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM assets WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Asset delete error:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

router.post('/:id/documents', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const document = {
      id: crypto.randomUUID(),
      type: req.body.type || 'other',
      title: req.body.title || 'Untitled Document',
      documentNumber: req.body.documentNumber || undefined,
      issueDate: req.body.issueDate || undefined,
      expiryDate: req.body.expiryDate || undefined,
      fileUrl: req.body.fileUrl || undefined,
      status: computeDocumentStatus(req.body)
    };

    await saveAsset(req.user.userId, asset.id, {
      ...asset,
      complianceDocuments: [...(asset.complianceDocuments || []), document]
    }, asset);

    res.status(201).json(document);
  } catch (error) {
    console.error('Asset document create error:', error);
    res.status(500).json({ error: 'Failed to add compliance document' });
  }
});

router.put('/:id/documents/:documentId', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const updatedDocuments = (asset.complianceDocuments || []).map((document) =>
      document.id === req.params.documentId
        ? {
            ...document,
            ...req.body,
            status: computeDocumentStatus({ ...document, ...req.body })
          }
        : document
    );

    const updated = await saveAsset(req.user.userId, asset.id, {
      ...asset,
      complianceDocuments: updatedDocuments
    }, asset);

    res.json((updated.complianceDocuments || []).find((document) => document.id === req.params.documentId));
  } catch (error) {
    console.error('Asset document update error:', error);
    res.status(500).json({ error: 'Failed to update compliance document' });
  }
});

router.delete('/:id/documents/:documentId', async (req, res) => {
  try {
    const asset = await getAsset(req.user.userId, req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await saveAsset(req.user.userId, asset.id, {
      ...asset,
      complianceDocuments: (asset.complianceDocuments || []).filter((document) => document.id !== req.params.documentId)
    }, asset);

    res.json({ success: true });
  } catch (error) {
    console.error('Asset document delete error:', error);
    res.status(500).json({ error: 'Failed to delete compliance document' });
  }
});

export default router;
