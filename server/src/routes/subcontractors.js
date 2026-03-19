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

const computeDocumentStatus = (document, pendingStatus = 'pending_verification') => {
  if (document.verifiedAt && document.status !== pendingStatus) {
    if (!document.expiryDate) {
      return 'valid';
    }
  }

  if (!document.expiryDate) {
    return document.status || pendingStatus;
  }

  const now = new Date();
  const expiry = new Date(document.expiryDate);
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return 'expired';
  }

  if (diffDays <= 30) {
    return 'expiring';
  }

  return document.verifiedAt ? 'valid' : pendingStatus;
};

const computeComplianceStatus = (insuranceDocuments, licenseDocuments) => {
  const allDocuments = [...insuranceDocuments, ...licenseDocuments];

  if (allDocuments.length === 0) {
    return 'pending';
  }

  if (allDocuments.some((document) => document.status === 'expired')) {
    return 'non_compliant';
  }

  if (allDocuments.some((document) => document.status === 'pending_verification')) {
    return 'pending';
  }

  return 'compliant';
};

const mapInsuranceDocument = (document) => ({
  ...document,
  status: computeDocumentStatus(document, 'pending_verification')
});

const mapLicenseDocument = (document) => ({
  ...document,
  status: computeDocumentStatus(document, 'pending_verification')
});

