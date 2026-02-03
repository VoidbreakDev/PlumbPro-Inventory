import express from 'express';
import { body, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to convert camelCase to snake_case
const toSnakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Helper to check if a table exists
async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

// Get all contacts with enhanced filtering and search
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { type, status, customerType, search, tags, isVip, limit, offset } = req.query;
    
    // Check if related tables exist (for backward compatibility)
    const hasQuotesTable = await tableExists(client, 'quotes');
    const hasInvoicesTable = await tableExists(client, 'invoices');
    
    let query = `SELECT c.*`;
    
    // Add quote and invoice counts only if tables exist
    if (hasQuotesTable) {
      query += `, (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) as quote_count`;
    } else {
      query += `, 0 as quote_count`;
    }
    
    if (hasInvoicesTable) {
      query += `, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) as invoice_count`;
      query += `, (SELECT COALESCE(SUM(i.amount_due), 0) FROM invoices i WHERE i.customer_id = c.id AND i.status NOT IN ('paid', 'void', 'cancelled')) as outstanding_balance`;
    } else {
      query += `, 0 as invoice_count`;
      query += `, 0 as outstanding_balance`;
    }
    
    query += ` FROM contacts c WHERE c.user_id = $1`;
    
    const params = [req.user.userId];
    let paramCount = 2;

    if (type) {
      query += ` AND c.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (customerType) {
      query += ` AND c.customer_type = $${paramCount}`;
      params.push(customerType);
      paramCount++;
    }

    if (search) {
      query += ` AND (
        c.name ILIKE $${paramCount} OR
        c.company ILIKE $${paramCount} OR
        c.email ILIKE $${paramCount} OR
        c.phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query += ` AND c.tags && $${paramCount}::text[]`;
      params.push(tagArray);
      paramCount++;
    }

    if (isVip === 'true') {
      query += ' AND c.is_vip = true';
    }

    query += ' ORDER BY c.name ASC';

    if (limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
      paramCount++;
    }

    if (offset) {
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset));
      paramCount++;
    }

    const result = await client.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  } finally {
    client.release();
  }
});

// Get customer statistics summary
router.get('/stats', async (req, res) => {
  const client = await pool.connect();

  try {
    // Check if invoices table exists
    const hasInvoicesTable = await tableExists(client, 'invoices');
    
    let query;
    if (hasInvoicesTable) {
      query = `
        SELECT
          COUNT(*) FILTER (WHERE type = 'Customer') as total_customers,
          COUNT(*) FILTER (WHERE type = 'Customer' AND status = 'active') as active_customers,
          COUNT(*) FILTER (WHERE type = 'Customer' AND is_vip = true) as vip_customers,
          COUNT(*) FILTER (WHERE type = 'Supplier') as total_suppliers,
          COUNT(*) FILTER (WHERE type = 'Plumber') as total_plumbers,
          (
            SELECT COALESCE(SUM(i.amount_due), 0)
            FROM invoices i
            JOIN contacts c ON i.customer_id = c.id
            WHERE c.user_id = $1 AND i.status NOT IN ('paid', 'void', 'cancelled')
          ) as total_outstanding,
          (
            SELECT COUNT(*)
            FROM invoices i
            JOIN contacts c ON i.customer_id = c.id
            WHERE c.user_id = $1 AND i.status = 'overdue'
          ) as overdue_invoices_count
        FROM contacts
        WHERE user_id = $1
      `;
    } else {
      query = `
        SELECT
          COUNT(*) FILTER (WHERE type = 'Customer') as total_customers,
          COUNT(*) FILTER (WHERE type = 'Customer' AND status = 'active') as active_customers,
          COUNT(*) FILTER (WHERE type = 'Customer' AND is_vip = true) as vip_customers,
          COUNT(*) FILTER (WHERE type = 'Supplier') as total_suppliers,
          COUNT(*) FILTER (WHERE type = 'Plumber') as total_plumbers,
          0 as total_outstanding,
          0 as overdue_invoices_count
        FROM contacts
        WHERE user_id = $1
      `;
    }
    
    const stats = await client.query(query, [req.user.userId]);
    res.json(stats.rows[0]);

  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({ error: 'Failed to fetch contact statistics' });
  } finally {
    client.release();
  }
});

// Get single contact with full details
router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  } finally {
    client.release();
  }
});

