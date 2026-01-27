/**
 * Xero Integration Routes
 * Phase 3: Accounting software integration
 *
 * Handles OAuth flow, contact sync, and invoice sync with Xero
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Xero API endpoints
const XERO_IDENTITY_URL = 'https://identity.xero.com';
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0';

// Get Xero credentials from environment
const getXeroConfig = () => ({
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUri: process.env.XERO_REDIRECT_URI || 'http://localhost:5001/api/xero/callback',
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'accounting.contacts',
    'accounting.transactions',
    'accounting.settings.read'
  ]
});

// ==========================================
// OAUTH FLOW
// ==========================================

/**
 * GET /api/xero/auth-url
 * Generate OAuth authorization URL
 */
router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    const config = getXeroConfig();

    if (!config.clientId) {
      return res.status(400).json({
        error: 'Xero not configured',
        details: 'XERO_CLIENT_ID environment variable is not set'
      });
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session (in production, use Redis or similar)
    // For now, we'll encode the user ID in the state
    const stateData = Buffer.from(JSON.stringify({
      userId: req.user.userId,
      random: state
    })).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state: stateData
    });

    const authUrl = `${XERO_IDENTITY_URL}/connect/authorize?${params.toString()}`;

    res.json({ authUrl, state: stateData });
  } catch (error) {
    console.error('Generate auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/xero/callback
 * OAuth callback handler
 */
router.get('/callback', async (req, res) => {
  const client = await pool.connect();

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_error=missing_params`);
    }

    // Decode state to get user ID
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_error=invalid_state`);
    }

    const userId = stateData.userId;
    const config = getXeroConfig();

    // Exchange code for tokens
    const tokenResponse = await fetch(`${XERO_IDENTITY_URL}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    // Get tenant (organization) info
    const connectionsResponse = await fetch(`${XERO_API_URL}/../connections`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    let tenantId = null;
    let tenantName = null;
    let tenantType = null;

    if (connectionsResponse.ok) {
      const connections = await connectionsResponse.json();
      if (connections.length > 0) {
        // Use the first organization
        tenantId = connections[0].tenantId;
        tenantName = connections[0].tenantName;
        tenantType = connections[0].tenantType;
      }
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    await client.query('BEGIN');

    // Upsert connection
    await client.query(`
      INSERT INTO xero_connections (
        user_id, access_token, refresh_token, id_token, token_type,
        expires_at, tenant_id, tenant_name, tenant_type, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        id_token = EXCLUDED.id_token,
        token_type = EXCLUDED.token_type,
        expires_at = EXCLUDED.expires_at,
        tenant_id = EXCLUDED.tenant_id,
        tenant_name = EXCLUDED.tenant_name,
        tenant_type = EXCLUDED.tenant_type,
        is_active = true,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.id_token || null,
      tokens.token_type || 'Bearer',
      expiresAt,
      tenantId,
      tenantName,
      tenantType
    ]);

    // Log the connection
    await client.query(`
      INSERT INTO xero_sync_logs (user_id, sync_type, sync_direction, status, started_at, completed_at)
      VALUES ($1, 'connection', 'bidirectional', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [userId]);

    await client.query('COMMIT');

    // Redirect to settings with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_connected=true`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?xero_error=callback_failed`);
  } finally {
    client.release();
  }
});

/**
 * GET /api/xero/status
 * Get current Xero connection status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT
        id, tenant_id, tenant_name, tenant_type,
        is_active, last_sync_at, last_error,
        auto_sync_contacts, auto_sync_invoices, sync_frequency_minutes,
        default_account_code, default_tax_type,
        expires_at, created_at, updated_at
      FROM xero_connections
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        connected: false,
        connection: null
      });
    }

    const connection = result.rows[0];
    const isExpired = new Date(connection.expires_at) < new Date();

    res.json({
      connected: connection.is_active && !isExpired,
      connection: {
        id: connection.id,
        tenantId: connection.tenant_id,
        tenantName: connection.tenant_name,
        tenantType: connection.tenant_type,
        isActive: connection.is_active,
        isExpired,
        lastSyncAt: connection.last_sync_at,
        lastError: connection.last_error,
        settings: {
          autoSyncContacts: connection.auto_sync_contacts,
          autoSyncInvoices: connection.auto_sync_invoices,
          syncFrequencyMinutes: connection.sync_frequency_minutes,
          defaultAccountCode: connection.default_account_code,
          defaultTaxType: connection.default_tax_type
        },
        connectedAt: connection.created_at,
        updatedAt: connection.updated_at
      }
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get Xero connection status' });
  }
});

/**
 * POST /api/xero/disconnect
 * Disconnect from Xero
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    await pool.query(`
      UPDATE xero_connections
      SET is_active = false,
          access_token = NULL,
          refresh_token = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [userId]);

    res.json({ message: 'Disconnected from Xero' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect from Xero' });
  }
});

/**
 * PUT /api/xero/settings
 * Update Xero sync settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      autoSyncContacts,
      autoSyncInvoices,
      syncFrequencyMinutes,
      defaultAccountCode,
      defaultTaxType
    } = req.body;

    const result = await pool.query(`
      UPDATE xero_connections
      SET
        auto_sync_contacts = COALESCE($2, auto_sync_contacts),
        auto_sync_invoices = COALESCE($3, auto_sync_invoices),
        sync_frequency_minutes = COALESCE($4, sync_frequency_minutes),
        default_account_code = COALESCE($5, default_account_code),
        default_tax_type = COALESCE($6, default_tax_type),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `, [userId, autoSyncContacts, autoSyncInvoices, syncFrequencyMinutes, defaultAccountCode, defaultTaxType]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Xero connection not found' });
    }

    res.json({ message: 'Settings updated', settings: result.rows[0] });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

/**
 * Helper: Get valid access token (refresh if needed)
 */
async function getValidToken(userId) {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT * FROM xero_connections WHERE user_id = $1 AND is_active = true
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('No active Xero connection');
    }

    const connection = result.rows[0];
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();

    // If token is still valid (with 5 minute buffer), return it
    if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      return {
        accessToken: connection.access_token,
        tenantId: connection.tenant_id
      };
    }

    // Refresh the token
    const config = getXeroConfig();
    const response = await fetch(`${XERO_IDENTITY_URL}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token
      })
    });

    if (!response.ok) {
      // Mark connection as inactive
      await client.query(`
        UPDATE xero_connections
        SET is_active = false, last_error = 'Token refresh failed'
        WHERE user_id = $1
      `, [userId]);
      throw new Error('Failed to refresh Xero token');
    }

    const tokens = await response.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Update tokens
    await client.query(`
      UPDATE xero_connections
      SET access_token = $2,
          refresh_token = $3,
          expires_at = $4,
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [userId, tokens.access_token, tokens.refresh_token, newExpiresAt]);

    return {
      accessToken: tokens.access_token,
      tenantId: connection.tenant_id
    };
  } finally {
    client.release();
  }
}