const mapJob = (row) => ({
  id: row.id,
  subcontractorId: row.subcontractor_id,
  jobId: row.job_id,
  jobTitle: row.job_title,
  scopeOfWork: row.scope_of_work,
  estimatedHours: row.estimated_hours !== null && row.estimated_hours !== undefined ? Number(row.estimated_hours) : undefined,
  actualHours: row.actual_hours !== null && row.actual_hours !== undefined ? Number(row.actual_hours) : undefined,
  hourlyRate: Number(row.hourly_rate || 0),
  totalValue: Number(row.total_value || 0),
  status: row.status,
  quotedAt: row.quoted_at || undefined,
  approvedAt: row.approved_at || undefined,
  startedAt: row.started_at || undefined,
  completedAt: row.completed_at || undefined,
  invoicedAt: row.invoiced_at || undefined,
  paidAt: row.paid_at || undefined,
  quoteUrl: row.quote_url || undefined,
  invoiceUrl: row.invoice_url || undefined,
  completionPhotos: parseJson(row.completion_photos_json, []),
  rating: row.rating !== null && row.rating !== undefined ? Number(row.rating) : undefined,
  review: row.review || undefined,
  wouldRecommend: row.would_recommend !== null && row.would_recommend !== undefined ? Boolean(Number(row.would_recommend)) : undefined
});

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS subcontractors (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        company TEXT,
        address_street TEXT,
        address_city TEXT,
        address_state TEXT,
        address_postcode TEXT,
        address_country TEXT,
        abn TEXT,
        billing_email TEXT,
        website TEXT,
        primary_contact_name TEXT,
        primary_contact_phone TEXT,
        primary_contact_email TEXT,
        tags_json TEXT,
        status TEXT,
        internal_notes TEXT,
        preferred_contact_method TEXT,
        business_name TEXT,
        trading_name TEXT,
        trade_type_json TEXT,
        expertise_json TEXT,
        insurance_documents_json TEXT,
        license_documents_json TEXT,
        availability_status TEXT NOT NULL,
        typical_lead_time INTEGER,
        preferred_job_types_json TEXT,
        service_area_json TEXT,
        hourly_rate REAL,
        daily_rate REAL,
        call_out_fee REAL,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        bank_account_name TEXT,
        bank_bsb TEXT,
        bank_account_number TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS subcontractor_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subcontractor_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        job_title TEXT NOT NULL,
        scope_of_work TEXT NOT NULL,
        estimated_hours REAL,
        actual_hours REAL,
        hourly_rate REAL NOT NULL DEFAULT 0,
        total_value REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        quoted_at TEXT,
        approved_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        invoiced_at TEXT,
        paid_at TEXT,
        quote_url TEXT,
        invoice_url TEXT,
        completion_photos_json TEXT,
        rating REAL,
        review TEXT,
        would_recommend INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_subcontractors_user_updated ON subcontractors (user_id, updated_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_subcontractor_jobs_user_sub ON subcontractor_jobs (user_id, subcontractor_id)');
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
};

const loadJobs = async (userId, subcontractorId = null) => {
  let query = 'SELECT * FROM subcontractor_jobs WHERE user_id = $1';
  const params = [userId];

  if (subcontractorId) {
    params.push(subcontractorId);
    query += ` AND subcontractor_id = $${params.length}`;
  }

  query += ' ORDER BY created_at DESC';
  const result = await db.query(query, params);
  return result.rows.map(mapJob);
};

const loadSubcontractors = async (userId) => {
  const [subcontractorResult, jobs] = await Promise.all([
    db.query('SELECT * FROM subcontractors WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC', [userId]),
    loadJobs(userId)
  ]);

  return subcontractorResult.rows.map((row) => {
    const insuranceDocuments = parseJson(row.insurance_documents_json, []).map(mapInsuranceDocument);
    const licenseDocuments = parseJson(row.license_documents_json, []).map(mapLicenseDocument);
    const subcontractorJobs = jobs.filter((job) => job.subcontractorId === row.id);
    const ratedJobs = subcontractorJobs.filter((job) => typeof job.rating === 'number');
    const totalJobs = subcontractorJobs.length;
    const completedJobs = subcontractorJobs.filter((job) =>
      ['completed', 'invoiced', 'paid'].includes(job.status)
    ).length;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      email: row.email,
      phone: row.phone,
      company: row.company || undefined,
      addressStreet: row.address_street || undefined,
      addressCity: row.address_city || undefined,
      addressState: row.address_state || undefined,
      addressPostcode: row.address_postcode || undefined,
      addressCountry: row.address_country || undefined,
      abn: row.abn,
      billingEmail: row.billing_email || undefined,
      website: row.website || undefined,
      primaryContactName: row.primary_contact_name || undefined,
      primaryContactPhone: row.primary_contact_phone || undefined,
      primaryContactEmail: row.primary_contact_email || undefined,
      tags: parseJson(row.tags_json, []),
      status: row.status || undefined,
      internalNotes: row.internal_notes || undefined,
      preferredContactMethod: row.preferred_contact_method || undefined,
      businessName: row.business_name || undefined,
      tradingName: row.trading_name || undefined,
      tradeType: parseJson(row.trade_type_json, []),
      expertise: parseJson(row.expertise_json, []),
      insuranceDocuments,
      licenseDocuments,
      complianceStatus: computeComplianceStatus(insuranceDocuments, licenseDocuments),
      rating: ratedJobs.length > 0
        ? ratedJobs.reduce((sum, job) => sum + (job.rating || 0), 0) / ratedJobs.length
        : undefined,
      totalJobs,
      completedJobs,
      averageJobValue: totalJobs > 0
        ? subcontractorJobs.reduce((sum, job) => sum + job.totalValue, 0) / totalJobs
        : undefined,
      availabilityStatus: row.availability_status,
      typicalLeadTime: row.typical_lead_time !== null && row.typical_lead_time !== undefined ? Number(row.typical_lead_time) : undefined,
      preferredJobTypes: parseJson(row.preferred_job_types_json, []),
      serviceArea: parseJson(row.service_area_json, []),
      hourlyRate: row.hourly_rate !== null && row.hourly_rate !== undefined ? Number(row.hourly_rate) : undefined,
      dailyRate: row.daily_rate !== null && row.daily_rate !== undefined ? Number(row.daily_rate) : undefined,
      callOutFee: row.call_out_fee !== null && row.call_out_fee !== undefined ? Number(row.call_out_fee) : undefined,
      emergencyContactName: row.emergency_contact_name || undefined,
      emergencyContactPhone: row.emergency_contact_phone || undefined,
      bankAccountName: row.bank_account_name || undefined,
      bankBsb: row.bank_bsb || undefined,
      bankAccountNumber: row.bank_account_number || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
};

const getSubcontractor = async (userId, subcontractorId) => {
  const subcontractors = await loadSubcontractors(userId);
  return subcontractors.find((subcontractor) => subcontractor.id === subcontractorId) || null;
};

const saveSubcontractor = async (userId, subcontractorId, payload, existing = null) => {
  const now = new Date().toISOString();
  const subcontractor = {
    ...existing,
    ...payload,
    id: subcontractorId,
    type: 'Subcontractor',
    tradeType: payload.tradeType || existing?.tradeType || [],
    expertise: payload.expertise || existing?.expertise || [],
    insuranceDocuments: (payload.insuranceDocuments || existing?.insuranceDocuments || []).map(mapInsuranceDocument),
    licenseDocuments: (payload.licenseDocuments || existing?.licenseDocuments || []).map(mapLicenseDocument),
    preferredJobTypes: payload.preferredJobTypes || existing?.preferredJobTypes || [],
    serviceArea: payload.serviceArea || existing?.serviceArea || [],
    tags: payload.tags || existing?.tags || [],
    availabilityStatus: payload.availabilityStatus || existing?.availabilityStatus || 'available',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    await db.query(`
      UPDATE subcontractors
      SET name = $3,
          type = $4,
          email = $5,
          phone = $6,
          company = $7,
          address_street = $8,
          address_city = $9,
          address_state = $10,
          address_postcode = $11,
          address_country = $12,
          abn = $13,
          billing_email = $14,
          website = $15,
          primary_contact_name = $16,
          primary_contact_phone = $17,
          primary_contact_email = $18,
          tags_json = $19,
          status = $20,
          internal_notes = $21,
          preferred_contact_method = $22,
          business_name = $23,
          trading_name = $24,
          trade_type_json = $25,
          expertise_json = $26,
          insurance_documents_json = $27,
          license_documents_json = $28,
          availability_status = $29,
          typical_lead_time = $30,
          preferred_job_types_json = $31,
          service_area_json = $32,
          hourly_rate = $33,
          daily_rate = $34,
          call_out_fee = $35,
          emergency_contact_name = $36,
          emergency_contact_phone = $37,
          bank_account_name = $38,
          bank_bsb = $39,
          bank_account_number = $40,
          updated_at = $41
      WHERE user_id = $1 AND id = $2
    `, [
      userId,
      subcontractorId,
      subcontractor.name,
      subcontractor.type,
      subcontractor.email,
      subcontractor.phone,
      subcontractor.company || null,
      subcontractor.addressStreet || null,
      subcontractor.addressCity || null,
      subcontractor.addressState || null,
      subcontractor.addressPostcode || null,
      subcontractor.addressCountry || null,
      subcontractor.abn,
      subcontractor.billingEmail || null,
      subcontractor.website || null,
      subcontractor.primaryContactName || null,
      subcontractor.primaryContactPhone || null,
      subcontractor.primaryContactEmail || null,
      JSON.stringify(subcontractor.tags || []),
      subcontractor.status || null,
      subcontractor.internalNotes || null,
      subcontractor.preferredContactMethod || null,
      subcontractor.businessName || null,
      subcontractor.tradingName || null,
      JSON.stringify(subcontractor.tradeType || []),
      JSON.stringify(subcontractor.expertise || []),
      JSON.stringify(subcontractor.insuranceDocuments || []),
      JSON.stringify(subcontractor.licenseDocuments || []),
      subcontractor.availabilityStatus,
      numberOrNull(subcontractor.typicalLeadTime),
      JSON.stringify(subcontractor.preferredJobTypes || []),
      JSON.stringify(subcontractor.serviceArea || []),
      numberOrNull(subcontractor.hourlyRate),
      numberOrNull(subcontractor.dailyRate),
      numberOrNull(subcontractor.callOutFee),
      subcontractor.emergencyContactName || null,
      subcontractor.emergencyContactPhone || null,
      subcontractor.bankAccountName || null,
      subcontractor.bankBsb || null,
      subcontractor.bankAccountNumber || null,
      now
    ]);
  } else {
    await db.query(`
      INSERT INTO subcontractors (
        user_id, id, name, type, email, phone, company, address_street, address_city,
        address_state, address_postcode, address_country, abn, billing_email, website,
        primary_contact_name, primary_contact_phone, primary_contact_email, tags_json,
        status, internal_notes, preferred_contact_method, business_name, trading_name,
        trade_type_json, expertise_json, insurance_documents_json, license_documents_json,
        availability_status, typical_lead_time, preferred_job_types_json, service_area_json,
        hourly_rate, daily_rate, call_out_fee, emergency_contact_name,
        emergency_contact_phone, bank_account_name, bank_bsb, bank_account_number,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24,
        $25, $26, $27, $28,
        $29, $30, $31, $32,
        $33, $34, $35, $36,
        $37, $38, $39, $40,
        $41, $42
      )
    `, [
      userId,
      subcontractorId,
      subcontractor.name,
      subcontractor.type,
      subcontractor.email,
      subcontractor.phone,
      subcontractor.company || null,
      subcontractor.addressStreet || null,
      subcontractor.addressCity || null,
      subcontractor.addressState || null,
      subcontractor.addressPostcode || null,
      subcontractor.addressCountry || null,
      subcontractor.abn,
      subcontractor.billingEmail || null,
      subcontractor.website || null,
      subcontractor.primaryContactName || null,
      subcontractor.primaryContactPhone || null,
      subcontractor.primaryContactEmail || null,
      JSON.stringify(subcontractor.tags || []),
      subcontractor.status || null,
      subcontractor.internalNotes || null,
      subcontractor.preferredContactMethod || null,
      subcontractor.businessName || null,
      subcontractor.tradingName || null,
      JSON.stringify(subcontractor.tradeType || []),
      JSON.stringify(subcontractor.expertise || []),
      JSON.stringify(subcontractor.insuranceDocuments || []),
      JSON.stringify(subcontractor.licenseDocuments || []),
      subcontractor.availabilityStatus,
      numberOrNull(subcontractor.typicalLeadTime),
      JSON.stringify(subcontractor.preferredJobTypes || []),
      JSON.stringify(subcontractor.serviceArea || []),
      numberOrNull(subcontractor.hourlyRate),
      numberOrNull(subcontractor.dailyRate),
      numberOrNull(subcontractor.callOutFee),
      subcontractor.emergencyContactName || null,
      subcontractor.emergencyContactPhone || null,
      subcontractor.bankAccountName || null,
      subcontractor.bankBsb || null,
      subcontractor.bankAccountNumber || null,
      subcontractor.createdAt,
      subcontractor.updatedAt
    ]);
  }

  return getSubcontractor(userId, subcontractorId);
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

router.get('/trade-types', async (req, res) => {
  try {
    const subcontractors = await loadSubcontractors(req.user.userId);
    const tradeTypes = Array.from(
      new Set(subcontractors.flatMap((subcontractor) => subcontractor.tradeType || []))
    ).sort((left, right) => left.localeCompare(right));

    res.json(tradeTypes);
  } catch (error) {
    console.error('Subcontractor trade types error:', error);
    res.status(500).json({ error: 'Failed to load trade types' });
  }
});

router.get('/compliance/summary', async (req, res) => {
  try {
    const subcontractors = await loadSubcontractors(req.user.userId);
    const insuranceDocuments = subcontractors.flatMap((subcontractor) => subcontractor.insuranceDocuments);
    const licenseDocuments = subcontractors.flatMap((subcontractor) => subcontractor.licenseDocuments);

    res.json({
      totalSubcontractors: subcontractors.length,
      compliant: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'compliant').length,
      pending: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'pending').length,
      nonCompliant: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'non_compliant').length,
      expiringInsurance: insuranceDocuments.filter((document) => document.status === 'expiring').length,
      expiringLicenses: licenseDocuments.filter((document) => document.status === 'expiring').length
    });
  } catch (error) {
    console.error('Subcontractor compliance summary error:', error);
    res.status(500).json({ error: 'Failed to load compliance summary' });
  }
});

router.get('/compliance/expiring', async (req, res) => {
  try {
    const days = Math.max(Number(req.query.days) || 30, 1);
    const now = new Date();
    const subcontractors = await loadSubcontractors(req.user.userId);

    const result = {
      insurance: [],
      licenses: []
    };

    subcontractors.forEach((subcontractor) => {
      subcontractor.insuranceDocuments.forEach((document) => {
        if (!document.expiryDate) return;
        const diffDays = (new Date(document.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= days) {
          result.insurance.push({ subcontractor, document });
        }
      });

      subcontractor.licenseDocuments.forEach((document) => {
        if (!document.expiryDate) return;
        const diffDays = (new Date(document.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= days) {
          result.licenses.push({ subcontractor, document });
        }
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Subcontractor expiring docs error:', error);
    res.status(500).json({ error: 'Failed to load expiring documents' });
  }
});

router.post('/verify-abn', async (req, res) => {
  const rawAbn = String(req.body.abn || '').replace(/\D/g, '');
  const valid = rawAbn.length === 11;

  res.json({
    valid,
    businessName: valid ? `ABN ${rawAbn}` : undefined,
    tradingName: valid ? `ABN ${rawAbn}` : undefined,
    status: valid ? 'manual_verification_required' : 'invalid',
    message: valid
      ? 'ABN format looks valid. Manual verification is still required.'
      : 'ABN must contain 11 digits.'
  });
});

router.get('/', async (req, res) => {
  try {
    const {
      tradeType,
      complianceStatus,
      availability,
      search,
      page = 1,
      pageSize = 100
    } = req.query;

    let subcontractors = await loadSubcontractors(req.user.userId);

    if (tradeType) {
      subcontractors = subcontractors.filter((subcontractor) => subcontractor.tradeType.includes(tradeType));
    }
    if (complianceStatus) {
      subcontractors = subcontractors.filter((subcontractor) => subcontractor.complianceStatus === complianceStatus);
    }
    if (availability) {
      subcontractors = subcontractors.filter((subcontractor) => subcontractor.availabilityStatus === availability);
    }
    if (search) {
      const normalized = String(search).toLowerCase();
      subcontractors = subcontractors.filter((subcontractor) =>
        subcontractor.name.toLowerCase().includes(normalized) ||
        subcontractor.abn.toLowerCase().includes(normalized) ||
        (subcontractor.businessName || '').toLowerCase().includes(normalized)
      );
    }

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericPageSize = Math.max(Number(pageSize) || 100, 1);
    const start = (numericPage - 1) * numericPageSize;

    res.json({
      subcontractors: subcontractors.slice(start, start + numericPageSize),
      total: subcontractors.length
    });
  } catch (error) {
    console.error('Subcontractors list error:', error);
    res.status(500).json({ error: 'Failed to load subcontractors' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    res.json(subcontractor);
  } catch (error) {
    console.error('Subcontractor get error:', error);
    res.status(500).json({ error: 'Failed to load subcontractor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await saveSubcontractor(req.user.userId, crypto.randomUUID(), req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Subcontractor create error:', error);
    res.status(500).json({ error: 'Failed to create subcontractor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getSubcontractor(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const updated = await saveSubcontractor(req.user.userId, req.params.id, req.body, existing);
    res.json(updated);
  } catch (error) {
    console.error('Subcontractor update error:', error);
    res.status(500).json({ error: 'Failed to update subcontractor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getSubcontractor(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    await db.query('DELETE FROM subcontractor_jobs WHERE user_id = $1 AND subcontractor_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM subcontractors WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Subcontractor delete error:', error);
    res.status(500).json({ error: 'Failed to delete subcontractor' });
  }
});

router.post('/:id/insurance', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const document = mapInsuranceDocument({
      id: crypto.randomUUID(),
      ...req.body
    });

    await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      insuranceDocuments: [...subcontractor.insuranceDocuments, document]
    }, subcontractor);

    res.status(201).json(document);
  } catch (error) {
    console.error('Insurance create error:', error);
    res.status(500).json({ error: 'Failed to add insurance document' });
  }
});

router.put('/:id/insurance/:documentId', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const insuranceDocuments = subcontractor.insuranceDocuments.map((document) =>
      document.id === req.params.documentId
        ? mapInsuranceDocument({ ...document, ...req.body })
        : document
    );

    const updated = await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      insuranceDocuments
    }, subcontractor);

    res.json(updated.insuranceDocuments.find((document) => document.id === req.params.documentId));
  } catch (error) {
    console.error('Insurance update error:', error);
    res.status(500).json({ error: 'Failed to update insurance document' });
  }
});

router.delete('/:id/insurance/:documentId', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      insuranceDocuments: subcontractor.insuranceDocuments.filter((document) => document.id !== req.params.documentId)
    }, subcontractor);

    res.json({ success: true });
  } catch (error) {
    console.error('Insurance delete error:', error);
    res.status(500).json({ error: 'Failed to delete insurance document' });
  }
});

router.post('/:id/insurance/:documentId/verify', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const insuranceDocuments = subcontractor.insuranceDocuments.map((document) =>
      document.id === req.params.documentId
        ? mapInsuranceDocument({
            ...document,
            verifiedBy: req.body.verifiedBy,
            verifiedAt: req.body.verifiedAt || new Date().toISOString(),
            status: 'valid'
          })
        : document
    );

    const updated = await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      insuranceDocuments
    }, subcontractor);

    res.json(updated.insuranceDocuments.find((document) => document.id === req.params.documentId));
  } catch (error) {
    console.error('Insurance verify error:', error);
    res.status(500).json({ error: 'Failed to verify insurance document' });
  }
});

