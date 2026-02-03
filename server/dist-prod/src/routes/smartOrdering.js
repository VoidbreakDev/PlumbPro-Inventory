/**
 * Smart Ordering System - Phase 3
 * Advanced reorder alerts, usage patterns, and predictive ordering
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getProviderKey } from '../services/aiKeyService.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
router.use(authenticateToken);

// ==========================================
// REORDER ALERTS
// ==========================================

/**
 * GET /api/smart-ordering/alerts
 * Get all pending reorder alerts
 */
router.get('/alerts', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { status, priority, item_id } = req.query;

    let query = `
      SELECT
        ra.*,
        i.name as item_name,
        i.category as item_category,
        i.sku,
        i.price as unit_price,
        c.name as suggested_supplier_name,
        rr.lead_time_days,
        rr.min_order_quantity,
        rr.order_multiple
      FROM reorder_alerts ra
      JOIN inventory_items i ON ra.item_id = i.id
      LEFT JOIN contacts c ON ra.suggested_supplier_id = c.id
      LEFT JOIN reorder_rules rr ON ra.item_id = rr.item_id AND ra.user_id = rr.user_id
      WHERE ra.user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    if (status) {
      query += ` AND ra.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    } else {
      query += ` AND ra.status IN ('pending', 'acknowledged')`;
    }

    if (priority) {
      query += ` AND ra.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    if (item_id) {
      query += ` AND ra.item_id = $${paramCount}`;
      params.push(item_id);
      paramCount++;
    }

    query += ` ORDER BY
      CASE ra.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      ra.created_at DESC
      LIMIT 100`;

    const result = await client.query(query, params);

    res.json({
      alerts: result.rows.map(row => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name,
        itemCategory: row.item_category,
        sku: row.sku,
        alertType: row.alert_type,
        priority: row.priority,
        currentQuantity: row.current_quantity,
        availableQuantity: row.available_quantity,
        allocatedQuantity: row.allocated_quantity,
        onOrderQuantity: row.on_order_quantity,
        reorderPoint: row.reorder_point,
        suggestedQuantity: row.suggested_quantity,
        suggestedSupplierId: row.suggested_supplier_id,
        suggestedSupplierName: row.suggested_supplier_name,
        estimatedCost: row.suggested_quantity * row.unit_price,
        leadTimeDays: row.lead_time_days,
        status: row.status,
        createdAt: row.created_at,
        acknowledgedAt: row.acknowledged_at
      })),
      summary: {
        critical: result.rows.filter(r => r.priority === 'critical').length,
        high: result.rows.filter(r => r.priority === 'high').length,
        normal: result.rows.filter(r => r.priority === 'normal').length,
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch reorder alerts' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/smart-ordering/alerts/:id/acknowledge
 * Acknowledge a reorder alert
 */
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE reorder_alerts
      SET status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $1 AND status = 'pending'
      RETURNING *
    `, [userId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or already processed' });
    }

    res.json({ message: 'Alert acknowledged', alert: result.rows[0] });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * POST /api/smart-ordering/alerts/:id/dismiss
 * Dismiss a reorder alert
 */
router.post('/alerts/:id/dismiss', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE reorder_alerts
      SET status = 'dismissed',
          resolution_notes = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3 AND status IN ('pending', 'acknowledged')
      RETURNING *
    `, [reason || 'Dismissed by user', id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or already processed' });
    }

    res.json({ message: 'Alert dismissed', alert: result.rows[0] });
  } catch (error) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

/**
 * POST /api/smart-ordering/alerts/:id/create-po
 * Create a purchase order from an alert
 */
router.post('/alerts/:id/create-po', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const { supplier_id, quantity } = req.body;

    // Get alert details
    const alertResult = await client.query(`
      SELECT ra.*, i.name as item_name, i.price as unit_price
      FROM reorder_alerts ra
      JOIN inventory_items i ON ra.item_id = i.id
      WHERE ra.id = $1 AND ra.user_id = $2
    `, [id, userId]);

    if (alertResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];
    const orderQty = quantity || alert.suggested_quantity;
    const supplierId = supplier_id || alert.suggested_supplier_id;

    // Create purchase order
    const poResult = await client.query(`
      INSERT INTO purchase_orders (user_id, supplier_id, notes, created_by)
      VALUES ($1, $2, $3, $1)
      RETURNING *
    `, [userId, supplierId, `Created from reorder alert for ${alert.item_name}`]);

    const po = poResult.rows[0];

    // Add line item
    await client.query(`
      INSERT INTO purchase_order_items (
        purchase_order_id, inventory_item_id, item_name,
        quantity_ordered, unit_price, line_total
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [po.id, alert.item_id, alert.item_name, orderQty, alert.unit_price, orderQty * alert.unit_price]);

    // Update alert status
    await client.query(`
      UPDATE reorder_alerts
      SET status = 'ordered',
          purchase_order_id = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [po.id, id]);

    // Update reorder rule last ordered
    await client.query(`
      UPDATE reorder_rules
      SET last_ordered_at = CURRENT_TIMESTAMP
      WHERE item_id = $1 AND user_id = $2
    `, [alert.item_id, userId]);

    await client.query('COMMIT');

    res.json({
      message: 'Purchase order created',
      purchaseOrder: po
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create PO from alert error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// ==========================================
// REORDER RULES
// ==========================================

/**
 * GET /api/smart-ordering/rules
 * Get all reorder rules
 */
router.get('/rules', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const result = await client.query(`
      SELECT
        rr.*,
        i.name as item_name,
        i.category as item_category,
        i.quantity as current_quantity,
        i.sku,
        c.name as preferred_supplier_name
      FROM reorder_rules rr
      JOIN inventory_items i ON rr.item_id = i.id
      LEFT JOIN contacts c ON rr.preferred_supplier_id = c.id
      WHERE rr.user_id = $1 AND rr.is_active = true
      ORDER BY i.name
    `, [userId]);

    res.json(result.rows.map(row => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      itemCategory: row.item_category,
      sku: row.sku,
      currentQuantity: row.current_quantity,
      reorderPoint: row.reorder_point,
      reorderQuantity: row.reorder_quantity,
      maxStockLevel: row.max_stock_level,
      minOrderQuantity: row.min_order_quantity,
      orderMultiple: row.order_multiple,
      leadTimeDays: row.lead_time_days,
      safetyStockDays: row.safety_stock_days,
      preferredSupplierId: row.preferred_supplier_id,
      preferredSupplierName: row.preferred_supplier_name,
      autoOrderEnabled: row.auto_order_enabled,
      autoOrderApprovalRequired: row.auto_order_approval_required,
      lastAlertAt: row.last_alert_at,
      lastOrderedAt: row.last_ordered_at
    })));

  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Failed to fetch reorder rules' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/smart-ordering/rules
 * Create or update a reorder rule
 */
router.post('/rules', async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      item_id,
      reorder_point,
      reorder_quantity,
      max_stock_level,
      min_order_quantity,
      order_multiple,
      lead_time_days,
      safety_stock_days,
      preferred_supplier_id,
      auto_order_enabled,
      auto_order_approval_required
    } = req.body;

    // Upsert rule
    const result = await pool.query(`
      INSERT INTO reorder_rules (
        user_id, item_id, reorder_point, reorder_quantity,
        max_stock_level, min_order_quantity, order_multiple,
        lead_time_days, safety_stock_days, preferred_supplier_id,
        auto_order_enabled, auto_order_approval_required
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET
        reorder_point = EXCLUDED.reorder_point,
        reorder_quantity = EXCLUDED.reorder_quantity,
        max_stock_level = EXCLUDED.max_stock_level,
        min_order_quantity = EXCLUDED.min_order_quantity,
        order_multiple = EXCLUDED.order_multiple,
        lead_time_days = EXCLUDED.lead_time_days,
        safety_stock_days = EXCLUDED.safety_stock_days,
        preferred_supplier_id = EXCLUDED.preferred_supplier_id,
        auto_order_enabled = EXCLUDED.auto_order_enabled,
        auto_order_approval_required = EXCLUDED.auto_order_approval_required,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      userId, item_id, reorder_point || 0, reorder_quantity || 1,
      max_stock_level, min_order_quantity || 1, order_multiple || 1,
      lead_time_days || 0, safety_stock_days || 0, preferred_supplier_id,
      auto_order_enabled || false, auto_order_approval_required !== false
    ]);

    res.json({
      message: 'Reorder rule saved',
      rule: result.rows[0]
    });

  } catch (error) {
    console.error('Save rule error:', error);
    res.status(500).json({ error: 'Failed to save reorder rule' });
  }
});