/**
 * Helper: Make authenticated Xero API request
 */
async function xeroRequest(userId, endpoint, options = {}) {
  const { accessToken, tenantId } = await getValidToken(userId);

  const response = await fetch(`${XERO_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ==========================================
// CONTACT SYNC
// ==========================================

/**
 * POST /api/xero/sync/contacts
 * Sync contacts to Xero
 */
router.post('/sync/contacts', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { contactIds } = req.body; // Optional: specific contacts to sync

    await client.query('BEGIN');

    // Log sync start
    const logResult = await client.query(`
      INSERT INTO xero_sync_logs (user_id, sync_type, sync_direction, status, started_at)
      VALUES ($1, 'contacts', 'to_xero', 'in_progress', CURRENT_TIMESTAMP)
      RETURNING id
    `, [userId]);
    const logId = logResult.rows[0].id;

    // Get contacts to sync
    let contactQuery = `
      SELECT c.*, xm.xero_id as existing_xero_id
      FROM contacts c
      LEFT JOIN xero_entity_mappings xm ON xm.plumbpro_id = c.id
        AND xm.user_id = c.user_id AND xm.entity_type = 'contact'
      WHERE c.user_id = $1
    `;
    const params = [userId];

    if (contactIds && contactIds.length > 0) {
      contactQuery += ` AND c.id = ANY($2)`;
      params.push(contactIds);
    }

    const contactsResult = await client.query(contactQuery, params);

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const contact of contactsResult.rows) {
      try {
        // Format contact for Xero
        const xeroContact = {
          Name: contact.company || contact.name,
          FirstName: contact.name.split(' ')[0],
          LastName: contact.name.split(' ').slice(1).join(' ') || '',
          EmailAddress: contact.email,
          Phones: contact.phone ? [{
            PhoneType: 'DEFAULT',
            PhoneNumber: contact.phone
          }] : [],
          Addresses: contact.address_street ? [{
            AddressType: 'STREET',
            AddressLine1: contact.address_street,
            City: contact.address_city,
            Region: contact.address_state,
            PostalCode: contact.address_postcode,
            Country: contact.address_country || 'Australia'
          }] : [],
          ContactStatus: contact.status === 'active' ? 'ACTIVE' : 'ARCHIVED',
          IsCustomer: contact.type === 'Customer',
          IsSupplier: contact.type === 'Supplier'
        };

        let xeroId;
        if (contact.existing_xero_id) {
          // Update existing contact
          xeroContact.ContactID = contact.existing_xero_id;
          await xeroRequest(userId, '/Contacts', {
            method: 'POST',
            body: JSON.stringify({ Contacts: [xeroContact] })
          });
          xeroId = contact.existing_xero_id;
          updated++;
        } else {
          // Create new contact
          const result = await xeroRequest(userId, '/Contacts', {
            method: 'PUT',
            body: JSON.stringify({ Contacts: [xeroContact] })
          });
          xeroId = result.Contacts[0].ContactID;
          created++;

          // Create mapping
          await client.query(`
            INSERT INTO xero_entity_mappings (user_id, entity_type, plumbpro_id, xero_id, last_synced_at)
            VALUES ($1, 'contact', $2, $3, CURRENT_TIMESTAMP)
          `, [userId, contact.id, xeroId]);
        }

        // Update mapping sync time
        await client.query(`
          UPDATE xero_entity_mappings
          SET last_synced_at = CURRENT_TIMESTAMP, sync_status = 'synced'
          WHERE user_id = $1 AND plumbpro_id = $2 AND entity_type = 'contact'
        `, [userId, contact.id]);

      } catch (err) {
        failed++;
        errors.push({ contactId: contact.id, error: err.message });
      }
    }

    // Update sync log
    await client.query(`
      UPDATE xero_sync_logs
      SET status = $2, records_processed = $3, records_created = $4,
          records_updated = $5, records_failed = $6, error_details = $7,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [
      logId,
      failed > 0 ? 'partial' : 'completed',
      contactsResult.rows.length,
      created,
      updated,
      failed,
      errors.length > 0 ? JSON.stringify(errors) : null
    ]);

    // Update last sync time
    await client.query(`
      UPDATE xero_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = $1
    `, [userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      summary: {
        processed: contactsResult.rows.length,
        created,
        updated,
        failed
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Contact sync error:', error);
    res.status(500).json({ error: 'Failed to sync contacts', details: error.message });
  } finally {
    client.release();
  }
});

// ==========================================
// INVOICE SYNC
// ==========================================

/**
 * POST /api/xero/sync/invoices
 * Sync invoices to Xero
 */
router.post('/sync/invoices', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { invoiceIds } = req.body; // Optional: specific invoices to sync

    await client.query('BEGIN');

    // Log sync start
    const logResult = await client.query(`
      INSERT INTO xero_sync_logs (user_id, sync_type, sync_direction, status, started_at)
      VALUES ($1, 'invoices', 'to_xero', 'in_progress', CURRENT_TIMESTAMP)
      RETURNING id
    `, [userId]);
    const logId = logResult.rows[0].id;

    // Get Xero settings
    const settingsResult = await client.query(`
      SELECT default_account_code, default_tax_type FROM xero_connections WHERE user_id = $1
    `, [userId]);
    const settings = settingsResult.rows[0] || {};

    // Get invoices to sync (only sent, viewed, partially_paid, paid)
    let invoiceQuery = `
      SELECT
        i.*,
        xm.xero_id as existing_xero_id,
        cm.xero_id as customer_xero_id,
        c.name as customer_name,
        c.email as customer_email
      FROM invoices i
      LEFT JOIN xero_entity_mappings xm ON xm.plumbpro_id = i.id
        AND xm.user_id = i.user_id AND xm.entity_type = 'invoice'
      LEFT JOIN contacts c ON i.customer_id = c.id
      LEFT JOIN xero_entity_mappings cm ON cm.plumbpro_id = c.id
        AND cm.user_id = i.user_id AND cm.entity_type = 'contact'
      WHERE i.user_id = $1 AND i.status IN ('sent', 'viewed', 'partially_paid', 'paid')
    `;
    const params = [userId];

    if (invoiceIds && invoiceIds.length > 0) {
      invoiceQuery += ` AND i.id = ANY($2)`;
      params.push(invoiceIds);
    }

    const invoicesResult = await client.query(invoiceQuery, params);

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const invoice of invoicesResult.rows) {
      try {
        // Get invoice items
        const itemsResult = await client.query(`
          SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order
        `, [invoice.id]);

        // Map status
        let xeroStatus;
        switch (invoice.status) {
          case 'draft': xeroStatus = 'DRAFT'; break;
          case 'sent':
          case 'viewed': xeroStatus = 'AUTHORISED'; break;
          case 'partially_paid':
          case 'paid': xeroStatus = 'AUTHORISED'; break;
          case 'void': xeroStatus = 'VOIDED'; break;
          default: xeroStatus = 'DRAFT';
        }

        // Format invoice for Xero
        const xeroInvoice = {
          Type: 'ACCREC', // Accounts Receivable (Sales Invoice)
          InvoiceNumber: invoice.invoice_number,
          Reference: invoice.title,
          Contact: invoice.customer_xero_id
            ? { ContactID: invoice.customer_xero_id }
            : { Name: invoice.customer_name || 'Unknown Customer' },
          Date: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          DueDate: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : undefined,
          Status: xeroStatus,
          LineAmountTypes: 'Exclusive', // Amounts are exclusive of tax
          LineItems: itemsResult.rows.map(item => ({
            Description: item.item_name + (item.item_description ? `\n${item.item_description}` : ''),
            Quantity: item.quantity,
            UnitAmount: item.unit_price,
            AccountCode: settings.default_account_code || '200', // Default to Sales account
            TaxType: item.is_taxable ? (settings.default_tax_type || 'OUTPUT') : 'NONE'
          }))
        };

        // Add discount as negative line item if present
        if (invoice.discount_amount && invoice.discount_amount > 0) {
          xeroInvoice.LineItems.push({
            Description: 'Discount',
            Quantity: 1,
            UnitAmount: -invoice.discount_amount,
            AccountCode: settings.default_account_code || '200',
            TaxType: 'NONE'
          });
        }

        let xeroId;
        if (invoice.existing_xero_id) {
          // Update existing invoice
          xeroInvoice.InvoiceID = invoice.existing_xero_id;
          await xeroRequest(userId, '/Invoices', {
            method: 'POST',
            body: JSON.stringify({ Invoices: [xeroInvoice] })
          });
          xeroId = invoice.existing_xero_id;
          updated++;
        } else {
          // Create new invoice
          const result = await xeroRequest(userId, '/Invoices', {
            method: 'PUT',
            body: JSON.stringify({ Invoices: [xeroInvoice] })
          });
          xeroId = result.Invoices[0].InvoiceID;
          created++;

          // Create mapping
          await client.query(`
            INSERT INTO xero_entity_mappings (user_id, entity_type, plumbpro_id, xero_id, last_synced_at)
            VALUES ($1, 'invoice', $2, $3, CURRENT_TIMESTAMP)
          `, [userId, invoice.id, xeroId]);
        }

        // Update mapping sync time
        await client.query(`
          UPDATE xero_entity_mappings
          SET last_synced_at = CURRENT_TIMESTAMP, sync_status = 'synced'
          WHERE user_id = $1 AND plumbpro_id = $2 AND entity_type = 'invoice'
        `, [userId, invoice.id]);

      } catch (err) {
        failed++;
        errors.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, error: err.message });
      }
    }

    // Update sync log
    await client.query(`
      UPDATE xero_sync_logs
      SET status = $2, records_processed = $3, records_created = $4,
          records_updated = $5, records_failed = $6, error_details = $7,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [
      logId,
      failed > 0 ? 'partial' : 'completed',
      invoicesResult.rows.length,
      created,
      updated,
      failed,
      errors.length > 0 ? JSON.stringify(errors) : null
    ]);

    // Update last sync time
    await client.query(`
      UPDATE xero_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = $1
    `, [userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      summary: {
        processed: invoicesResult.rows.length,
        created,
        updated,
        failed
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invoice sync error:', error);
    res.status(500).json({ error: 'Failed to sync invoices', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/xero/sync/invoice/:id
 * Sync a single invoice to Xero
 */
router.post('/sync/invoice/:id', authenticateToken, async (req, res) => {
  try {
    // Delegate to the batch sync with single ID
    req.body.invoiceIds = [req.params.id];

    // Forward to the batch endpoint logic
    const response = await new Promise((resolve, reject) => {
      const mockRes = {
        json: (data) => resolve(data),
        status: (code) => ({ json: (data) => reject({ code, data }) })
      };
      router.handle({ ...req, url: '/sync/invoices' }, mockRes, () => {});
    });

    res.json(response);
  } catch (error) {
    console.error('Single invoice sync error:', error);
    res.status(error.code || 500).json(error.data || { error: 'Failed to sync invoice' });
  }
});

// ==========================================
// SYNC HISTORY
// ==========================================

/**
 * GET /api/xero/sync-history
 * Get sync history
 */
router.get('/sync-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT *
      FROM xero_sync_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM xero_sync_logs WHERE user_id = $1
    `, [userId]);

    res.json({
      logs: result.rows.map(row => ({
        id: row.id,
        syncType: row.sync_type,
        syncDirection: row.sync_direction,
        status: row.status,
        recordsProcessed: row.records_processed,
        recordsCreated: row.records_created,
        recordsUpdated: row.records_updated,
        recordsFailed: row.records_failed,
        errorMessage: row.error_message,
        errorDetails: row.error_details,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at
      })),
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({ error: 'Failed to get sync history' });
  }
});

/**
 * GET /api/xero/mappings
 * Get entity mappings
 */
router.get('/mappings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { entityType } = req.query;

    let query = `
      SELECT * FROM xero_entity_mappings WHERE user_id = $1
    `;
    const params = [userId];

    if (entityType) {
      query += ` AND entity_type = $2`;
      params.push(entityType);
    }

    query += ` ORDER BY last_synced_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json({
      mappings: result.rows.map(row => ({
        id: row.id,
        entityType: row.entity_type,
        plumbproId: row.plumbpro_id,
        xeroId: row.xero_id,
        lastSyncedAt: row.last_synced_at,
        syncStatus: row.sync_status,
        metadata: row.metadata
      }))
    });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ error: 'Failed to get entity mappings' });
  }
});

export default router;