router.post('/:id/licenses', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const document = mapLicenseDocument({
      id: crypto.randomUUID(),
      ...req.body
    });

    await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      licenseDocuments: [...subcontractor.licenseDocuments, document]
    }, subcontractor);

    res.status(201).json(document);
  } catch (error) {
    console.error('License create error:', error);
    res.status(500).json({ error: 'Failed to add license document' });
  }
});

router.put('/:id/licenses/:documentId', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const licenseDocuments = subcontractor.licenseDocuments.map((document) =>
      document.id === req.params.documentId
        ? mapLicenseDocument({ ...document, ...req.body })
        : document
    );

    const updated = await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      licenseDocuments
    }, subcontractor);

    res.json(updated.licenseDocuments.find((document) => document.id === req.params.documentId));
  } catch (error) {
    console.error('License update error:', error);
    res.status(500).json({ error: 'Failed to update license document' });
  }
});

router.delete('/:id/licenses/:documentId', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      licenseDocuments: subcontractor.licenseDocuments.filter((document) => document.id !== req.params.documentId)
    }, subcontractor);

    res.json({ success: true });
  } catch (error) {
    console.error('License delete error:', error);
    res.status(500).json({ error: 'Failed to delete license document' });
  }
});

router.post('/:id/licenses/:documentId/verify', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const licenseDocuments = subcontractor.licenseDocuments.map((document) =>
      document.id === req.params.documentId
        ? mapLicenseDocument({
            ...document,
            verifiedBy: req.body.verifiedBy,
            verifiedAt: req.body.verifiedAt || new Date().toISOString(),
            status: 'valid'
          })
        : document
    );

    const updated = await saveSubcontractor(req.user.userId, subcontractor.id, {
      ...subcontractor,
      licenseDocuments
    }, subcontractor);

    res.json(updated.licenseDocuments.find((document) => document.id === req.params.documentId));
  } catch (error) {
    console.error('License verify error:', error);
    res.status(500).json({ error: 'Failed to verify license document' });
  }
});