// Get contact with full history (quotes, invoices, jobs, notes)
router.get('/:id/history', async (req, res) => {
  const client = await pool.connect();

  try {
    // Get contact
    const contactResult = await client.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contact = contactResult.rows[0];

    // Get quotes (if table exists)
    let quotesResult = { rows: [] };
    try {
      quotesResult = await client.query(`
        SELECT id, quote_number, title, status, total, created_at, valid_until
        FROM quotes
        WHERE customer_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 20
      `, [req.params.id, req.user.userId]);
    } catch (e) {
      console.log('Quotes query skipped - table may not exist');
    }

    // Get invoices (if table exists)
    let invoicesResult = { rows: [] };
    try {
      invoicesResult = await client.query(`
        SELECT id, invoice_number, title, status, total, amount_paid, amount_due, due_date, created_at
        FROM invoices
        WHERE customer_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 20
      `, [req.params.id, req.user.userId]);
    } catch (e) {
      console.log('Invoices query skipped - table may not exist');
    }

    // Get jobs (if customer_id column exists)
    let jobs = [];
    try {
      const jobsResult = await client.query(`
        SELECT id, title, status, scheduled_date, created_at
        FROM jobs
        WHERE customer_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 20
      `, [req.params.id, req.user.userId]);
      jobs = jobsResult.rows;
    } catch (e) {
      // customer_id might not exist on jobs table yet
      console.log('Jobs query skipped - customer_id column may not exist');
    }

    // Get notes
    let notes = [];
    try {
      const notesResult = await client.query(`
        SELECT cn.*, u.full_name as user_name
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        WHERE cn.contact_id = $1
        ORDER BY cn.created_at DESC
        LIMIT 50
      `, [req.params.id]);
      notes = notesResult.rows;
    } catch (e) {
      // customer_notes table might not exist yet
      console.log('Notes query skipped - table may not exist');
    }

    // Get service agreements
    let serviceAgreements = [];
    try {
      const agreementsResult = await client.query(`
        SELECT *
        FROM service_agreements
        WHERE contact_id = $1 AND user_id = $2
        ORDER BY created_at DESC
      `, [req.params.id, req.user.userId]);
      serviceAgreements = agreementsResult.rows;
    } catch (e) {
      // service_agreements table might not exist yet
      console.log('Service agreements query skipped - table may not exist');
    }

    // Calculate summary statistics
    const stats = {
      totalQuotes: quotesResult.rows.length,
      approvedQuotes: quotesResult.rows.filter(q => q.status === 'approved').length,
      totalQuotesValue: quotesResult.rows.reduce((sum, q) => sum + parseFloat(q.total || 0), 0),
      totalInvoices: invoicesResult.rows.length,
      paidInvoices: invoicesResult.rows.filter(i => i.status === 'paid').length,
      overdueInvoices: invoicesResult.rows.filter(i => i.status === 'overdue').length,
      totalInvoiced: invoicesResult.rows.reduce((sum, i) => sum + parseFloat(i.total || 0), 0),
      totalPaid: invoicesResult.rows.reduce((sum, i) => sum + parseFloat(i.amount_paid || 0), 0),
      outstandingBalance: invoicesResult.rows.reduce((sum, i) => sum + parseFloat(i.amount_due || 0), 0),
      totalJobs: jobs.length,
      activeAgreements: serviceAgreements.filter(a => a.status === 'active').length
    };

    res.json({
      contact,
      quotes: quotesResult.rows,
      invoices: invoicesResult.rows,
      jobs,
      notes,
      serviceAgreements,
      stats
    });

  } catch (error) {
    console.error('Get contact history error:', error);
    res.status(500).json({ error: 'Failed to fetch contact history' });
  } finally {
    client.release();
  }
});

