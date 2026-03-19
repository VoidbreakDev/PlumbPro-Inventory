/**
 * Customer Portal Routes
 * Provides read-only access for customers to view quotes, invoices, and job status
 */

import express from 'express';
import pool from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendPortalMagicLinkEmail } from '../services/emailService.js';

const router = express.Router();

// SECURITY: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is required for portal security');
}
const PORTAL_TOKEN_EXPIRY = '24h';
let jobsCustomerIdColumnExists = null;

const shiftSqlParams = (sql, offset) =>
  sql.replace(/\$(\d+)/g, (_, index) => `$${Number(index) + offset}`);

async function hasJobsCustomerIdColumn() {
  if (jobsCustomerIdColumnExists !== null) {
    return jobsCustomerIdColumnExists;
  }

  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'customer_id'
    )`
  );

  jobsCustomerIdColumnExists = result.rows[0]?.exists === true;
  return jobsCustomerIdColumnExists;
}

function getLegacyCustomerIdentifiers({ contactId, name, company }) {
  return Array.from(
    new Set(
      [contactId, name, company]
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

async function getPortalJobScope(portalUser, alias = 'j') {
  const identifiers = getLegacyCustomerIdentifiers(portalUser);
  const hasCustomerId = await hasJobsCustomerIdColumn();

  if (hasCustomerId) {
    if (identifiers.length > 0) {
      return {
        clause: `${alias}.user_id = $1 AND (${alias}.customer_id = $2 OR (${alias}.customer_id IS NULL AND ${alias}.builder = ANY($3::text[])))`,
        values: [portalUser.businessId, portalUser.contactId, identifiers]
      };
    }

    return {
      clause: `${alias}.user_id = $1 AND ${alias}.customer_id = $2`,
      values: [portalUser.businessId, portalUser.contactId]
    };
  }

  if (identifiers.length === 0) {
    throw new Error('Portal user is missing customer identifiers');
  }

  return {
    clause: `${alias}.user_id = $1 AND ${alias}.builder = ANY($2::text[])`,
    values: [portalUser.businessId, identifiers]
  };
}

// Generate magic link token
router.post('/auth/magic-link', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    // Find customer contact
    const contactResult = await pool.query(
      `SELECT c.*, u.id as user_id, u.company_name 
       FROM contacts c
       JOIN users u ON c.user_id = u.id
       WHERE c.email = $1 AND c.type = 'Customer'`,
      [email.toLowerCase()]
    );
    
    if (contactResult.rows.length === 0) {
      // Return success even if not found (security - don't reveal if email exists)
      return res.json({ 
        message: 'If a customer account exists with this email, a magic link has been sent.' 
      });
    }
    
    const contact = contactResult.rows[0];
    
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
    
    // Store token
    await pool.query(
      `INSERT INTO customer_portal_tokens (contact_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [contact.id, token, expiresAt]
    );
    
    // Send magic link via email (production)
    const magicLink = `${process.env.PORTAL_URL || 'http://localhost:5173'}/portal/login?token=${token}`;

    await sendPortalMagicLinkEmail({
      to: contact.email,
      toName: contact.name,
      businessName: contact.company_name,
      magicLink,
      expiresAt
    });

    // SECURITY: Never return the token in the response - send only via email
    // In development, check server logs for the magic link
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV] Magic link for', email, ':', magicLink);
    }

    res.json({
      message: 'If a customer account exists with this email, a magic link has been sent.',
      expiresAt
    });
    
  } catch (error) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Failed to generate magic link' });
  }
});