router.get('/:id/jobs', async (req, res) => {
  try {
    const jobs = await loadJobs(req.user.userId, req.params.id);
    res.json(jobs);
  } catch (error) {
    console.error('Subcontractor jobs list error:', error);
    res.status(500).json({ error: 'Failed to load subcontractor jobs' });
  }
});

router.post('/:id/jobs', async (req, res) => {
  try {
    const subcontractor = await getSubcontractor(req.user.userId, req.params.id);

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();

    await db.query(`
      INSERT INTO subcontractor_jobs (
        id, user_id, subcontractor_id, job_id, job_title, scope_of_work,
        estimated_hours, actual_hours, hourly_rate, total_value, status,
        quoted_at, approved_at, started_at, completed_at, invoiced_at, paid_at,
        quote_url, invoice_url, completion_photos_json, rating, review,
        would_recommend, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25
      )
    `, [
      jobId,
      req.user.userId,
      subcontractor.id,
      req.body.jobId || crypto.randomUUID(),
      req.body.jobTitle || 'Untitled Job',
      req.body.scopeOfWork || 'Subcontracted work',
      numberOrNull(req.body.estimatedHours),
      numberOrNull(req.body.actualHours),
      numberOrNull(req.body.hourlyRate ?? subcontractor.hourlyRate ?? 0),
      numberOrNull(req.body.totalValue ?? 0),
      req.body.status || 'quoted',
      req.body.quotedAt || now,
      req.body.approvedAt || null,
      req.body.startedAt || null,
      req.body.completedAt || null,
      req.body.invoicedAt || null,
      req.body.paidAt || null,
      req.body.quoteUrl || null,
      req.body.invoiceUrl || null,
      JSON.stringify(req.body.completionPhotos || []),
      numberOrNull(req.body.rating),
      req.body.review || null,
      req.body.wouldRecommend === undefined ? null : Number(Boolean(req.body.wouldRecommend)),
      now,
      now
    ]);

    const jobs = await loadJobs(req.user.userId, subcontractor.id);
    res.status(201).json(jobs.find((job) => job.id === jobId));
  } catch (error) {
    console.error('Subcontractor assign job error:', error);
    res.status(500).json({ error: 'Failed to assign subcontractor job' });
  }
});