/**
 * DELETE /api/smart-ordering/rules/:itemId
 * Delete a reorder rule
 */
router.delete('/rules/:itemId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;

    await pool.query(`
      UPDATE reorder_rules
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = $1 AND user_id = $2
    `, [itemId, userId]);

    res.json({ message: 'Reorder rule deleted' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: 'Failed to delete reorder rule' });
  }
});

// ==========================================
// USAGE ANALYTICS
// ==========================================

/**
 * GET /api/smart-ordering/usage/:itemId
 * Get usage history and analytics for an item
 */
router.get('/usage/:itemId', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const { months } = req.query;
    const lookbackMonths = parseInt(months) || 6;

    // Calculate statistics from stock movements
    const statsResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'Out') as total_out_movements,
        COALESCE(SUM(quantity) FILTER (WHERE type = 'Out'), 0) as total_quantity_used,
        COALESCE(AVG(quantity) FILTER (WHERE type = 'Out'), 0) as avg_quantity_per_use,
        COUNT(DISTINCT DATE_TRUNC('week', to_timestamp(timestamp/1000))) as weeks_with_usage
      FROM stock_movements
      WHERE user_id = $1 AND item_id = $2
        AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - ($3 || ' months')::INTERVAL)) * 1000
    `, [userId, itemId, lookbackMonths]);

    const stats = statsResult.rows[0];
    const weeksWithUsage = parseInt(stats.weeks_with_usage) || 1;
    const avgWeeklyUsage = parseInt(stats.total_quantity_used) / weeksWithUsage;
    const avgDailyUsage = avgWeeklyUsage / 7;

    // Get current item details
    const itemResult = await client.query(`
      SELECT i.*, rr.reorder_point, rr.lead_time_days
      FROM inventory_items i
      LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id
      WHERE i.id = $1 AND i.user_id = $2
    `, [itemId, userId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];
    const daysOfStock = avgDailyUsage > 0 ? Math.floor(item.quantity / avgDailyUsage) : 999;

    // Get weekly breakdown
    const weeklyResult = await client.query(`
      SELECT
        DATE_TRUNC('week', to_timestamp(timestamp/1000))::date as week_start,
        SUM(CASE WHEN type = 'Out' THEN quantity ELSE 0 END) as quantity_used,
        SUM(CASE WHEN type = 'In' THEN quantity ELSE 0 END) as quantity_received
      FROM stock_movements
      WHERE user_id = $1 AND item_id = $2
        AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - ($3 || ' months')::INTERVAL)) * 1000
      GROUP BY DATE_TRUNC('week', to_timestamp(timestamp/1000))
      ORDER BY week_start DESC
      LIMIT 12
    `, [userId, itemId, lookbackMonths]);

    res.json({
      item: {
        id: item.id,
        name: item.name,
        currentQuantity: item.quantity,
        reorderPoint: item.reorder_point || item.reorder_level,
        leadTimeDays: item.lead_time_days
      },
      usage: {
        totalUsed: parseInt(stats.total_quantity_used) || 0,
        avgWeeklyUsage: avgWeeklyUsage.toFixed(2),
        avgDailyUsage: avgDailyUsage.toFixed(2),
        daysOfStock,
        weeksOfStock: (daysOfStock / 7).toFixed(1)
      },
      history: weeklyResult.rows.map(row => ({
        weekStart: row.week_start,
        quantityUsed: parseInt(row.quantity_used) || 0,
        quantityReceived: parseInt(row.quantity_received) || 0
      })),
      forecast: {
        next7Days: Math.ceil(avgDailyUsage * 7),
        next30Days: Math.ceil(avgDailyUsage * 30),
        willRunOut: daysOfStock < (item.lead_time_days || 7),
        recommendedOrderDate: daysOfStock < 999 && daysOfStock > (item.lead_time_days || 7)
          ? new Date(Date.now() + (daysOfStock - (item.lead_time_days || 7)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  } finally {
    client.release();
  }
});

// ==========================================
// DASHBOARD / OVERVIEW
// ==========================================

/**
 * GET /api/smart-ordering/dashboard
 * Get smart ordering dashboard data
 */
router.get('/dashboard', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get items below reorder point
    const lowStockResult = await client.query(`
      SELECT
        i.id,
        i.name,
        i.quantity,
        i.reorder_level,
        rr.reorder_point,
        rr.preferred_supplier_id,
        c.name as supplier_name
      FROM inventory_items i
      LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id AND rr.is_active = true
      LEFT JOIN contacts c ON rr.preferred_supplier_id = c.id
      WHERE i.user_id = $1
        AND i.quantity <= COALESCE(rr.reorder_point, i.reorder_level, 0)
        AND COALESCE(rr.reorder_point, i.reorder_level, 0) > 0
      ORDER BY i.quantity ASC
      LIMIT 10
    `, [userId]);

    // Get items with upcoming job allocations that may need ordering
    const upcomingShortagesResult = await client.query(`
      SELECT
        i.id,
        i.name,
        i.quantity as current_quantity,
        COALESCE(SUM(jai.quantity), 0) as allocated_quantity,
        i.quantity - COALESCE(SUM(jai.quantity), 0) as available_after_allocation,
        COUNT(DISTINCT j.id) as job_count,
        MIN(j.date) as earliest_job_date
      FROM inventory_items i
      JOIN job_allocated_items jai ON i.id = jai.item_id
      JOIN jobs j ON jai.job_id = j.id
      WHERE i.user_id = $1
        AND j.status IN ('Scheduled', 'In Progress')
        AND j.date >= CURRENT_DATE
      GROUP BY i.id, i.name, i.quantity
      HAVING i.quantity - COALESCE(SUM(jai.quantity), 0) < 0
      ORDER BY i.quantity - COALESCE(SUM(jai.quantity), 0) ASC
      LIMIT 10
    `, [userId]);

    // Get recent orders
    const recentOrdersResult = await client.query(`
      SELECT
        po.id,
        po.po_number,
        po.status,
        po.created_at,
        po.total,
        c.name as supplier_name,
        COUNT(poi.id) as item_count
      FROM purchase_orders po
      LEFT JOIN contacts c ON po.supplier_id = c.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      WHERE po.user_id = $1
        AND po.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY po.id, po.po_number, po.status, po.created_at, po.total, c.name
      ORDER BY po.created_at DESC
      LIMIT 5
    `, [userId]);

    // Get rules count
    const rulesResult = await client.query(`
      SELECT COUNT(*) as total FROM reorder_rules WHERE user_id = $1 AND is_active = true
    `, [userId]);

    // Count items below reorder
    const alertCountResult = await client.query(`
      SELECT COUNT(*) as count
      FROM inventory_items i
      LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id
      WHERE i.user_id = $1
        AND i.quantity <= COALESCE(rr.reorder_point, i.reorder_level, 0)
        AND COALESCE(rr.reorder_point, i.reorder_level, 0) > 0
    `, [userId]);

    res.json({
      alerts: {
        critical_alerts: lowStockResult.rows.filter(r => r.quantity === 0).length,
        high_alerts: lowStockResult.rows.filter(r => r.quantity > 0).length,
        total_pending_alerts: parseInt(alertCountResult.rows[0].count)
      },
      lowStockItems: lowStockResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        currentQuantity: row.quantity,
        reorderPoint: row.reorder_point || row.reorder_level,
        supplierName: row.supplier_name
      })),
      upcomingShortages: upcomingShortagesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        currentQuantity: row.current_quantity,
        allocatedQuantity: parseInt(row.allocated_quantity),
        availableAfter: parseInt(row.available_after_allocation),
        jobCount: parseInt(row.job_count),
        earliestJobDate: row.earliest_job_date
      })),
      recentOrders: recentOrdersResult.rows.map(row => ({
        id: row.id,
        poNumber: row.po_number,
        status: row.status,
        createdAt: row.created_at,
        total: row.total,
        supplierName: row.supplier_name,
        itemCount: parseInt(row.item_count)
      })),
      rulesConfigured: parseInt(rulesResult.rows[0].total)
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  } finally {
    client.release();
  }
});

// ==========================================
// AI SUGGESTIONS
// ==========================================

/**
 * GET /api/smart-ordering/test-models
 * Test endpoint to list available models
 */
router.get('/test-models', async (req, res) => {
  try {
    const apiKey =
      req.query.apiKey ||
      (await getProviderKey(req.user.userId, 'gemini')) ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to list models',
        details: data
      });
    }

    const textModels = data.models?.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    ) || [];

    return res.json({
      success: true,
      totalModels: data.models?.length || 0,
      textGenerationModels: textModels.map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        methods: m.supportedGenerationMethods
      }))
    });
  } catch (error) {
    console.error('Test models error:', error);
    res.status(500).json({
      error: 'Failed to test models',
      details: error.message
    });
  }
});

/**
 * POST /api/smart-ordering/suggestions
 * Generate AI-powered order suggestions
 */
router.post('/suggestions', async (req, res) => {
  const client = await pool.connect();

  try {
    const apiKey = (await getProviderKey(req.user.userId, 'gemini')) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API key required',
        details: 'Please provide a Gemini API key in Settings → AI Integration'
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Get inventory with usage data
    const inventoryResult = await client.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        i.quantity,
        i.reorder_level,
        rr.reorder_point,
        rr.lead_time_days,
        COALESCE(
          (SELECT SUM(quantity) FROM stock_movements
           WHERE item_id = i.id AND type = 'Out'
             AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - INTERVAL '30 days')) * 1000),
          0
        ) as last_30_day_usage
      FROM inventory_items i
      LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id
      WHERE i.user_id = $1
      ORDER BY i.name ASC
    `, [req.user.userId]);

    // Get upcoming jobs
    const jobsResult = await client.query(`
      SELECT
        j.id,
        j.title,
        j.job_type,
        j.date,
        j.is_picked,
        COALESCE(
          json_agg(
            jsonb_build_object('itemId', jai.item_id, 'quantity', jai.quantity, 'itemName', i.name)
          ) FILTER (WHERE jai.item_id IS NOT NULL),
          '[]'
        ) as allocated_items
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id AND i.user_id = $1
      WHERE j.status IN ('Scheduled', 'In Progress')
        AND j.user_id = $1
        AND j.date >= CURRENT_DATE
      GROUP BY j.id
      ORDER BY j.date ASC
      LIMIT 20
    `, [req.user.userId]);

    const inventory = inventoryResult.rows;
    const upcomingJobs = jobsResult.rows;

    // Build enhanced AI prompt
    const prompt = `
You are an AI assistant for a plumbing inventory management system. Analyze the current inventory, usage patterns, and upcoming jobs to suggest which items should be reordered.

IMPORTANT RULES:
- You can ONLY suggest items that exist in the Current Inventory list below
- You MUST use the exact itemId from the inventory list
- Consider both current stock levels AND upcoming job requirements
- Factor in lead times when determining urgency

Current Inventory (ID | Name | Category | Quantity | Reorder Point | Lead Time Days | 30-Day Usage):
${inventory.map(item => `${item.id} | ${item.name} | ${item.category} | ${item.quantity} | ${item.reorder_point || item.reorder_level || 0} | ${item.lead_time_days || 0} | ${item.last_30_day_usage}`).join('\n')}

Upcoming Jobs (next 2 weeks):
${upcomingJobs.length > 0 ? upcomingJobs.map(job => {
  const items = job.allocated_items;
  return `- ${job.title} (${job.job_type}) on ${job.date}${job.is_picked ? ' [Picked]' : ''}${items.length > 0 ? `\n  Materials: ${items.map(i => `${i.itemName} x${i.quantity}`).join(', ')}` : ''}`;
}).join('\n') : 'No upcoming jobs scheduled'}

Analyze and provide reorder suggestions. Consider:
1. Items below their reorder point
2. Items with high 30-day usage that will run low soon
3. Items needed for upcoming jobs
4. Lead time requirements (order early enough for delivery)

Return your response in this exact JSON format:
{
  "suggestions": [
    {
      "itemId": "exact-uuid-from-inventory-list",
      "itemName": "exact-name-from-inventory-list",
      "suggestedQuantity": number,
      "reason": "brief explanation",
      "urgency": "critical" | "high" | "normal" | "low"
    }
  ],
  "insights": ["insight 1", "insight 2"]
}

Respond ONLY with valid JSON.
`;

    // Try multiple models
    let result, response, text;
    const modelNamesToTry = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-flash-latest',
      'gemini-pro-latest'
    ];

    let lastError;
    for (const modelName of modelNamesToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        response = await result.response;
        text = response.text();
        console.log(`Successfully used model: ${modelName}`);
        break;
      } catch (err) {
        console.log(`Model ${modelName} failed:`, err.message);
        lastError = err;
        continue;
      }
    }

    if (!text) {
      throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Validate suggestions
    const inventoryIds = new Set(inventory.map(item => item.id));
    const validSuggestions = (aiResponse.suggestions || []).filter(suggestion =>
      inventoryIds.has(suggestion.itemId)
    );

    res.json({
      suggestions: validSuggestions,
      insights: aiResponse.insights || []
    });

  } catch (error) {
    console.error('Smart ordering error:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/smart-ordering/check-all
 * Run a check on all items and generate alerts
 */
router.post('/check-all', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    let itemsChecked = 0;
    let itemsBelowReorder = 0;

    // Get all items with reorder levels
    const itemsResult = await client.query(`
      SELECT
        i.id,
        i.name,
        i.quantity,
        i.reorder_level,
        COALESCE(rr.reorder_point, i.reorder_level) as effective_reorder_point,
        rr.reorder_quantity,
        rr.preferred_supplier_id,
        rr.lead_time_days,
        COALESCE(
          (SELECT SUM(jai.quantity)
           FROM job_allocated_items jai
           JOIN jobs j ON jai.job_id = j.id
           WHERE jai.item_id = i.id AND j.status IN ('Scheduled', 'In Progress')),
          0
        ) as allocated_quantity,
        COALESCE(
          (SELECT SUM(poi.quantity_ordered - poi.quantity_received)
           FROM purchase_order_items poi
           JOIN purchase_orders po ON poi.purchase_order_id = po.id
           WHERE poi.inventory_item_id = i.id
             AND po.user_id = $1
             AND po.status IN ('sent', 'confirmed', 'partially_received')),
          0
        ) as on_order_quantity
      FROM inventory_items i
      LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id AND rr.is_active = true
      WHERE i.user_id = $1
    `, [userId]);

    for (const item of itemsResult.rows) {
      itemsChecked++;
      const reorderPoint = parseInt(item.effective_reorder_point) || 0;
      if (reorderPoint <= 0) continue;

      const availableQty = item.quantity - (parseInt(item.allocated_quantity) || 0);
      const effectiveQty = availableQty + (parseInt(item.on_order_quantity) || 0);

      if (effectiveQty <= reorderPoint) {
        itemsBelowReorder++;
      }
    }

    res.json({
      message: `Stock check complete. ${itemsChecked} items checked, ${itemsBelowReorder} below reorder point.`,
      itemsChecked,
      itemsBelowReorder
    });

  } catch (error) {
    console.error('Check all error:', error);
    res.status(500).json({ error: 'Failed to run stock check' });
  } finally {
    client.release();
  }
});