// Create contact with extended fields
router.post('/',
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['Supplier', 'Plumber', 'Customer']),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('phone').optional({ nullable: true }).trim(),
    body('company').optional({ nullable: true }).trim(),
    body('addressStreet').optional({ nullable: true }).trim(),
    body('addressCity').optional({ nullable: true }).trim(),
    body('addressState').optional({ nullable: true }).trim(),
    body('addressPostcode').optional({ nullable: true }).trim(),
    body('abn').optional({ nullable: true }).trim(),
    body('customerType').optional({ nullable: true }).isIn(['residential', 'commercial', 'builder', 'developer', 'government', 'other']),
    body('status').optional({ nullable: true }).isIn(['active', 'inactive', 'blacklisted']),
    body('defaultMarkupPercentage').optional({ nullable: true }).isFloat({ min: 0, max: 1000 }),
    body('defaultDiscountPercentage').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
    body('defaultPaymentTerms').optional({ nullable: true }).isIn(['DUE_ON_RECEIPT', 'NET7', 'NET14', 'NET30', 'NET60', 'CUSTOM']),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        name, type, email, phone, company,
        addressStreet, addressCity, addressState, addressPostcode, addressCountry,
        abn, billingEmail, website,
        primaryContactName, primaryContactPhone, primaryContactEmail,
        customerType, tags, defaultMarkupPercentage, defaultDiscountPercentage,
        defaultPaymentTerms, customPaymentDays, status, isVip, creditLimit,
        internalNotes, preferredContactMethod,
        billingAddressStreet, billingAddressCity, billingAddressState, billingAddressPostcode
      } = req.body;

      const result = await client.query(`
        INSERT INTO contacts (
          user_id, name, type, email, phone, company,
          address_street, address_city, address_state, address_postcode, address_country,
          abn, billing_email, website,
          primary_contact_name, primary_contact_phone, primary_contact_email,
          customer_type, tags, default_markup_percentage, default_discount_percentage,
          default_payment_terms, custom_payment_days, status, is_vip, credit_limit,
          internal_notes, preferred_contact_method,
          billing_address_street, billing_address_city, billing_address_state, billing_address_postcode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
        RETURNING *
      `, [
        req.user.userId, name, type, email || null, phone || null, company || null,
        addressStreet || null, addressCity || null, addressState || null, addressPostcode || null, addressCountry || 'Australia',
        abn || null, billingEmail || null, website || null,
        primaryContactName || null, primaryContactPhone || null, primaryContactEmail || null,
        customerType || 'residential', tags || null, defaultMarkupPercentage || null, defaultDiscountPercentage || null,
        defaultPaymentTerms || 'NET30', customPaymentDays || null, status || 'active', isVip || false, creditLimit || null,
        internalNotes || null, preferredContactMethod || 'email',
        billingAddressStreet || null, billingAddressCity || null, billingAddressState || null, billingAddressPostcode || null
      ]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    } finally {
      client.release();
    }
  }
);