router.put('/:id/jobs/:jobRowId', async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM subcontractor_jobs WHERE (id = $1 OR job_id = $2) AND subcontractor_id = $3 AND user_id = $4',
      [req.params.jobRowId, req.params.jobRowId, req.params.id, req.user.userId]
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Subcontractor job not found' });
    }

    const row = existing.rows[0];
    const rowId = row.id;
    const status = req.body.status || row.status;
    const now = new Date().toISOString();

    await db.query(`
      UPDATE subcontractor_jobs
      SET job_title = $4,
          scope_of_work = $5,
          estimated_hours = $6,
          actual_hours = $7,
          hourly_rate = $8,
          total_value = $9,
          status = $10,
          quoted_at = $11,
          approved_at = $12,
          started_at = $13,
          completed_at = $14,
          invoiced_at = $15,
          paid_at = $16,
          quote_url = $17,
          invoice_url = $18,
          completion_photos_json = $19,
          review = $20,
          updated_at = $21
      WHERE id = $1 AND subcontractor_id = $2 AND user_id = $3
    `, [
      rowId,
      req.params.id,
      req.user.userId,
      req.body.jobTitle || row.job_title,
      req.body.scopeOfWork || row.scope_of_work,
      numberOrNull(req.body.estimatedHours ?? row.estimated_hours),
      numberOrNull(req.body.actualHours ?? row.actual_hours),
      numberOrNull(req.body.hourlyRate ?? row.hourly_rate),
      numberOrNull(req.body.totalValue ?? row.total_value),
      status,
      req.body.quotedAt || row.quoted_at,
      req.body.approvedAt || (status === 'approved' && !row.approved_at ? now : row.approved_at),
      req.body.startedAt || (status === 'in_progress' && !row.started_at ? now : row.started_at),
      req.body.completedAt || (status === 'completed' && !row.completed_at ? now : row.completed_at),
      req.body.invoicedAt || (status === 'invoiced' && !row.invoiced_at ? now : row.invoiced_at),
      req.body.paidAt || (status === 'paid' && !row.paid_at ? now : row.paid_at),
      req.body.quoteUrl || row.quote_url,
      req.body.invoiceUrl || row.invoice_url,
      JSON.stringify(req.body.completionPhotos || parseJson(row.completion_photos_json, [])),
      req.body.notes || row.review,
      now
    ]);

    const jobs = await loadJobs(req.user.userId, req.params.id);
    res.json(jobs.find((job) => job.id === rowId));
  } catch (error) {
    console.error('Subcontractor job update error:', error);
    res.status(500).json({ error: 'Failed to update subcontractor job' });
  }
});

router.post('/:id/jobs/:jobRowId/rate', async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM subcontractor_jobs WHERE (id = $1 OR job_id = $2) AND subcontractor_id = $3 AND user_id = $4',
      [req.params.jobRowId, req.params.jobRowId, req.params.id, req.user.userId]
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Subcontractor job not found' });
    }

    const rowId = existing.rows[0].id;

    await db.query(`
      UPDATE subcontractor_jobs
      SET rating = $4,
          review = $5,
          would_recommend = $6,
          updated_at = $7
      WHERE id = $1 AND subcontractor_id = $2 AND user_id = $3
    `, [
      rowId,
      req.params.id,
      req.user.userId,
      numberOrNull(req.body.rating),
      req.body.review || null,
      req.body.wouldRecommend === undefined ? null : Number(Boolean(req.body.wouldRecommend)),
      new Date().toISOString()
    ]);

    const jobs = await loadJobs(req.user.userId, req.params.id);
    res.json(jobs.find((job) => job.id === rowId));
  } catch (error) {
    console.error('Subcontractor job rating error:', error);
    res.status(500).json({ error: 'Failed to rate subcontractor job' });
  }
});

export default router;
