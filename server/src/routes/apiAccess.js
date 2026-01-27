import express from 'express';
import crypto from 'crypto';
import pool from '../config/database.js';

const router = express.Router();

// Helper to generate API key
function generateApiKey(environment = 'production') {
  const prefix = environment === 'production' ? 'pp_live_' : 'pp_test_';
  const key = crypto.randomBytes(24).toString('base64url');
  return prefix + key;
}

// Helper to hash API key
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Helper to generate webhook secret
function generateWebhookSecret() {
  return 'whsec_' + crypto.randomBytes(24).toString('base64url');
}

// Available scopes
const AVAILABLE_SCOPES = [
  'inventory:read', 'inventory:write',
  'jobs:read', 'jobs:write',
  'contacts:read', 'contacts:write',
  'quotes:read', 'quotes:write',
  'invoices:read', 'invoices:write',
  'purchase_orders:read', 'purchase_orders:write',
  'reports:read',
  'webhooks:manage'
];

// Available webhook events
const AVAILABLE_EVENTS = [
  'job.created', 'job.updated', 'job.completed', 'job.deleted',
  'quote.created', 'quote.sent', 'quote.accepted', 'quote.rejected',
  'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.overdue',
  'inventory.low_stock', 'inventory.out_of_stock', 'inventory.adjusted',
  'purchase_order.created', 'purchase_order.sent', 'purchase_order.received',
  'contact.created', 'contact.updated',
  'payment.received'
];

// ============ API Keys ============