// Verify magic link token and create session
router.post('/auth/verify', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  try {
    // Find valid token
    const tokenResult = await pool.query(
      `SELECT t.*, c.*, u.id as business_user_id, u.company_name as business_name
       FROM customer_portal_tokens t
       JOIN contacts c ON t.contact_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE t.token = $1 
       AND t.expires_at > NOW()
       AND t.used_at IS NULL`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const data = tokenResult.rows[0];
    
    // Mark token as used
    await pool.query(
      'UPDATE customer_portal_tokens SET used_at = NOW() WHERE id = $1',
      [data.id]
    );
    
    // Create JWT for portal session
    const portalToken = jwt.sign(
      {
        contactId: data.contact_id,
        email: data.email,
        name: data.name,
        company: data.company,
        businessId: data.business_user_id,
        businessName: data.business_name,
        type: 'portal'
      },
      JWT_SECRET,
      { expiresIn: PORTAL_TOKEN_EXPIRY }
    );
    
    res.json({
      token: portalToken,
      customer: {
        id: data.contact_id,
        name: data.name,
        email: data.email,
        businessName: data.business_name
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Portal authentication middleware
const authenticatePortal = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'portal') {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    
    req.portalUser = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get customer dashboard
router.get('/dashboard', authenticatePortal, async (req, res) => {
  const { contactId, businessId } = req.portalUser;
  
  try {
    const jobScope = await getPortalJobScope(req.portalUser);

    // Get summary statistics
    const statsQuery = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM jobs j WHERE ${jobScope.clause}) as total_jobs,
        (SELECT COUNT(*) FROM jobs j WHERE ${jobScope.clause} AND j.status = 'Completed') as completed_jobs,
        (SELECT COUNT(*) FROM jobs j WHERE ${jobScope.clause} AND j.quote_status = 'sent') as pending_quotes,
        (SELECT COUNT(*) FROM invoices WHERE user_id = $${jobScope.values.length + 1} AND contact_id = $${jobScope.values.length + 2} AND status IN ('sent', 'partial', 'overdue')) as unpaid_invoices,
        (SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM invoices WHERE user_id = $${jobScope.values.length + 1} AND contact_id = $${jobScope.values.length + 2} AND status IN ('sent', 'partial', 'overdue')) as outstanding_amount`,
      [...jobScope.values, businessId, contactId]
    );
    
    // Get recent jobs
    const jobsQuery = await pool.query(
      `SELECT j.*, 
        (SELECT json_agg(json_build_object('name', c.name, 'type', c.type))
         FROM job_workers jw 
         JOIN contacts c ON jw.worker_id = c.id 
         WHERE jw.job_id = j.id) as workers
       FROM jobs j
       WHERE ${jobScope.clause}
       ORDER BY j.date DESC
       LIMIT 5`,
      jobScope.values
    );
    
    // Get pending quotes
    const quotesQuery = await pool.query(
      `SELECT j.*,
        (SELECT json_agg(json_build_object(
          'description', qi.description,
          'quantity', qi.quantity,
          'unit_price', qi.unit_price,
          'line_total', qi.line_total
        ))
         FROM quote_items qi
         WHERE qi.job_id = j.id) as items
       FROM jobs j
       WHERE ${jobScope.clause}
       AND j.quote_status IN ('sent', 'draft')
       ORDER BY j.quote_sent_at DESC NULLS LAST`,
      jobScope.values
    );
    
    // Get unpaid invoices
    const invoicesQuery = await pool.query(
      `SELECT i.*,
        (SELECT json_agg(json_build_object(
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'line_total', ii.line_total
        ))
         FROM invoice_items ii
         WHERE ii.invoice_id = i.id) as items
       FROM invoices i
       WHERE i.user_id = $1 
       AND i.contact_id = $2
       AND i.status IN ('sent', 'partial', 'overdue')
       ORDER BY i.due_date ASC`,
      [businessId, contactId]
    );
    
    res.json({
      stats: statsQuery.rows[0],
      recentJobs: jobsQuery.rows,
      pendingQuotes: quotesQuery.rows,
      unpaidInvoices: invoicesQuery.rows
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get all jobs for customer
router.get('/jobs', authenticatePortal, async (req, res) => {
  const { status } = req.query;
  // SECURITY: Validate and constrain limit/offset to prevent resource exhaustion
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 100);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const jobScope = await getPortalJobScope(req.portalUser);
    let query = `
      SELECT j.*, 
        (SELECT json_agg(json_build_object('name', c.name, 'type', c.type))
         FROM job_workers jw 
         JOIN contacts c ON jw.worker_id = c.id 
         WHERE jw.job_id = j.id) as workers
      FROM jobs j
      WHERE ${jobScope.clause}
    `;
    
    const params = [...jobScope.values];
    
    if (status) {
      query += ` AND j.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY j.date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Jobs error:', error);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

// Get single job with details
router.get('/jobs/:id', authenticatePortal, async (req, res) => {
  const { id } = req.params;
  
  try {
    const jobScope = await getPortalJobScope(req.portalUser, 'j');
    const jobResult = await pool.query(
      `SELECT j.*,
        (SELECT json_agg(json_build_object('name', c.name, 'type', c.type, 'phone', c.phone))
         FROM job_workers jw 
         JOIN contacts c ON jw.worker_id = c.id 
         WHERE jw.job_id = j.id) as workers
       FROM jobs j
       WHERE j.id = $1 AND ${shiftSqlParams(jobScope.clause, 1)}`,
      [id, ...jobScope.values]
    );
    
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get allocated items
    const itemsResult = await pool.query(
      `SELECT jai.*, ii.name as item_name
       FROM job_allocated_items jai
       LEFT JOIN inventory_items ii ON jai.item_id = ii.id
       WHERE jai.job_id = $1`,
      [id]
    );
    
    res.json({
      ...jobResult.rows[0],
      items: itemsResult.rows
    });
    
  } catch (error) {
    console.error('Job detail error:', error);
    res.status(500).json({ error: 'Failed to load job details' });
  }
});

// Get all quotes for customer
router.get('/quotes', authenticatePortal, async (req, res) => {
  try {
    const jobScope = await getPortalJobScope(req.portalUser);
    const result = await pool.query(
      `SELECT j.*,
        (SELECT json_agg(json_build_object(
          'description', qi.description,
          'quantity', qi.quantity,
          'unit_price', qi.unit_price,
          'line_total', qi.line_total,
          'item_type', qi.item_type
        ) ORDER BY qi.sort_order)
         FROM quote_items qi
         WHERE qi.job_id = j.id) as items
       FROM jobs j
       WHERE ${jobScope.clause}
       AND j.quote_status IS NOT NULL
       ORDER BY j.quote_sent_at DESC NULLS LAST`,
      jobScope.values
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Quotes error:', error);
    res.status(500).json({ error: 'Failed to load quotes' });
  }
});

// Approve a quote
router.post('/quotes/:id/approve', authenticatePortal, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  try {
    const jobScope = await getPortalJobScope(req.portalUser);

    // Verify quote exists and belongs to customer
    const quoteCheck = await pool.query(
      `SELECT * FROM jobs 
       WHERE id = $1 AND ${shiftSqlParams(jobScope.clause, 1)} AND quote_status = 'sent'`,
      [id, ...jobScope.values]
    );
    
    if (quoteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found or not available for approval' });
    }
    
    // Update quote status
    await pool.query(
      `UPDATE jobs 
       SET quote_status = 'approved', 
           quote_approved_at = NOW(),
           status = 'Scheduled',
           customer_notes = COALESCE(customer_notes || E'\n', '') || $2
       WHERE id = $1 AND ${shiftSqlParams(jobScope.clause, 2)}`,
      [id, notes ? `Quote approved: ${notes}` : 'Quote approved by customer', ...jobScope.values]
    );
    
    res.json({ message: 'Quote approved successfully' });
    
  } catch (error) {
    console.error('Quote approval error:', error);
    res.status(500).json({ error: 'Failed to approve quote' });
  }
});

// Decline a quote
router.post('/quotes/:id/decline', authenticatePortal, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    const jobScope = await getPortalJobScope(req.portalUser);

    // Verify quote exists and belongs to customer
    const quoteCheck = await pool.query(
      `SELECT * FROM jobs 
       WHERE id = $1 AND ${shiftSqlParams(jobScope.clause, 1)} AND quote_status = 'sent'`,
      [id, ...jobScope.values]
    );
    
    if (quoteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found or not available' });
    }
    
    // Update quote status
    await pool.query(
      `UPDATE jobs 
       SET quote_status = 'declined', 
           quote_declined_at = NOW(),
           customer_notes = COALESCE(customer_notes || E'\n', '') || $2
       WHERE id = $1 AND ${shiftSqlParams(jobScope.clause, 2)}`,
      [id, reason ? `Quote declined: ${reason}` : 'Quote declined by customer', ...jobScope.values]
    );
    
    res.json({ message: 'Quote declined' });
    
  } catch (error) {
    console.error('Quote decline error:', error);
    res.status(500).json({ error: 'Failed to decline quote' });
  }
});

// Get all invoices for customer
router.get('/invoices', authenticatePortal, async (req, res) => {
  const { contactId, businessId } = req.portalUser;
  const { status } = req.query;
  
  try {
    let query = `
      SELECT i.*,
        (SELECT json_agg(json_build_object(
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'line_total', ii.line_total,
          'item_type', ii.item_type
        ) ORDER BY ii.sort_order)
         FROM invoice_items ii
         WHERE ii.invoice_id = i.id) as items,
        (SELECT json_agg(json_build_object(
          'amount', p.amount,
          'payment_date', p.payment_date,
          'payment_method', p.payment_method
        ))
         FROM payments p
         WHERE p.invoice_id = i.id) as payments
      FROM invoices i
      WHERE i.user_id = $1 AND i.contact_id = $2
    `;
    
    const params = [businessId, contactId];
    
    if (status) {
      query += ` AND i.status = $3`;
      params.push(status);
    }
    
    query += ` ORDER BY i.issue_date DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Invoices error:', error);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

// Get single invoice
router.get('/invoices/:id', authenticatePortal, async (req, res) => {
  const { contactId, businessId } = req.portalUser;
  const { id } = req.params;
  
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*,
        (SELECT json_agg(json_build_object(
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'line_total', ii.line_total,
          'item_type', ii.item_type
        ) ORDER BY ii.sort_order)
         FROM invoice_items ii
         WHERE ii.invoice_id = i.id) as items,
        (SELECT json_agg(json_build_object(
          'amount', p.amount,
          'payment_date', p.payment_date,
          'payment_method', p.payment_method,
          'reference', p.reference
        ) ORDER BY p.payment_date DESC)
         FROM payments p
         WHERE p.invoice_id = i.id) as payments
       FROM invoices i
       WHERE i.id = $1 AND i.user_id = $2 AND i.contact_id = $3`,
      [id, businessId, contactId]
    );
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoiceResult.rows[0]);
    
  } catch (error) {
    console.error('Invoice detail error:', error);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
});

export default router;
