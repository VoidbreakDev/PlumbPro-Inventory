import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

let ensureTablesPromise = null;

const LEAD_SOURCES = ['website', 'phone', 'referral', 'social_media', 'email', 'walk_in', 'advertisement', 'other'];
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'negotiation', 'won', 'lost', 'on_hold'];

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

const mapCommunication = (row) => ({
  id: row.id,
  leadId: row.lead_id,
  type: row.type,
  method: row.method,
  userId: row.user_id || undefined,
  userName: row.user_name || undefined,
  timestamp: row.timestamp,
  summary: row.summary,
  notes: row.notes || undefined,
  followUpRequired: Boolean(Number(row.follow_up_required || 0)),
  followUpDate: row.follow_up_date || undefined
});

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lead_number TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        company_name TEXT,
        email TEXT,
        phone TEXT NOT NULL,
        address TEXT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        job_type TEXT,
        description TEXT,
        estimated_value REAL,
        estimated_start_date TEXT,
        assigned_to TEXT,
        assigned_to_name TEXT,
        received_at TEXT NOT NULL,
        first_contact_at TEXT,
        last_contact_at TEXT,
        quoted_at TEXT,
        converted_at TEXT,
        lost_reason TEXT,
        lost_reason_detail TEXT,
        quote_id TEXT,
        job_id TEXT,
        customer_id TEXT,
        next_follow_up_date TEXT,
        next_follow_up_type TEXT,
        follow_up_notes TEXT,
        tags_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS lead_communications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        type TEXT NOT NULL,
        method TEXT NOT NULL,
        user_name TEXT,
        timestamp TEXT NOT NULL,
        summary TEXT NOT NULL,
        notes TEXT,
        follow_up_required INTEGER NOT NULL DEFAULT 0,
        follow_up_date TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quote_number TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        job_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        valid_from TEXT,
        valid_until TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        discount_type TEXT,
        discount_value REAL,
        discount_amount REAL,
        tax_rate REAL,
        tax_amount REAL,
        total REAL NOT NULL DEFAULT 0,
        default_markup_percentage REAL,
        terms TEXT,
        notes TEXT,
        customer_notes TEXT,
        requires_approval INTEGER DEFAULT 0,
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        sent_at TEXT,
        viewed_at TEXT,
        responded_at TEXT,
        converted_to_invoice_id TEXT,
        version INTEGER DEFAULT 1,
        parent_quote_id TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'service',
        inventory_item_id TEXT,
        item_name TEXT NOT NULL,
        item_description TEXT,
        item_code TEXT,
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT,
        unit_cost REAL,
        markup_percentage REAL,
        unit_price REAL NOT NULL DEFAULT 0,
        line_total REAL NOT NULL DEFAULT 0,
        profit_margin REAL,
        sort_order INTEGER DEFAULT 0,
        group_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_leads_user_updated ON leads (user_id, updated_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_lead_comms_user_lead ON lead_communications (user_id, lead_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_quotes_user_created ON quotes (user_id, created_at)');
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
};

const loadCommunications = async (userId, leadId = null) => {
  const params = [userId];
  let query = 'SELECT * FROM lead_communications WHERE user_id = $1';

  if (leadId) {
    params.push(leadId);
    query += ` AND lead_id = $${params.length}`;
  }

  query += ' ORDER BY timestamp DESC, created_at DESC';
  const result = await db.query(query, params);
  return result.rows.map(mapCommunication);
};

const loadLeads = async (userId) => {
  const [leadResult, communications] = await Promise.all([
    db.query('SELECT * FROM leads WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC', [userId]),
    loadCommunications(userId)
  ]);

  return leadResult.rows.map((row) => ({
    id: row.id,
    leadNumber: row.lead_number,
    contactName: row.contact_name,
    companyName: row.company_name || undefined,
    email: row.email || undefined,
    phone: row.phone,
    address: row.address || undefined,
    source: row.source,
    status: row.status,
    priority: row.priority,
    jobType: row.job_type || undefined,
    description: row.description || undefined,
    estimatedValue: row.estimated_value !== null && row.estimated_value !== undefined ? Number(row.estimated_value) : undefined,
    estimatedStartDate: row.estimated_start_date || undefined,
    assignedTo: row.assigned_to || undefined,
    assignedToName: row.assigned_to_name || undefined,
    receivedAt: row.received_at,
    firstContactAt: row.first_contact_at || undefined,
    lastContactAt: row.last_contact_at || undefined,
    quotedAt: row.quoted_at || undefined,
    convertedAt: row.converted_at || undefined,
    lostReason: row.lost_reason || undefined,
    lostReasonDetail: row.lost_reason_detail || undefined,
    quoteId: row.quote_id || undefined,
    jobId: row.job_id || undefined,
    customerId: row.customer_id || undefined,
    nextFollowUpDate: row.next_follow_up_date || undefined,
    nextFollowUpType: row.next_follow_up_type || undefined,
    followUpNotes: row.follow_up_notes || undefined,
    communications: communications.filter((communication) => communication.leadId === row.id),
    tags: parseJson(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const getLead = async (userId, leadId) => {
  const leads = await loadLeads(userId);
  return leads.find((lead) => lead.id === leadId) || null;
};

const generateLeadNumber = async (userId) => {
  const year = new Date().getFullYear();
  const result = await db.query('SELECT COUNT(*) AS count FROM leads WHERE user_id = $1', [userId]);
  const count = Number(result.rows[0]?.count || 0) + 1;
  return `LEAD-${year}-${String(count).padStart(3, '0')}`;
};

const generateQuoteNumber = async (userId) => {
  const date = new Date();
  const prefix = `QUO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const result = await db.query('SELECT COUNT(*) AS count FROM quotes WHERE user_id = $1', [userId]);
  const count = Number(result.rows[0]?.count || 0) + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
};

const saveLead = async (userId, leadId, payload, existing = null) => {
  const now = new Date().toISOString();
  const lead = {
    ...existing,
    ...payload,
    id: leadId,
    leadNumber: existing?.leadNumber || payload.leadNumber || await generateLeadNumber(userId),
    source: payload.source || existing?.source || 'other',
    status: payload.status || existing?.status || 'new',
    priority: payload.priority || existing?.priority || 'warm',
    communications: existing?.communications || [],
    tags: payload.tags || existing?.tags || [],
    receivedAt: existing?.receivedAt || payload.receivedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    await db.query(`
      UPDATE leads
      SET lead_number = $3,
          contact_name = $4,
          company_name = $5,
          email = $6,
          phone = $7,
          address = $8,
          source = $9,
          status = $10,
          priority = $11,
          job_type = $12,
          description = $13,
          estimated_value = $14,
          estimated_start_date = $15,
          assigned_to = $16,
          assigned_to_name = $17,
          received_at = $18,
          first_contact_at = $19,
          last_contact_at = $20,
          quoted_at = $21,
          converted_at = $22,
          lost_reason = $23,
          lost_reason_detail = $24,
          quote_id = $25,
          job_id = $26,
          customer_id = $27,
          next_follow_up_date = $28,
          next_follow_up_type = $29,
          follow_up_notes = $30,
          tags_json = $31,
          updated_at = $32
      WHERE user_id = $1 AND id = $2
    `, [
      userId,
      leadId,
      lead.leadNumber,
      lead.contactName,
      lead.companyName || null,
      lead.email || null,
      lead.phone,
      lead.address || null,
      lead.source,
      lead.status,
      lead.priority,
      lead.jobType || null,
      lead.description || null,
      numberOrNull(lead.estimatedValue),
      lead.estimatedStartDate || null,
      lead.assignedTo || null,
      lead.assignedToName || null,
      lead.receivedAt,
      lead.firstContactAt || null,
      lead.lastContactAt || null,
      lead.quotedAt || null,
      lead.convertedAt || null,
      lead.lostReason || null,
      lead.lostReasonDetail || null,
      lead.quoteId || null,
      lead.jobId || null,
      lead.customerId || null,
      lead.nextFollowUpDate || null,
      lead.nextFollowUpType || null,
      lead.followUpNotes || null,
      JSON.stringify(lead.tags || []),
      now
    ]);
  } else {
    await db.query(`
      INSERT INTO leads (
        user_id, id, lead_number, contact_name, company_name, email, phone, address,
        source, status, priority, job_type, description, estimated_value, estimated_start_date,
        assigned_to, assigned_to_name, received_at, first_contact_at, last_contact_at, quoted_at,
        converted_at, lost_reason, lost_reason_detail, quote_id, job_id, customer_id,
        next_follow_up_date, next_follow_up_type, follow_up_notes, tags_json, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33
      )
    `, [
      userId,
      leadId,
      lead.leadNumber,
      lead.contactName,
      lead.companyName || null,
      lead.email || null,
      lead.phone,
      lead.address || null,
      lead.source,
      lead.status,
      lead.priority,
      lead.jobType || null,
      lead.description || null,
      numberOrNull(lead.estimatedValue),
      lead.estimatedStartDate || null,
      lead.assignedTo || null,
      lead.assignedToName || null,
      lead.receivedAt,
      lead.firstContactAt || null,
      lead.lastContactAt || null,
      lead.quotedAt || null,
      lead.convertedAt || null,
      lead.lostReason || null,
      lead.lostReasonDetail || null,
      lead.quoteId || null,
      lead.jobId || null,
      lead.customerId || null,
      lead.nextFollowUpDate || null,
      lead.nextFollowUpType || null,
      lead.followUpNotes || null,
      JSON.stringify(lead.tags || []),
      lead.createdAt,
      lead.updatedAt
    ]);
  }

  return getLead(userId, leadId);
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

router.get('/stats', async (req, res) => {
  try {
    const leads = await loadLeads(req.user.userId);
    const closedLeads = leads.filter((lead) => ['won', 'lost'].includes(lead.status));
    const bySource = Object.fromEntries(LEAD_SOURCES.map((source) => [source, {
      count: 0,
      won: 0,
      conversionRate: 0
    }]));
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status, {
      count: 0,
      value: 0
    }]));

    leads.forEach((lead) => {
      bySource[lead.source].count += 1;
      if (lead.status === 'won') {
        bySource[lead.source].won += 1;
      }
      byStatus[lead.status].count += 1;
      byStatus[lead.status].value += lead.estimatedValue || 0;
    });

    Object.values(bySource).forEach((entry) => {
      entry.conversionRate = entry.count > 0 ? (entry.won / entry.count) * 100 : 0;
    });

    const quotedLeads = leads.filter((lead) => lead.quotedAt);
    const wonLeads = leads.filter((lead) => lead.convertedAt && lead.status === 'won');
    const daysBetween = (from, to) =>
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);

    res.json({
      totalLeads: leads.length,
      newLeads: leads.filter((lead) => lead.status === 'new').length,
      contactedLeads: leads.filter((lead) => lead.status === 'contacted').length,
      quotedLeads: leads.filter((lead) => lead.status === 'quoted').length,
      wonLeads: leads.filter((lead) => lead.status === 'won').length,
      lostLeads: leads.filter((lead) => lead.status === 'lost').length,
      conversionRate: closedLeads.length > 0
        ? (closedLeads.filter((lead) => lead.status === 'won').length / closedLeads.length) * 100
        : 0,
      averageTimeToQuote: quotedLeads.length > 0
        ? quotedLeads.reduce((sum, lead) => sum + daysBetween(lead.receivedAt, lead.quotedAt), 0) / quotedLeads.length
        : 0,
      averageTimeToWin: wonLeads.length > 0
        ? wonLeads.reduce((sum, lead) => sum + daysBetween(lead.receivedAt, lead.convertedAt), 0) / wonLeads.length
        : 0,
      totalPipelineValue: leads
        .filter((lead) => !['won', 'lost'].includes(lead.status))
        .reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0),
      bySource,
      byStatus
    });
  } catch (error) {
    console.error('Lead stats error:', error);
    res.status(500).json({ error: 'Failed to load pipeline statistics' });
  }
});

router.get('/follow-ups/upcoming', async (req, res) => {
  try {
    const days = Math.max(Number(req.query.days) || 7, 1);
    const now = new Date();
    const leads = await loadLeads(req.user.userId);
    const upcoming = leads.filter((lead) => {
      if (!lead.nextFollowUpDate) {
        return false;
      }
      const diffDays = (new Date(lead.nextFollowUpDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= days;
    });
    res.json(upcoming);
  } catch (error) {
    console.error('Lead upcoming follow-ups error:', error);
    res.status(500).json({ error: 'Failed to load upcoming follow-ups' });
  }
});

router.get('/sources', (_req, res) => {
  res.json(LEAD_SOURCES);
});

router.get('/', async (req, res) => {
  try {
    const {
      status,
      source,
      priority,
      assignedTo,
      search,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 100
    } = req.query;

    let leads = await loadLeads(req.user.userId);

    if (status) {
      leads = leads.filter((lead) => lead.status === status);
    }
    if (source) {
      leads = leads.filter((lead) => lead.source === source);
    }
    if (priority) {
      leads = leads.filter((lead) => lead.priority === priority);
    }
    if (assignedTo) {
      leads = leads.filter((lead) => lead.assignedTo === assignedTo);
    }
    if (dateFrom) {
      leads = leads.filter((lead) => new Date(lead.receivedAt) >= new Date(String(dateFrom)));
    }
    if (dateTo) {
      leads = leads.filter((lead) => new Date(lead.receivedAt) <= new Date(String(dateTo)));
    }
    if (search) {
      const normalized = String(search).toLowerCase();
      leads = leads.filter((lead) =>
        lead.contactName.toLowerCase().includes(normalized) ||
        (lead.email || '').toLowerCase().includes(normalized) ||
        lead.phone.toLowerCase().includes(normalized) ||
        lead.leadNumber.toLowerCase().includes(normalized) ||
        (lead.description || '').toLowerCase().includes(normalized)
      );
    }

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericPageSize = Math.max(Number(pageSize) || 100, 1);
    const start = (numericPage - 1) * numericPageSize;

    res.json({
      leads: leads.slice(start, start + numericPageSize),
      total: leads.length,
      page: numericPage,
      pageSize: numericPageSize
    });
  } catch (error) {
    console.error('Leads list error:', error);
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Lead get error:', error);
    res.status(500).json({ error: 'Failed to load lead' });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await saveLead(req.user.userId, crypto.randomUUID(), req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Lead create error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getLead(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await saveLead(req.user.userId, req.params.id, req.body, existing);
    res.json(updated);
  } catch (error) {
    console.error('Lead update error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getLead(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await db.query('DELETE FROM lead_communications WHERE user_id = $1 AND lead_id = $2', [req.user.userId, req.params.id]);
    await db.query('DELETE FROM leads WHERE user_id = $1 AND id = $2', [req.user.userId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Lead delete error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const existing = await getLead(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const now = new Date().toISOString();
    const status = req.body.status;
    const updates = {
      ...existing,
      status,
      lastContactAt: ['contacted', 'qualified', 'quoted', 'negotiation', 'won', 'lost'].includes(status)
        ? now
        : existing.lastContactAt,
      firstContactAt: status === 'contacted' && !existing.firstContactAt ? now : existing.firstContactAt,
      quotedAt: status === 'quoted' && !existing.quotedAt ? now : existing.quotedAt,
      followUpNotes: req.body.notes || existing.followUpNotes
    };

    const updated = await saveLead(req.user.userId, req.params.id, updates, existing);
    res.json(updated);
  } catch (error) {
    console.error('Lead status update error:', error);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

router.patch('/:id/assign', async (req, res) => {
  try {
    const existing = await getLead(req.user.userId, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await saveLead(req.user.userId, req.params.id, {
      ...existing,
      assignedTo: req.body.userId,
      assignedToName: req.body.userName
    }, existing);
    res.json(updated);
  } catch (error) {
    console.error('Lead assign error:', error);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

router.post('/:id/communications', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const now = req.body.timestamp || new Date().toISOString();
    const communicationId = crypto.randomUUID();

    await db.query(`
      INSERT INTO lead_communications (
        id, user_id, lead_id, type, method, user_name, timestamp, summary,
        notes, follow_up_required, follow_up_date, created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12
      )
    `, [
      communicationId,
      req.user.userId,
      req.params.id,
      req.body.type || 'outbound',
      req.body.method || 'other',
      req.body.userName || req.user.fullName || req.user.email || null,
      now,
      req.body.summary || 'Lead communication',
      req.body.notes || null,
      Number(Boolean(req.body.followUpRequired)),
      req.body.followUpDate || null,
      now
    ]);

    await saveLead(req.user.userId, req.params.id, {
      ...lead,
      lastContactAt: now,
      firstContactAt: lead.firstContactAt || now,
      nextFollowUpDate: req.body.followUpDate || lead.nextFollowUpDate,
      nextFollowUpType: req.body.followUpRequired ? req.body.method : lead.nextFollowUpType,
      followUpNotes: req.body.notes || lead.followUpNotes
    }, lead);

    const communications = await loadCommunications(req.user.userId, req.params.id);
    res.status(201).json(communications.find((communication) => communication.id === communicationId));
  } catch (error) {
    console.error('Lead communication create error:', error);
    res.status(500).json({ error: 'Failed to add lead communication' });
  }
});

router.get('/:id/communications', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const communications = await loadCommunications(req.user.userId, req.params.id);
    res.json(communications);
  } catch (error) {
    console.error('Lead communications list error:', error);
    res.status(500).json({ error: 'Failed to load lead communications' });
  }
});

router.post('/:id/follow-up', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await saveLead(req.user.userId, req.params.id, {
      ...lead,
      nextFollowUpDate: req.body.date,
      nextFollowUpType: req.body.type,
      followUpNotes: req.body.notes
    }, lead);

    res.json(updated);
  } catch (error) {
    console.error('Lead follow-up error:', error);
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

router.post('/:id/won', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const now = new Date().toISOString();
    const updated = await saveLead(req.user.userId, req.params.id, {
      ...lead,
      status: 'won',
      jobId: req.body.jobId || lead.jobId,
      customerId: req.body.customerId || lead.customerId,
      convertedAt: now,
      lastContactAt: now,
      followUpNotes: req.body.notes || lead.followUpNotes
    }, lead);

    res.json(updated);
  } catch (error) {
    console.error('Lead mark won error:', error);
    res.status(500).json({ error: 'Failed to mark lead as won' });
  }
});

router.post('/:id/lost', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await saveLead(req.user.userId, req.params.id, {
      ...lead,
      status: 'lost',
      lostReason: req.body.reason || 'other',
      lostReasonDetail: req.body.reasonDetail || undefined,
      lastContactAt: new Date().toISOString()
    }, lead);

    res.json(updated);
  } catch (error) {
    console.error('Lead mark lost error:', error);
    res.status(500).json({ error: 'Failed to mark lead as lost' });
  }
});

router.post('/:id/convert-to-quote', async (req, res) => {
  try {
    const lead = await getLead(req.user.userId, req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const now = new Date().toISOString();
    const quoteId = crypto.randomUUID();
    const quoteNumber = await generateQuoteNumber(req.user.userId);
    const items = Array.isArray(req.body.items) && req.body.items.length > 0
      ? req.body.items
      : [{
          itemName: lead.jobType || 'Lead Quote',
          itemDescription: lead.description || `Quote for ${lead.contactName}`,
          quantity: 1,
          unit: 'EA',
          unitCost: 0,
          unitPrice: lead.estimatedValue || 0,
          itemType: 'service'
        }];
    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unitPrice || item.unit_price || 0)), 0);
    const taxRate = Number(req.body.taxRate ?? 10);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    await db.query(`
      INSERT INTO quotes (
        id, user_id, quote_number, customer_id, customer_name, customer_email,
        customer_phone, customer_address, job_id, title, description, status,
        valid_from, valid_until, subtotal, discount_type, discount_value, discount_amount,
        tax_rate, tax_amount, total, default_markup_percentage, terms, notes,
        customer_notes, requires_approval, approved_by, approved_at, rejection_reason,
        sent_at, viewed_at, responded_at, converted_to_invoice_id, version,
        parent_quote_id, created_by, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34,
        $35, $36, $37, $38
      )
    `, [
      quoteId,
      req.user.userId,
      quoteNumber,
      lead.customerId || null,
      lead.contactName,
      lead.email || null,
      lead.phone || null,
      lead.address || null,
      req.body.jobId || lead.jobId || null,
      req.body.title || `${lead.jobType || 'Service'} Quote`,
      req.body.description || lead.description || null,
      'draft',
      now,
      req.body.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      subtotal,
      req.body.discountType || 'fixed',
      numberOrNull(req.body.discountValue ?? 0),
      numberOrNull(req.body.discountAmount ?? 0),
      taxRate,
      taxAmount,
      total,
      numberOrNull(req.body.defaultMarkupPercentage ?? 0),
      req.body.terms || null,
      req.body.notes || null,
      req.body.customerNotes || lead.description || null,
      Number(Boolean(req.body.requiresApproval)),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      1,
      null,
      req.user.userId,
      now,
      now
    ]);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      const unitCost = Number(item.unitCost ?? item.unit_cost ?? 0);
      const lineTotal = quantity * unitPrice;

      await db.query(`
        INSERT INTO quote_items (
          id, quote_id, item_type, inventory_item_id, item_name, item_description,
          item_code, quantity, unit, unit_cost, markup_percentage, unit_price,
          line_total, profit_margin, sort_order, group_name, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18
        )
      `, [
        crypto.randomUUID(),
        quoteId,
        item.itemType || item.item_type || 'service',
        item.inventoryItemId || item.inventory_item_id || null,
        item.itemName || item.item_name || 'Line Item',
        item.itemDescription || item.item_description || null,
        item.itemCode || item.item_code || null,
        quantity,
        item.unit || 'EA',
        unitCost,
        numberOrNull(item.markupPercentage ?? item.markup_percentage ?? 0),
        unitPrice,
        lineTotal,
        lineTotal - (quantity * unitCost),
        index,
        item.groupName || item.group_name || null,
        now,
        now
      ]);
    }

    const updatedLead = await saveLead(req.user.userId, req.params.id, {
      ...lead,
      status: 'quoted',
      quoteId,
      quotedAt: now,
      lastContactAt: now
    }, lead);

    res.json({
      lead: updatedLead,
      quote: {
        id: quoteId,
        quoteNumber,
        status: 'draft',
        total
      }
    });
  } catch (error) {
    console.error('Lead convert to quote error:', error);
    res.status(500).json({ error: 'Failed to convert lead to quote' });
  }
});

export default router;