// Get all API keys for user
router.get('/keys', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];

    const result = await pool.query(`
      SELECT
        id, name, description, key_prefix, scopes,
        rate_limit_per_minute, rate_limit_per_day,
        is_active, last_used_at, last_used_ip,
        expires_at, environment, created_at, updated_at
      FROM api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({ keys: result.rows });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create new API key
router.post('/keys', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const {
      name,
      description,
      scopes = ['inventory:read', 'jobs:read'],
      rateLimitPerMinute = 60,
      rateLimitPerDay = 10000,
      expiresAt,
      environment = 'production'
    } = req.body;

    // Validate scopes
    const invalidScopes = scopes.filter(s => !AVAILABLE_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      return res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(', ')}` });
    }

    // Generate the API key
    const apiKey = generateApiKey(environment);
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12);

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO api_keys (
        user_id, name, description, key_hash, key_prefix,
        scopes, rate_limit_per_minute, rate_limit_per_day,
        expires_at, environment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, description, key_prefix, scopes,
        rate_limit_per_minute, rate_limit_per_day,
        is_active, expires_at, environment, created_at
    `, [
      userId, name, description, keyHash, keyPrefix,
      scopes, rateLimitPerMinute, rateLimitPerDay,
      expiresAt || null, environment
    ]);

    await client.query('COMMIT');

    // Return the full key only once (on creation)
    res.status(201).json({
      ...result.rows[0],
      key: apiKey,  // Only returned on creation!
      message: 'Save this API key securely. It will not be shown again.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating API key:', error);
    if (error.constraint === 'api_keys_user_id_name_key') {
      res.status(400).json({ error: 'An API key with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create API key' });
    }
  } finally {
    client.release();
  }
});

// Update API key
router.put('/keys/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;
    const { name, description, scopes, rateLimitPerMinute, rateLimitPerDay, isActive } = req.body;

    // Build dynamic update
    const updates = [];
    const values = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (scopes !== undefined) {
      const invalidScopes = scopes.filter(s => !AVAILABLE_SCOPES.includes(s));
      if (invalidScopes.length > 0) {
        return res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(', ')}` });
      }
      updates.push(`scopes = $${paramIndex++}`);
      values.push(scopes);
    }
    if (rateLimitPerMinute !== undefined) {
      updates.push(`rate_limit_per_minute = $${paramIndex++}`);
      values.push(rateLimitPerMinute);
    }
    if (rateLimitPerDay !== undefined) {
      updates.push(`rate_limit_per_day = $${paramIndex++}`);
      values.push(rateLimitPerDay);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await pool.query(`
      UPDATE api_keys
      SET ${updates.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, description, key_prefix, scopes,
        rate_limit_per_minute, rate_limit_per_day,
        is_active, expires_at, environment, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Revoke (delete) API key
router.delete('/keys/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM api_keys
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Regenerate API key
router.post('/keys/:id/regenerate', async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    // Get current key to preserve environment
    const existing = await client.query(`
      SELECT environment FROM api_keys WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const environment = existing.rows[0].environment;
    const newKey = generateApiKey(environment);
    const keyHash = hashApiKey(newKey);
    const keyPrefix = newKey.substring(0, 12);

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE api_keys
      SET key_hash = $3, key_prefix = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, key_prefix, created_at
    `, [id, userId, keyHash, keyPrefix]);

    await client.query('COMMIT');

    res.json({
      ...result.rows[0],
      key: newKey,
      message: 'Save this new API key securely. It will not be shown again.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error regenerating API key:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  } finally {
    client.release();
  }
});

// Get API key usage stats
router.get('/keys/:id/stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;
    const { period = '7d' } = req.query;

    // Verify ownership
    const keyCheck = await pool.query(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Calculate date range
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    // Get request stats
    const stats = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(DISTINCT path) as unique_endpoints
      FROM api_request_logs
      WHERE api_key_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [id]);

    // Get top endpoints
    const endpoints = await pool.query(`
      SELECT
        path,
        method,
        COUNT(*) as request_count,
        AVG(response_time_ms)::INTEGER as avg_response_time
      FROM api_request_logs
      WHERE api_key_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY path, method
      ORDER BY request_count DESC
      LIMIT 10
    `, [id]);

    // Get error breakdown
    const errors = await pool.query(`
      SELECT
        error_code,
        COUNT(*) as count
      FROM api_request_logs
      WHERE api_key_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        AND error_code IS NOT NULL
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 10
    `, [id]);

    res.json({
      period,
      dailyStats: stats.rows,
      topEndpoints: endpoints.rows,
      errorBreakdown: errors.rows
    });
  } catch (error) {
    console.error('Error fetching API key stats:', error);
    res.status(500).json({ error: 'Failed to fetch API key stats' });
  }
});

// ============ Webhooks ============

// Get all webhooks for user
router.get('/webhooks', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];

    const result = await pool.query(`
      SELECT
        id, name, description, url, events,
        is_active, retry_on_failure, max_retries, timeout_seconds,
        custom_headers,
        last_triggered_at, last_success_at, last_failure_at,
        success_count, failure_count,
        created_at, updated_at
      FROM webhooks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({ webhooks: result.rows });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Create webhook
router.post('/webhooks', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const {
      name,
      description,
      url,
      events = [],
      retryOnFailure = true,
      maxRetries = 3,
      timeoutSeconds = 30,
      customHeaders = {}
    } = req.body;

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL' });
    }

    // Validate events
    const invalidEvents = events.filter(e => !AVAILABLE_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
    }

    // Generate secret
    const secret = generateWebhookSecret();
    const secretHash = hashApiKey(secret);

    const result = await pool.query(`
      INSERT INTO webhooks (
        user_id, name, description, url, events,
        secret_hash, retry_on_failure, max_retries, timeout_seconds,
        custom_headers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, description, url, events,
        is_active, retry_on_failure, max_retries, timeout_seconds,
        custom_headers, created_at
    `, [
      userId, name, description, url, events,
      secretHash, retryOnFailure, maxRetries, timeoutSeconds,
      JSON.stringify(customHeaders)
    ]);

    // Return secret only once
    res.status(201).json({
      ...result.rows[0],
      secret,
      message: 'Save this webhook secret securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error.constraint === 'webhooks_user_id_name_key') {
      res.status(400).json({ error: 'A webhook with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  }
});

// Update webhook
router.put('/webhooks/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;
    const { name, description, url, events, isActive, retryOnFailure, maxRetries, timeoutSeconds, customHeaders } = req.body;

    // Build dynamic update
    const updates = [];
    const values = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid webhook URL' });
      }
      updates.push(`url = $${paramIndex++}`);
      values.push(url);
    }
    if (events !== undefined) {
      const invalidEvents = events.filter(e => !AVAILABLE_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
      }
      updates.push(`events = $${paramIndex++}`);
      values.push(events);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    if (retryOnFailure !== undefined) {
      updates.push(`retry_on_failure = $${paramIndex++}`);
      values.push(retryOnFailure);
    }
    if (maxRetries !== undefined) {
      updates.push(`max_retries = $${paramIndex++}`);
      values.push(maxRetries);
    }
    if (timeoutSeconds !== undefined) {
      updates.push(`timeout_seconds = $${paramIndex++}`);
      values.push(timeoutSeconds);
    }
    if (customHeaders !== undefined) {
      updates.push(`custom_headers = $${paramIndex++}`);
      values.push(JSON.stringify(customHeaders));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await pool.query(`
      UPDATE webhooks
      SET ${updates.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, name, description, url, events,
        is_active, retry_on_failure, max_retries, timeout_seconds,
        custom_headers, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM webhooks
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Test webhook
router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    // Get webhook
    const webhook = await pool.query(`
      SELECT url, secret_hash, timeout_seconds, custom_headers
      FROM webhooks
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (webhook.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const { url, timeout_seconds, custom_headers } = webhook.rows[0];

    // Create test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from PlumbPro',
        webhook_id: id
      }
    };

    // Simulate webhook delivery (in production, this would actually send the request)
    // For now, just return success
    res.json({
      success: true,
      message: 'Test webhook sent',
      payload: testPayload
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Get webhook delivery history
router.get('/webhooks/:id/deliveries', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify ownership
    const webhookCheck = await pool.query(
      'SELECT id FROM webhooks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (webhookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const result = await pool.query(`
      SELECT
        id, event_type, event_id, status,
        attempt_count, response_status_code, response_time_ms,
        error_message, created_at, delivered_at
      FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = $1',
      [id]
    );

    res.json({
      deliveries: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
});

// Regenerate webhook secret
router.post('/webhooks/:id/regenerate-secret', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const secret = generateWebhookSecret();
    const secretHash = hashApiKey(secret);

    const result = await pool.query(`
      UPDATE webhooks
      SET secret_hash = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, name
    `, [id, userId, secretHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      ...result.rows[0],
      secret,
      message: 'Save this new webhook secret securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Error regenerating webhook secret:', error);
    res.status(500).json({ error: 'Failed to regenerate webhook secret' });
  }
});

// ============ API Documentation ============

// Get available scopes
router.get('/scopes', (req, res) => {
  res.json({
    scopes: AVAILABLE_SCOPES.map(scope => ({
      name: scope,
      description: getScopeDescription(scope)
    }))
  });
});

// Get available webhook events
router.get('/events', (req, res) => {
  res.json({
    events: AVAILABLE_EVENTS.map(event => ({
      name: event,
      description: getEventDescription(event)
    }))
  });
});

// Get API documentation info
router.get('/docs', async (req, res) => {
  try {
    const versions = await pool.query(`
      SELECT version, is_current, is_deprecated, deprecation_date, sunset_date
      FROM api_versions
      ORDER BY version DESC
    `);

    res.json({
      currentVersion: 'v1',
      versions: versions.rows,
      baseUrl: '/api/v1',
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization',
        format: 'Bearer {api_key}'
      },
      rateLimits: {
        default: {
          perMinute: 60,
          perDay: 10000
        }
      },
      endpoints: getEndpointDocs()
    });
  } catch (error) {
    console.error('Error fetching API docs:', error);
    res.status(500).json({ error: 'Failed to fetch API documentation' });
  }
});

// Helper functions
function getScopeDescription(scope) {
  const descriptions = {
    'inventory:read': 'Read inventory items and stock levels',
    'inventory:write': 'Create, update, and delete inventory items',
    'jobs:read': 'Read job details and history',
    'jobs:write': 'Create, update, and manage jobs',
    'contacts:read': 'Read customer and supplier contacts',
    'contacts:write': 'Create and update contacts',
    'quotes:read': 'Read quotes and estimates',
    'quotes:write': 'Create and manage quotes',
    'invoices:read': 'Read invoices and payment status',
    'invoices:write': 'Create and manage invoices',
    'purchase_orders:read': 'Read purchase orders',
    'purchase_orders:write': 'Create and manage purchase orders',
    'reports:read': 'Access analytics and reports',
    'webhooks:manage': 'Manage webhook subscriptions'
  };
  return descriptions[scope] || scope;
}

function getEventDescription(event) {
  const descriptions = {
    'job.created': 'A new job has been created',
    'job.updated': 'A job has been updated',
    'job.completed': 'A job has been marked as completed',
    'job.deleted': 'A job has been deleted',
    'quote.created': 'A new quote has been created',
    'quote.sent': 'A quote has been sent to a customer',
    'quote.accepted': 'A quote has been accepted',
    'quote.rejected': 'A quote has been rejected',
    'invoice.created': 'A new invoice has been created',
    'invoice.sent': 'An invoice has been sent',
    'invoice.paid': 'An invoice has been paid',
    'invoice.overdue': 'An invoice is overdue',
    'inventory.low_stock': 'An item is below reorder level',
    'inventory.out_of_stock': 'An item is out of stock',
    'inventory.adjusted': 'Stock levels have been adjusted',
    'purchase_order.created': 'A purchase order has been created',
    'purchase_order.sent': 'A purchase order has been sent',
    'purchase_order.received': 'A purchase order has been received',
    'contact.created': 'A new contact has been created',
    'contact.updated': 'A contact has been updated',
    'payment.received': 'A payment has been received'
  };
  return descriptions[event] || event;
}

function getEndpointDocs() {
  return {
    inventory: {
      'GET /inventory': 'List all inventory items',
      'GET /inventory/:id': 'Get a specific inventory item',
      'POST /inventory': 'Create a new inventory item',
      'PUT /inventory/:id': 'Update an inventory item',
      'DELETE /inventory/:id': 'Delete an inventory item'
    },
    jobs: {
      'GET /jobs': 'List all jobs',
      'GET /jobs/:id': 'Get a specific job',
      'POST /jobs': 'Create a new job',
      'PUT /jobs/:id': 'Update a job',
      'DELETE /jobs/:id': 'Delete a job'
    },
    contacts: {
      'GET /contacts': 'List all contacts',
      'GET /contacts/:id': 'Get a specific contact',
      'POST /contacts': 'Create a new contact',
      'PUT /contacts/:id': 'Update a contact'
    },
    quotes: {
      'GET /quotes': 'List all quotes',
      'GET /quotes/:id': 'Get a specific quote',
      'POST /quotes': 'Create a new quote',
      'PUT /quotes/:id': 'Update a quote'
    },
    invoices: {
      'GET /invoices': 'List all invoices',
      'GET /invoices/:id': 'Get a specific invoice',
      'POST /invoices': 'Create a new invoice',
      'PUT /invoices/:id': 'Update an invoice'
    }
  };
}

export default router;