// ==========================================
// PREDICTIVE ORDERING / FORECASTS
// ==========================================

/**
 * GET /api/smart-ordering/forecasts
 * Get usage forecasts for all items with usage history
 */
router.get('/forecasts', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { days = 30 } = req.query;
    const forecastDays = parseInt(days);

    // Get items with usage data and calculate forecasts
    const forecastsResult = await client.query(`
      WITH usage_stats AS (
        SELECT
          i.id,
          i.name,
          i.category,
          i.quantity as current_stock,
          COALESCE(rr.reorder_point, i.reorder_level, 0) as reorder_point,
          rr.lead_time_days,
          rr.reorder_quantity,
          rr.preferred_supplier_id,
          c.name as supplier_name,
          -- Calculate usage over last 90 days
          COALESCE(
            (SELECT SUM(quantity) FROM stock_movements sm
             WHERE sm.item_id = i.id AND sm.type = 'Out' AND sm.user_id = i.user_id
               AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - INTERVAL '90 days')) * 1000),
            0
          ) as usage_90_days,
          -- Calculate usage over last 30 days
          COALESCE(
            (SELECT SUM(quantity) FROM stock_movements sm
             WHERE sm.item_id = i.id AND sm.type = 'Out' AND sm.user_id = i.user_id
               AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - INTERVAL '30 days')) * 1000),
            0
          ) as usage_30_days,
          -- Calculate usage over last 7 days
          COALESCE(
            (SELECT SUM(quantity) FROM stock_movements sm
             WHERE sm.item_id = i.id AND sm.type = 'Out' AND sm.user_id = i.user_id
               AND timestamp >= EXTRACT(EPOCH FROM (CURRENT_DATE - INTERVAL '7 days')) * 1000),
            0
          ) as usage_7_days,
          -- Allocated quantity for upcoming jobs
          COALESCE(
            (SELECT SUM(jai.quantity)
             FROM job_allocated_items jai
             JOIN jobs j ON jai.job_id = j.id
             WHERE jai.item_id = i.id AND j.status IN ('Scheduled', 'In Progress')
               AND j.date >= CURRENT_DATE AND j.date <= CURRENT_DATE + ($2 || ' days')::INTERVAL),
            0
          ) as allocated_next_period,
          -- On order quantity
          COALESCE(
            (SELECT SUM(poi.quantity_ordered - poi.quantity_received)
             FROM purchase_order_items poi
             JOIN purchase_orders po ON poi.purchase_order_id = po.id
             WHERE poi.inventory_item_id = i.id
               AND po.user_id = $1
               AND po.status IN ('sent', 'confirmed', 'partially_received')),
            0
          ) as on_order
        FROM inventory_items i
        LEFT JOIN reorder_rules rr ON i.id = rr.item_id AND rr.user_id = i.user_id AND rr.is_active = true
        LEFT JOIN contacts c ON rr.preferred_supplier_id = c.id
        WHERE i.user_id = $1
      )
      SELECT
        id,
        name,
        category,
        current_stock,
        reorder_point,
        lead_time_days,
        reorder_quantity,
        preferred_supplier_id,
        supplier_name,
        usage_90_days,
        usage_30_days,
        usage_7_days,
        allocated_next_period,
        on_order,
        -- Calculate daily average (weighted more towards recent usage)
        CASE
          WHEN usage_30_days > 0 THEN (usage_30_days::numeric / 30)
          WHEN usage_90_days > 0 THEN (usage_90_days::numeric / 90)
          ELSE 0
        END as avg_daily_usage,
        -- Detect usage trend (comparing last 7 days vs previous weekly average)
        CASE
          WHEN usage_90_days > 0 AND usage_7_days > ((usage_90_days::numeric / 90) * 7 * 1.2) THEN 'increasing'
          WHEN usage_90_days > 0 AND usage_7_days < ((usage_90_days::numeric / 90) * 7 * 0.8) THEN 'decreasing'
          ELSE 'stable'
        END as usage_trend
      FROM usage_stats
      WHERE usage_90_days > 0 OR allocated_next_period > 0
      ORDER BY
        CASE WHEN current_stock = 0 THEN 0 ELSE 1 END,
        (current_stock::numeric / NULLIF(GREATEST(usage_30_days::numeric / 30, 0.1), 0)) ASC
    `, [userId, forecastDays]);

    // Process forecasts
    const forecasts = forecastsResult.rows.map(row => {
      const avgDailyUsage = parseFloat(row.avg_daily_usage) || 0;
      const currentStock = parseInt(row.current_stock) || 0;
      const allocated = parseInt(row.allocated_next_period) || 0;
      const onOrder = parseInt(row.on_order) || 0;
      const leadTime = parseInt(row.lead_time_days) || 7;
      const reorderPoint = parseInt(row.reorder_point) || 0;

      // Calculate available stock (current - allocated + on order)
      const effectiveStock = currentStock - allocated + onOrder;

      // Calculate days until stockout
      const daysUntilStockout = avgDailyUsage > 0
        ? Math.floor(effectiveStock / avgDailyUsage)
        : 999;

      // Calculate projected stock at end of forecast period
      const projectedUsage = Math.ceil(avgDailyUsage * forecastDays) + allocated;
      const projectedStock = currentStock + onOrder - projectedUsage;

      // Determine if reorder is needed
      const needsReorder = effectiveStock <= reorderPoint || daysUntilStockout <= leadTime;

      // Calculate stockout date
      const stockoutDate = daysUntilStockout < 999
        ? new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      // Calculate recommended order date (leadTime days before stockout)
      const recommendedOrderDate = stockoutDate && daysUntilStockout > leadTime
        ? new Date(Date.now() + (daysUntilStockout - leadTime) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : (needsReorder ? new Date().toISOString().split('T')[0] : null);

      // Calculate suggested order quantity
      const suggestedQuantity = parseInt(row.reorder_quantity) ||
        Math.max(Math.ceil(avgDailyUsage * 30), reorderPoint * 2);

      return {
        itemId: row.id,
        itemName: row.name,
        category: row.category,
        currentStock,
        effectiveStock,
        reorderPoint,
        leadTimeDays: leadTime,
        avgDailyUsage: parseFloat(avgDailyUsage.toFixed(2)),
        usageTrend: row.usage_trend,
        allocatedForJobs: allocated,
        onOrder,
        daysUntilStockout: daysUntilStockout > 365 ? null : daysUntilStockout,
        stockoutDate,
        projectedStock: Math.max(0, projectedStock),
        needsReorder,
        recommendedOrderDate,
        suggestedQuantity: needsReorder ? suggestedQuantity : null,
        preferredSupplierId: row.preferred_supplier_id,
        supplierName: row.supplier_name,
        usage: {
          last7Days: parseInt(row.usage_7_days) || 0,
          last30Days: parseInt(row.usage_30_days) || 0,
          last90Days: parseInt(row.usage_90_days) || 0
        }
      };
    });

    // Group forecasts
    const criticalItems = forecasts.filter(f => f.daysUntilStockout !== null && f.daysUntilStockout <= 7);
    const warningItems = forecasts.filter(f => f.daysUntilStockout !== null && f.daysUntilStockout > 7 && f.daysUntilStockout <= 14);
    const needsOrderingItems = forecasts.filter(f => f.needsReorder);

    res.json({
      forecastPeriodDays: forecastDays,
      summary: {
        totalItemsAnalyzed: forecasts.length,
        criticalItems: criticalItems.length,
        warningItems: warningItems.length,
        itemsNeedingReorder: needsOrderingItems.length,
        estimatedTotalOrderValue: needsOrderingItems.reduce((sum, item) =>
          sum + (item.suggestedQuantity || 0) * 10, 0) // Approximate value
      },
      forecasts: forecasts.slice(0, 50), // Limit to top 50
      criticalItems,
      upcomingShortages: forecasts.filter(f => f.stockoutDate !== null).slice(0, 10)
    });

  } catch (error) {
    console.error('Get forecasts error:', error);
    res.status(500).json({ error: 'Failed to generate forecasts' });
  } finally {
    client.release();
  }
});

export default router;