// Update contact with extended fields
router.put('/:id',
  [
    body('name').optional().notEmpty().trim(),
    body('type').optional().isIn(['Supplier', 'Plumber', 'Customer']),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('customerType').optional({ nullable: true }).isIn(['residential', 'commercial', 'builder', 'developer', 'government', 'other']),
    body('status').optional({ nullable: true }).isIn(['active', 'inactive', 'blacklisted']),
    body('defaultPaymentTerms').optional({ nullable: true }).isIn(['DUE_ON_RECEIPT', 'NET7', 'NET14', 'NET30', 'NET60', 'CUSTOM']),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      // Map of allowed fields (camelCase -> snake_case)
      const allowedFields = {
        name: 'name',
        type: 'type',
        email: 'email',
        phone: 'phone',
        company: 'company',
        addressStreet: 'address_street',
        addressCity: 'address_city',
        addressState: 'address_state',
        addressPostcode: 'address_postcode',
        addressCountry: 'address_country',
        abn: 'abn',
        billingEmail: 'billing_email',
        website: 'website',
        primaryContactName: 'primary_contact_name',
        primaryContactPhone: 'primary_contact_phone',
        primaryContactEmail: 'primary_contact_email',
        customerType: 'customer_type',
        tags: 'tags',
        defaultMarkupPercentage: 'default_markup_percentage',
        defaultDiscountPercentage: 'default_discount_percentage',
        defaultPaymentTerms: 'default_payment_terms',
        customPaymentDays: 'custom_payment_days',
        status: 'status',
        isVip: 'is_vip',
        creditLimit: 'credit_limit',
        internalNotes: 'internal_notes',
        preferredContactMethod: 'preferred_contact_method',
        billingAddressStreet: 'billing_address_street',
        billingAddressCity: 'billing_address_city',
        billingAddressState: 'billing_address_state',
        billingAddressPostcode: 'billing_address_postcode'
      };

      const updates = [];
      const values = [];
      let paramCount = 1;

      Object.keys(req.body).forEach(key => {
        if (allowedFields[key]) {
          updates.push(`${allowedFields[key]} = $${paramCount}`);
          values.push(req.body[key]);
          paramCount++;
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const idParam = paramCount;
      const userParam = paramCount + 1;
      values.push(req.params.id);
      values.push(req.user.userId);

      const result = await client.query(`
        UPDATE contacts
        SET ${updates.join(', ')}
        WHERE id = $${idParam} AND user_id = $${userParam}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    } finally {
      client.release();
    }
  }
);

// Delete contact
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  } finally {
    client.release();
  }
});

// ==================== CUSTOMER NOTES ====================

// Get notes for a contact
router.get('/:id/notes', async (req, res) => {
  const client = await pool.connect();

  try {
    // Verify contact belongs to user
    const contactCheck = await client.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const result = await client.query(`
      SELECT cn.*, u.full_name as user_name
      FROM customer_notes cn
      LEFT JOIN users u ON cn.user_id = u.id
      WHERE cn.contact_id = $1
      ORDER BY cn.created_at DESC
    `, [req.params.id]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  } finally {
    client.release();
  }
});

// Add note to contact
router.post('/:id/notes',
  [
    body('content').notEmpty().trim(),
    body('noteType').optional().isIn(['general', 'phone_call', 'email', 'meeting', 'site_visit', 'complaint', 'follow_up']),
    body('subject').optional({ nullable: true }).trim(),
    body('isFollowUpRequired').optional().isBoolean(),
    body('followUpDate').optional({ nullable: true }).isISO8601(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      // Verify contact belongs to user
      const contactCheck = await client.query(
        'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.userId]
      );

      if (contactCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const { content, noteType, subject, isFollowUpRequired, followUpDate } = req.body;

      const result = await client.query(`
        INSERT INTO customer_notes (contact_id, user_id, content, note_type, subject, is_follow_up_required, follow_up_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [req.params.id, req.user.userId, content, noteType || 'general', subject || null, isFollowUpRequired || false, followUpDate || null]);

      // Get with user name
      const noteWithUser = await client.query(`
        SELECT cn.*, u.full_name as user_name
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        WHERE cn.id = $1
      `, [result.rows[0].id]);

      res.status(201).json(noteWithUser.rows[0]);

    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: 'Failed to create note' });
    } finally {
      client.release();
    }
  }
);

// Update note
router.put('/:contactId/notes/:noteId',
  [
    body('content').optional().notEmpty().trim(),
    body('isFollowUpCompleted').optional().isBoolean(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { content, subject, isFollowUpRequired, followUpDate, isFollowUpCompleted } = req.body;

      const result = await client.query(`
        UPDATE customer_notes
        SET content = COALESCE($1, content),
            subject = COALESCE($2, subject),
            is_follow_up_required = COALESCE($3, is_follow_up_required),
            follow_up_date = COALESCE($4, follow_up_date),
            is_follow_up_completed = COALESCE($5, is_follow_up_completed)
        WHERE id = $6 AND user_id = $7
        RETURNING *
      `, [content, subject, isFollowUpRequired, followUpDate, isFollowUpCompleted, req.params.noteId, req.user.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Update note error:', error);
      res.status(500).json({ error: 'Failed to update note' });
    } finally {
      client.release();
    }
  }
);

// Delete note
router.delete('/:contactId/notes/:noteId', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM customer_notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.noteId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  } finally {
    client.release();
  }
});

// ==================== SERVICE AGREEMENTS ====================

// Get service agreements for a contact
router.get('/:id/agreements', async (req, res) => {
  const client = await pool.connect();

  try {
    // Verify contact belongs to user
    const contactCheck = await client.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const result = await client.query(`
      SELECT * FROM service_agreements
      WHERE contact_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `, [req.params.id, req.user.userId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get agreements error:', error);
    res.status(500).json({ error: 'Failed to fetch service agreements' });
  } finally {
    client.release();
  }
});

// Create service agreement
router.post('/:id/agreements',
  [
    body('title').notEmpty().trim(),
    body('agreementType').optional().isIn(['maintenance', 'service', 'warranty', 'support', 'other']),
    body('startDate').notEmpty().isISO8601(),
    body('endDate').optional({ nullable: true }).isISO8601(),
    body('billingFrequency').optional().isIn(['one_time', 'monthly', 'quarterly', 'semi_annual', 'annual']),
    body('billingAmount').optional({ nullable: true }).isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      // Verify contact belongs to user
      const contactCheck = await client.query(
        'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.userId]
      );

      if (contactCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const {
        title, description, agreementType, status, startDate, endDate,
        nextServiceDate, billingFrequency, billingAmount, serviceFrequency,
        includedServices, totalValue, notes
      } = req.body;

      // Generate agreement number
      const agreementNumber = await client.query(
        'SELECT generate_agreement_number($1) as agreement_number',
        [req.user.userId]
      );

      const result = await client.query(`
        INSERT INTO service_agreements (
          user_id, contact_id, agreement_number, title, description,
          agreement_type, status, start_date, end_date, next_service_date,
          billing_frequency, billing_amount, service_frequency, included_services,
          total_value, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        req.user.userId, req.params.id, agreementNumber.rows[0].agreement_number,
        title, description || null, agreementType || 'maintenance', status || 'draft',
        startDate, endDate || null, nextServiceDate || null,
        billingFrequency || 'monthly', billingAmount || null, serviceFrequency || null,
        includedServices || null, totalValue || null, notes || null
      ]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create agreement error:', error);
      res.status(500).json({ error: 'Failed to create service agreement' });
    } finally {
      client.release();
    }
  }
);

// Update service agreement
router.put('/:contactId/agreements/:agreementId',
  [
    body('status').optional().isIn(['draft', 'active', 'expired', 'cancelled', 'pending_renewal']),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const allowedFields = {
        title: 'title',
        description: 'description',
        agreementType: 'agreement_type',
        status: 'status',
        startDate: 'start_date',
        endDate: 'end_date',
        nextServiceDate: 'next_service_date',
        billingFrequency: 'billing_frequency',
        billingAmount: 'billing_amount',
        serviceFrequency: 'service_frequency',
        includedServices: 'included_services',
        totalValue: 'total_value',
        notes: 'notes'
      };

      const updates = [];
      const values = [];
      let paramCount = 1;

      Object.keys(req.body).forEach(key => {
        if (allowedFields[key]) {
          updates.push(`${allowedFields[key]} = $${paramCount}`);
          values.push(req.body[key]);
          paramCount++;
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(req.params.agreementId);
      values.push(req.user.userId);

      const result = await client.query(`
        UPDATE service_agreements
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Service agreement not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('Update agreement error:', error);
      res.status(500).json({ error: 'Failed to update service agreement' });
    } finally {
      client.release();
    }
  }
);

// Delete service agreement
router.delete('/:contactId/agreements/:agreementId', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM service_agreements WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.agreementId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    res.json({ message: 'Service agreement deleted successfully' });

  } catch (error) {
    console.error('Delete agreement error:', error);
    res.status(500).json({ error: 'Failed to delete service agreement' });
  } finally {
    client.release();
  }
});

// ==================== CUSTOMER PRICING ====================

// Get pricing rules for a contact
router.get('/:id/pricing', async (req, res) => {
  const client = await pool.connect();

  try {
    // Verify contact belongs to user
    const contactCheck = await client.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const result = await client.query(`
      SELECT cp.*, ii.name as item_name
      FROM customer_pricing cp
      LEFT JOIN inventory_items ii ON cp.inventory_item_id = ii.id
      WHERE cp.contact_id = $1 AND cp.user_id = $2
      ORDER BY cp.created_at DESC
    `, [req.params.id, req.user.userId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  } finally {
    client.release();
  }
});

// Create pricing rule
router.post('/:id/pricing',
  [
    body('priceType').isIn(['fixed', 'markup', 'discount']),
    body('priceValue').isFloat({ min: 0 }),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      // Verify contact belongs to user
      const contactCheck = await client.query(
        'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.userId]
      );

      if (contactCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const { inventoryItemId, category, priceType, priceValue, validFrom, validUntil, notes } = req.body;

      const result = await client.query(`
        INSERT INTO customer_pricing (user_id, contact_id, inventory_item_id, category, price_type, price_value, valid_from, valid_until, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [req.user.userId, req.params.id, inventoryItemId || null, category || null, priceType, priceValue, validFrom || null, validUntil || null, notes || null]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create pricing error:', error);
      res.status(500).json({ error: 'Failed to create pricing rule' });
    } finally {
      client.release();
    }
  }
);

// Delete pricing rule
router.delete('/:contactId/pricing/:pricingId', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM customer_pricing WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.pricingId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    res.json({ message: 'Pricing rule deleted successfully' });

  } catch (error) {
    console.error('Delete pricing error:', error);
    res.status(500).json({ error: 'Failed to delete pricing rule' });
  } finally {
    client.release();
  }
});

export default router;
