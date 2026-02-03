/**
 * Supplier Analytics Routes
 * API endpoints for supplier performance metrics and delivery tracking
 */

import express from 'express';
import { param, body, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/supplier-analytics/:supplierId/performance
 * Get comprehensive performance metrics for a supplier
 */
router.get('/:supplierId/performance', [
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId } = req.params;

    // Get overall supplier info
    const supplierResult = await client.query(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.email,
        c.phone,
        c.average_rating as "averageRating",
        c.total_ratings as "totalRatings"
      FROM contacts c
      WHERE c.id = $1 AND c.user_id = $2
    `, [supplierId, req.user.userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = supplierResult.rows[0];

    // Get purchase order statistics
    const poStatsResult = await client.query(`
      SELECT
        COUNT(*) as "totalOrders",
        COUNT(*) FILTER (WHERE status = 'Received') as "completedOrders",
        COUNT(*) FILTER (WHERE status = 'Pending') as "pendingOrders",
        SUM(total)::DECIMAL(10,2) as "totalSpent",
        AVG(total)::DECIMAL(10,2) as "avgOrderValue",
        MIN(created_at) as "firstOrderDate",
        MAX(created_at) as "lastOrderDate"
      FROM purchase_orders
      WHERE supplier_id = $1 AND user_id = $2
    `, [supplierId, req.user.userId]);

    // Get delivery performance
    const deliveryResult = await client.query(`
      SELECT
        COUNT(*) as "totalDeliveries",
        COUNT(*) FILTER (WHERE delivery_status = 'on_time') as "onTimeDeliveries",
        COUNT(*) FILTER (WHERE delivery_status = 'late') as "lateDeliveries",
        COUNT(*) FILTER (WHERE delivery_status = 'early') as "earlyDeliveries",
        AVG(days_early_late) FILTER (WHERE delivery_status = 'late')::DECIMAL(5,2) as "avgDaysLate",
        COUNT(*) FILTER (WHERE had_issues = true) as "deliveriesWithIssues"
      FROM supplier_delivery_tracking
      WHERE supplier_id = $1 AND user_id = $2 AND actual_delivery_date IS NOT NULL
    `, [supplierId, req.user.userId]);

    // Get items supplied
    const itemsResult = await client.query(`
      SELECT
        COUNT(*) as "totalItems",
        COUNT(*) FILTER (WHERE is_preferred = true) as "preferredItems",
        AVG(unit_price_excl_gst)::DECIMAL(10,2) as "avgPrice",
        AVG(lead_time_days)::DECIMAL(5,2) as "avgLeadTime"
      FROM item_suppliers
      WHERE supplier_id = $1 AND user_id = $2 AND is_active = true
    `, [supplierId, req.user.userId]);

    // Get price change history
    const priceChangesResult = await client.query(`
      SELECT
        COUNT(*) as "totalPriceChanges",
        COUNT(*) FILTER (WHERE price_difference > 0) as "priceIncreases",
        COUNT(*) FILTER (WHERE price_difference < 0) as "priceDecreases",
        AVG(percentage_change)::DECIMAL(5,2) as "avgChangePercent"
      FROM price_change_alerts
      WHERE supplier_id = $1 AND user_id = $2
    `, [supplierId, req.user.userId]);

    // Calculate delivery reliability percentage
    const deliveryStats = deliveryResult.rows[0];
    const totalDeliveries = parseInt(deliveryStats.totalDeliveries) || 0;
    const onTimeDeliveries = parseInt(deliveryStats.onTimeDeliveries) || 0;
    const deliveryReliability = totalDeliveries > 0
      ? ((onTimeDeliveries / totalDeliveries) * 100).toFixed(1)
      : null;

    res.json({
      supplier,
      performance: {
        orders: poStatsResult.rows[0],
        delivery: {
          ...deliveryStats,
          reliabilityPercentage: deliveryReliability
        },
        items: itemsResult.rows[0],
        pricing: priceChangesResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Get supplier performance error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier performance' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/supplier-analytics/:supplierId/delivery-history
 * Get delivery tracking history for a supplier
 */
router.get('/:supplierId/delivery-history', [
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await client.query(`
      SELECT
        dt.id,
        dt.purchase_order_id as "purchaseOrderId",
        po.po_number as "poNumber",
        dt.expected_delivery_date as "expectedDeliveryDate",
        dt.actual_delivery_date as "actualDeliveryDate",
        dt.days_early_late as "daysEarlyLate",
        dt.delivery_status as "deliveryStatus",
        dt.tracking_number as "trackingNumber",
        dt.carrier,
        dt.had_issues as "hadIssues",
        dt.issue_description as "issueDescription",
        dt.created_at as "createdAt"
      FROM supplier_delivery_tracking dt
      JOIN purchase_orders po ON dt.purchase_order_id = po.id
      WHERE dt.supplier_id = $1 AND dt.user_id = $2
      ORDER BY dt.expected_delivery_date DESC
      LIMIT $3 OFFSET $4
    `, [supplierId, req.user.userId, limit, offset]);

    // Get total count
    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM supplier_delivery_tracking WHERE supplier_id = $1 AND user_id = $2',
      [supplierId, req.user.userId]
    );

    res.json({
      deliveries: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Get delivery history error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery history' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/supplier-analytics/delivery-tracking
 * Create or update delivery tracking for a purchase order
 */
router.post('/delivery-tracking', [
  body('purchaseOrderId').isUUID().withMessage('Valid purchase order ID is required'),
  body('expectedDeliveryDate').isISO8601().withMessage('Valid expected delivery date is required'),
  body('actualDeliveryDate').optional().isISO8601().withMessage('Valid actual delivery date required'),
  body('trackingNumber').optional().isString().trim(),
  body('carrier').optional().isString().trim(),
  body('hadIssues').optional().isBoolean(),
  body('issueDescription').optional().isString().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      purchaseOrderId,
      expectedDeliveryDate,
      actualDeliveryDate,
      trackingNumber,
      carrier,
      hadIssues,
      issueDescription
    } = req.body;

    await client.query('BEGIN');

    // Get purchase order details
    const poResult = await client.query(
      'SELECT supplier_id FROM purchase_orders WHERE id = $1 AND user_id = $2',
      [purchaseOrderId, req.user.userId]
    );

    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const supplierId = poResult.rows[0].supplier_id;

    // Check if tracking already exists
    const existingResult = await client.query(
      'SELECT id FROM supplier_delivery_tracking WHERE purchase_order_id = $1',
      [purchaseOrderId]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing tracking
      result = await client.query(`
        UPDATE supplier_delivery_tracking
        SET
          expected_delivery_date = $1,
          actual_delivery_date = $2,
          tracking_number = $3,
          carrier = $4,
          had_issues = $5,
          issue_description = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE purchase_order_id = $7
        RETURNING *
      `, [
        expectedDeliveryDate,
        actualDeliveryDate || null,
        trackingNumber || null,
        carrier || null,
        hadIssues || false,
        issueDescription || null,
        purchaseOrderId
      ]);
    } else {
      // Create new tracking
      result = await client.query(`
        INSERT INTO supplier_delivery_tracking (
          user_id,
          supplier_id,
          purchase_order_id,
          expected_delivery_date,
          actual_delivery_date,
          tracking_number,
          carrier,
          had_issues,
          issue_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.userId,
        supplierId,
        purchaseOrderId,
        expectedDeliveryDate,
        actualDeliveryDate || null,
        trackingNumber || null,
        carrier || null,
        hadIssues || false,
        issueDescription || null
      ]);
    }

    // Update purchase order tracking info if provided
    if (trackingNumber || carrier || actualDeliveryDate) {
      await client.query(`
        UPDATE purchase_orders
        SET
          tracking_number = COALESCE($1, tracking_number),
          carrier = COALESCE($2, carrier),
          actual_delivery_date = COALESCE($3, actual_delivery_date)
        WHERE id = $4
      `, [trackingNumber, carrier, actualDeliveryDate, purchaseOrderId]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Delivery tracking updated successfully',
      tracking: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update delivery tracking error:', error);
    res.status(500).json({ error: 'Failed to update delivery tracking' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/supplier-analytics/top-performers
 * Get top performing suppliers based on various metrics
 */
router.get('/top-performers', [
  query('metric').optional().isIn(['rating', 'delivery', 'orders', 'value'])
    .withMessage('Metric must be one of: rating, delivery, orders, value'),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const metric = req.query.metric || 'rating';
    const limit = parseInt(req.query.limit) || 10;

    let orderByClause;
    let additionalFields = '';

    switch (metric) {
      case 'rating':
        orderByClause = 'c.average_rating DESC NULLS LAST, c.total_ratings DESC';
        break;
      case 'delivery':
        additionalFields = `,
          COUNT(*) FILTER (WHERE dt.delivery_status = 'on_time')::DECIMAL /
          NULLIF(COUNT(*), 0) * 100 as "deliveryReliability"`;
        orderByClause = '"deliveryReliability" DESC NULLS LAST';
        break;
      case 'orders':
        additionalFields = ', COUNT(po.id) as "totalOrders"';
        orderByClause = '"totalOrders" DESC';
        break;
      case 'value':
        additionalFields = ', SUM(po.total_amount)::DECIMAL(10,2) as "totalValue"';
        orderByClause = '"totalValue" DESC NULLS LAST';
        break;
    }

    const result = await client.query(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.average_rating as "averageRating",
        c.total_ratings as "totalRatings"
        ${additionalFields}
      FROM contacts c
      LEFT JOIN purchase_orders po ON c.id = po.supplier_id AND po.user_id = c.user_id
      LEFT JOIN supplier_delivery_tracking dt ON c.id = dt.supplier_id AND dt.user_id = c.user_id
      WHERE c.user_id = $1 AND c.type = 'Supplier'
      GROUP BY c.id, c.name, c.company, c.average_rating, c.total_ratings
      HAVING COUNT(po.id) > 0
      ORDER BY ${orderByClause}
      LIMIT $2
    `, [req.user.userId, limit]);

    res.json({
      metric,
      suppliers: result.rows
    });

  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({ error: 'Failed to fetch top performers' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/supplier-analytics/comparison
 * Compare multiple suppliers for the same item
 */
router.get('/comparison', [
  query('itemId').isUUID().withMessage('Valid item ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { itemId } = req.query;

    // Get item details
    const itemResult = await client.query(
      'SELECT id, name, category FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, req.user.userId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Get all suppliers for this item with comprehensive data
    const suppliersResult = await client.query(`
      SELECT
        is_data.id,
        is_data.supplier_id as "supplierId",
        is_data.supplier_name as "supplierName",
        is_data.supplier_company as "supplierCompany",
        is_data.supplier_code as "supplierCode",
        is_data.unit_price_excl_gst as "unitPriceExclGst",
        is_data.unit_price_incl_gst as "unitPriceInclGst",
        is_data.lead_time_days as "leadTimeDays",
        is_data.is_preferred as "isPreferred",
        is_data.is_active as "isActive",
        is_data.times_ordered as "timesOrdered",
        is_data.last_ordered_date as "lastOrderedDate",
        is_data.average_rating as "averageRating",
        is_data.total_ratings as "totalRatings",

        -- Delivery performance
        COALESCE(delivery_stats.total_deliveries, 0) as "totalDeliveries",
        COALESCE(delivery_stats.on_time_percentage, 0) as "onTimePercentage",

        -- Price ranking
        RANK() OVER (ORDER BY is_data.unit_price_excl_gst ASC) as "priceRank",

        -- Contract info
        is_data.has_contract as "hasContract",
        CASE
          WHEN is_data.has_contract AND is_data.contract_end_date < CURRENT_DATE THEN 'expired'
          WHEN is_data.has_contract AND is_data.contract_end_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          WHEN is_data.has_contract THEN 'active'
          ELSE NULL
        END as "contractStatus"

      FROM (
        SELECT
          is_.*,
          c.name as supplier_name,
          c.company as supplier_company,
          c.average_rating,
          c.total_ratings
        FROM item_suppliers is_
        JOIN contacts c ON is_.supplier_id = c.id
        WHERE is_.item_id = $1 AND is_.user_id = $2 AND is_.is_active = true
      ) is_data

      LEFT JOIN (
        SELECT
          supplier_id,
          COUNT(*) as total_deliveries,
          (COUNT(*) FILTER (WHERE delivery_status = 'on_time')::DECIMAL /
           NULLIF(COUNT(*), 0) * 100)::DECIMAL(5,2) as on_time_percentage
        FROM supplier_delivery_tracking
        WHERE user_id = $2
        GROUP BY supplier_id
      ) delivery_stats ON is_data.supplier_id = delivery_stats.supplier_id

      ORDER BY is_data.is_preferred DESC, is_data.unit_price_excl_gst ASC
    `, [itemId, req.user.userId]);

    // Calculate statistics
    const suppliers = suppliersResult.rows;
    const prices = suppliers.map(s => parseFloat(s.unitPriceExclGst));
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    res.json({
      item,
      suppliers,
      summary: {
        totalSuppliers: suppliers.length,
        lowestPrice: lowestPrice.toFixed(2),
        highestPrice: highestPrice.toFixed(2),
        avgPrice: avgPrice.toFixed(2),
        priceDifference: (highestPrice - lowestPrice).toFixed(2),
        preferredSupplier: suppliers.find(s => s.isPreferred)?.supplierName || null
      }
    });

  } catch (error) {
    console.error('Get supplier comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier comparison' });
  } finally {
    client.release();
  }
});

export default router;
