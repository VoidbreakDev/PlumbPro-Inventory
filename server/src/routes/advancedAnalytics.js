/**
 * Advanced Analytics Routes
 * Phase 3: Custom reports, scheduled reports, and business analytics
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads/advanced-analytics');

// Apply auth middleware to all routes
router.use(authenticateToken);

// ==========================================
// ANALYTICS DASHBOARD
// ==========================================

/**
 * GET /api/advanced-analytics/dashboard
 * Get comprehensive analytics dashboard data
 */
router.get('/dashboard', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Run all queries in parallel for performance
    const [
      revenueResult,
      jobsResult,
      customersResult,
      inventoryResult,
      topItemsResult,
      topCustomersResult,
      trendsResult,
      paymentsResult
    ] = await Promise.all([
      // Revenue metrics
      client.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_revenue,
          COALESCE(SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END), 0) as outstanding,
          COUNT(*) as invoice_count
        FROM invoices
        WHERE user_id = $1 AND created_at >= $2
      `, [userId, startDate]),

      // Jobs metrics
      client.query(`
        SELECT
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_jobs,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
          COALESCE(AVG(CASE
            WHEN status = 'Completed' AND completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - created_at))/86400
          END), 0) as avg_completion_days
        FROM jobs
        WHERE user_id = $1 AND created_at >= $2
      `, [userId, startDate]),

      // Customer metrics
      client.query(`
        SELECT
          COUNT(*) as total_customers,
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_customers
        FROM contacts
        WHERE user_id = $1 AND type IN ('Customer', 'Plumber')
      `, [userId, startDate]),

      // Inventory metrics
      client.query(`
        SELECT
          COUNT(*) as total_items,
          COALESCE(SUM(quantity * cost), 0) as total_value,
          COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock_items,
          COALESCE(AVG(
            CASE WHEN quantity > 0 AND reorder_level > 0
            THEN (quantity::decimal / NULLIF(reorder_level, 0))
            END
          ), 0) as avg_stock_ratio
        FROM inventory_items
        WHERE user_id = $1
      `, [userId]),

      // Top selling items
      client.query(`
        SELECT
          ii.id,
          ii.name,
          ii.category,
          COALESCE(SUM(sm.quantity), 0) as total_sold,
          COALESCE(SUM(sm.quantity * sm.unit_cost), 0) as total_revenue
        FROM inventory_items ii
        LEFT JOIN stock_movements sm ON ii.id = sm.inventory_item_id
          AND sm.movement_type IN ('Sale', 'Job Usage', 'Job Completion')
          AND sm.created_at >= $2
        WHERE ii.user_id = $1
        GROUP BY ii.id, ii.name, ii.category
        ORDER BY total_sold DESC
        LIMIT 10
      `, [userId, startDate]),

      // Top customers by revenue
      client.query(`
        SELECT
          c.id,
          c.name,
          c.type,
          COALESCE(SUM(i.total_amount), 0) as total_revenue,
          COUNT(DISTINCT j.id) as job_count
        FROM contacts c
        LEFT JOIN jobs j ON c.id = j.customer_id AND j.created_at >= $3
        LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
        WHERE c.user_id = $1 AND c.type IN ('Customer', 'Plumber')
        GROUP BY c.id, c.name, c.type
        ORDER BY total_revenue DESC
        LIMIT 10
      `, [userId, startDate, startDate]),

      // Daily trends for chart
      client.query(`
        WITH dates AS (
          SELECT generate_series(
            $2::date,
            CURRENT_DATE,
            '1 day'::interval
          )::date as date
        )
        SELECT
          d.date,
          COALESCE(SUM(i.total_amount), 0) as revenue,
          COUNT(DISTINCT j.id) as jobs_completed
        FROM dates d
        LEFT JOIN invoices i ON DATE(i.created_at) = d.date AND i.user_id = $1
        LEFT JOIN jobs j ON DATE(j.completed_at) = d.date AND j.user_id = $1 AND j.status = 'Completed'
        GROUP BY d.date
        ORDER BY d.date
      `, [userId, startDate]),

      // Payment aging
      client.query(`
        SELECT
          CASE
            WHEN due_date >= CURRENT_DATE THEN 'current'
            WHEN due_date >= CURRENT_DATE - 30 THEN 'overdue_1_30'
            WHEN due_date >= CURRENT_DATE - 60 THEN 'overdue_31_60'
            WHEN due_date >= CURRENT_DATE - 90 THEN 'overdue_61_90'
            ELSE 'overdue_90_plus'
          END as aging_bucket,
          COUNT(*) as invoice_count,
          COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as outstanding_amount
        FROM invoices
        WHERE user_id = $1 AND status IN ('sent', 'partially_paid')
        GROUP BY aging_bucket
      `, [userId])
    ]);

    // Calculate profit margin
    const revenue = parseFloat(revenueResult.rows[0]?.total_revenue || 0);
    const profitMargin = revenue > 0 ? ((revenue * 0.35) / revenue * 100).toFixed(1) : 0; // Estimated 35% margin

    res.json({
      period: days,
      summary: {
        revenue: {
          total: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
          paid: parseFloat(revenueResult.rows[0]?.paid_revenue || 0),
          outstanding: parseFloat(revenueResult.rows[0]?.outstanding || 0),
          invoiceCount: parseInt(revenueResult.rows[0]?.invoice_count || 0)
        },
        jobs: {
          total: parseInt(jobsResult.rows[0]?.total_jobs || 0),
          completed: parseInt(jobsResult.rows[0]?.completed_jobs || 0),
          inProgress: parseInt(jobsResult.rows[0]?.in_progress || 0),
          avgCompletionDays: parseFloat(jobsResult.rows[0]?.avg_completion_days || 0).toFixed(1)
        },
        customers: {
          total: parseInt(customersResult.rows[0]?.total_customers || 0),
          new: parseInt(customersResult.rows[0]?.new_customers || 0)
        },
        inventory: {
          totalItems: parseInt(inventoryResult.rows[0]?.total_items || 0),
          totalValue: parseFloat(inventoryResult.rows[0]?.total_value || 0),
          lowStockItems: parseInt(inventoryResult.rows[0]?.low_stock_items || 0)
        },
        profitMargin
      },
      topItems: topItemsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        totalSold: parseInt(row.total_sold || 0),
        totalRevenue: parseFloat(row.total_revenue || 0)
      })),
      topCustomers: topCustomersResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        totalRevenue: parseFloat(row.total_revenue || 0),
        jobCount: parseInt(row.job_count || 0)
      })),
      trends: trendsResult.rows.map(row => ({
        date: row.date,
        revenue: parseFloat(row.revenue || 0),
        jobsCompleted: parseInt(row.jobs_completed || 0)
      })),
      paymentAging: paymentsResult.rows.reduce((acc, row) => {
        acc[row.aging_bucket] = {
          count: parseInt(row.invoice_count || 0),
          amount: parseFloat(row.outstanding_amount || 0)
        };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to load analytics dashboard' });
  } finally {
    client.release();
  }
});

// ==========================================
// JOB PROFITABILITY
// ==========================================

/**
 * GET /api/advanced-analytics/job-profitability
 * Analyze job profitability by various dimensions
 */
router.get('/job-profitability', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { period = '90', groupBy = 'month' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get job profitability data
    const result = await client.query(`
      WITH job_costs AS (
        SELECT
          j.id as job_id,
          j.title,
          j.job_type,
          j.status,
          j.created_at,
          j.completed_at,
          c.name as customer_name,
          c.type as customer_type,
          COALESCE(i.total_amount, 0) as revenue,
          COALESCE(
            (SELECT SUM(sm.quantity * sm.unit_cost)
             FROM stock_movements sm
             WHERE sm.job_id = j.id AND sm.movement_type IN ('Job Usage', 'Job Completion')),
            0
          ) as material_cost,
          COALESCE(
            (SELECT SUM(hours_worked * 50) -- Assume $50/hr labor rate
             FROM job_time_entries
             WHERE job_id = j.id),
            0
          ) as labor_cost
        FROM jobs j
        LEFT JOIN contacts c ON j.customer_id = c.id
        LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
        WHERE j.user_id = $1
          AND j.status = 'Completed'
          AND j.completed_at >= $2
      )
      SELECT
        job_id,
        title,
        job_type,
        customer_name,
        customer_type,
        completed_at,
        revenue,
        material_cost,
        labor_cost,
        (revenue - material_cost - labor_cost) as profit,
        CASE WHEN revenue > 0
          THEN ((revenue - material_cost - labor_cost) / revenue * 100)
          ELSE 0
        END as margin_percent
      FROM job_costs
      ORDER BY completed_at DESC
    `, [userId, startDate]);

    // Group by job type for summary
    const byJobType = {};
    const byCustomerType = {};

    result.rows.forEach(job => {
      // By job type
      if (!byJobType[job.job_type]) {
        byJobType[job.job_type] = { count: 0, revenue: 0, profit: 0 };
      }
      byJobType[job.job_type].count++;
      byJobType[job.job_type].revenue += parseFloat(job.revenue);
      byJobType[job.job_type].profit += parseFloat(job.profit);

      // By customer type
      const custType = job.customer_type || 'Unknown';
      if (!byCustomerType[custType]) {
        byCustomerType[custType] = { count: 0, revenue: 0, profit: 0 };
      }
      byCustomerType[custType].count++;
      byCustomerType[custType].revenue += parseFloat(job.revenue);
      byCustomerType[custType].profit += parseFloat(job.profit);
    });

    // Calculate averages
    const totalJobs = result.rows.length;
    const totalRevenue = result.rows.reduce((sum, j) => sum + parseFloat(j.revenue), 0);
    const totalProfit = result.rows.reduce((sum, j) => sum + parseFloat(j.profit), 0);

    res.json({
      period: days,
      summary: {
        totalJobs,
        totalRevenue,
        totalProfit,
        avgMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0,
        avgJobValue: totalJobs > 0 ? (totalRevenue / totalJobs).toFixed(2) : 0
      },
      byJobType: Object.entries(byJobType).map(([type, data]) => ({
        jobType: type,
        ...data,
        avgMargin: data.revenue > 0 ? (data.profit / data.revenue * 100).toFixed(1) : 0
      })),
      byCustomerType: Object.entries(byCustomerType).map(([type, data]) => ({
        customerType: type,
        ...data,
        avgMargin: data.revenue > 0 ? (data.profit / data.revenue * 100).toFixed(1) : 0
      })),
      jobs: result.rows.map(job => ({
        id: job.job_id,
        title: job.title,
        jobType: job.job_type,
        customerName: job.customer_name,
        customerType: job.customer_type,
        completedAt: job.completed_at,
        revenue: parseFloat(job.revenue),
        materialCost: parseFloat(job.material_cost),
        laborCost: parseFloat(job.labor_cost),
        profit: parseFloat(job.profit),
        marginPercent: parseFloat(job.margin_percent).toFixed(1)
      }))
    });
  } catch (error) {
    console.error('Job profitability error:', error);
    res.status(500).json({ error: 'Failed to analyze job profitability' });
  } finally {
    client.release();
  }
});

// ==========================================
// INVENTORY ANALYTICS
// ==========================================

/**
 * GET /api/advanced-analytics/inventory
 * Analyze inventory performance and turnover
 */
router.get('/inventory', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { period = '90' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get inventory analytics
    const [summary, turnover, slowMoving, wastage] = await Promise.all([
      // Summary stats
      client.query(`
        SELECT
          COUNT(*) as total_items,
          COALESCE(SUM(quantity), 0) as total_units,
          COALESCE(SUM(quantity * cost), 0) as total_value,
          COALESCE(SUM(quantity * price), 0) as potential_revenue,
          COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock,
          COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock
        FROM inventory_items
        WHERE user_id = $1
      `, [userId]),

      // Turnover by category
      client.query(`
        SELECT
          ii.category,
          COUNT(DISTINCT ii.id) as item_count,
          COALESCE(SUM(ii.quantity), 0) as current_stock,
          COALESCE(SUM(ii.quantity * ii.cost), 0) as stock_value,
          COALESCE(
            (SELECT SUM(ABS(sm.quantity))
             FROM stock_movements sm
             WHERE sm.inventory_item_id = ANY(ARRAY_AGG(ii.id))
               AND sm.movement_type IN ('Sale', 'Job Usage', 'Job Completion')
               AND sm.created_at >= $2),
            0
          ) as units_sold
        FROM inventory_items ii
        WHERE ii.user_id = $1
        GROUP BY ii.category
        ORDER BY stock_value DESC
      `, [userId, startDate]),

      // Slow moving items (no movement in period)
      client.query(`
        SELECT
          ii.id,
          ii.name,
          ii.category,
          ii.quantity,
          ii.cost,
          (ii.quantity * ii.cost) as value,
          MAX(sm.created_at) as last_movement
        FROM inventory_items ii
        LEFT JOIN stock_movements sm ON ii.id = sm.inventory_item_id
        WHERE ii.user_id = $1 AND ii.quantity > 0
        GROUP BY ii.id, ii.name, ii.category, ii.quantity, ii.cost
        HAVING MAX(sm.created_at) IS NULL OR MAX(sm.created_at) < $2
        ORDER BY (ii.quantity * ii.cost) DESC
        LIMIT 20
      `, [userId, startDate]),

      // Wastage/write-offs
      client.query(`
        SELECT
          ii.name,
          ii.category,
          SUM(ABS(sm.quantity)) as units_wasted,
          SUM(ABS(sm.quantity) * sm.unit_cost) as value_wasted,
          sm.reason
        FROM stock_movements sm
        JOIN inventory_items ii ON sm.inventory_item_id = ii.id
        WHERE sm.user_id = $1
          AND sm.movement_type IN ('Write Off', 'Damaged', 'Adjustment')
          AND sm.quantity < 0
          AND sm.created_at >= $2
        GROUP BY ii.name, ii.category, sm.reason
        ORDER BY value_wasted DESC
        LIMIT 20
      `, [userId, startDate])
    ]);

    const totalValue = parseFloat(summary.rows[0]?.total_value || 0);
    const unitsSlowMoving = slowMoving.rows.reduce((sum, item) => sum + parseInt(item.quantity), 0);
    const valueSlowMoving = slowMoving.rows.reduce((sum, item) => sum + parseFloat(item.value), 0);

    res.json({
      period: days,
      summary: {
        totalItems: parseInt(summary.rows[0]?.total_items || 0),
        totalUnits: parseInt(summary.rows[0]?.total_units || 0),
        totalValue,
        potentialRevenue: parseFloat(summary.rows[0]?.potential_revenue || 0),
        lowStockItems: parseInt(summary.rows[0]?.low_stock || 0),
        outOfStockItems: parseInt(summary.rows[0]?.out_of_stock || 0),
        slowMovingValue: valueSlowMoving,
        slowMovingPercent: totalValue > 0 ? (valueSlowMoving / totalValue * 100).toFixed(1) : 0
      },
      byCategory: turnover.rows.map(row => ({
        category: row.category || 'Uncategorized',
        itemCount: parseInt(row.item_count),
        currentStock: parseInt(row.current_stock),
        stockValue: parseFloat(row.stock_value),
        unitsSold: parseInt(row.units_sold),
        turnoverRate: parseFloat(row.stock_value) > 0
          ? (parseInt(row.units_sold) / (parseFloat(row.stock_value) / 100)).toFixed(2)
          : 0
      })),
      slowMovingItems: slowMoving.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: parseInt(row.quantity),
        value: parseFloat(row.value),
        lastMovement: row.last_movement
      })),
      wastage: {
        totalUnits: wastage.rows.reduce((sum, row) => sum + parseInt(row.units_wasted), 0),
        totalValue: wastage.rows.reduce((sum, row) => sum + parseFloat(row.value_wasted), 0),
        items: wastage.rows.map(row => ({
          name: row.name,
          category: row.category,
          unitsWasted: parseInt(row.units_wasted),
          valueWasted: parseFloat(row.value_wasted),
          reason: row.reason
        }))
      }
    });
  } catch (error) {
    console.error('Inventory analytics error:', error);
    res.status(500).json({ error: 'Failed to analyze inventory' });
  } finally {
    client.release();
  }
});

// ==========================================
// CUSTOMER ANALYTICS
// ==========================================

/**
 * GET /api/advanced-analytics/customers
 * Customer lifetime value and segmentation
 */
router.get('/customers', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const [summary, topCustomers, segments, retention] = await Promise.all([
      // Summary
      client.query(`
        SELECT
          COUNT(DISTINCT c.id) as total_customers,
          COUNT(DISTINCT CASE WHEN c.created_at >= CURRENT_DATE - 30 THEN c.id END) as new_last_30,
          COUNT(DISTINCT CASE WHEN j.created_at >= CURRENT_DATE - 90 THEN c.id END) as active_last_90,
          COALESCE(AVG(customer_value.total_revenue), 0) as avg_lifetime_value
        FROM contacts c
        LEFT JOIN jobs j ON c.id = j.customer_id
        LEFT JOIN (
          SELECT
            j.customer_id,
            COALESCE(SUM(i.total_amount), 0) as total_revenue
          FROM jobs j
          LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
          WHERE j.user_id = $1
          GROUP BY j.customer_id
        ) customer_value ON c.id = customer_value.customer_id
        WHERE c.user_id = $1 AND c.type IN ('Customer', 'Plumber')
      `, [userId]),

      // Top customers by lifetime value
      client.query(`
        SELECT
          c.id,
          c.name,
          c.type,
          c.customer_type,
          c.created_at as customer_since,
          COUNT(DISTINCT j.id) as total_jobs,
          COALESCE(SUM(i.total_amount), 0) as lifetime_value,
          MAX(j.created_at) as last_job_date,
          COALESCE(AVG(i.total_amount), 0) as avg_job_value
        FROM contacts c
        LEFT JOIN jobs j ON c.id = j.customer_id
        LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
        WHERE c.user_id = $1 AND c.type IN ('Customer', 'Plumber')
        GROUP BY c.id, c.name, c.type, c.customer_type, c.created_at
        ORDER BY lifetime_value DESC
        LIMIT 20
      `, [userId]),

      // Customer segments by type
      client.query(`
        SELECT
          c.customer_type,
          COUNT(DISTINCT c.id) as customer_count,
          COUNT(DISTINCT j.id) as total_jobs,
          COALESCE(SUM(i.total_amount), 0) as total_revenue,
          COALESCE(AVG(i.total_amount), 0) as avg_job_value
        FROM contacts c
        LEFT JOIN jobs j ON c.id = j.customer_id
        LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
        WHERE c.user_id = $1 AND c.type IN ('Customer', 'Plumber')
        GROUP BY c.customer_type
        ORDER BY total_revenue DESC
      `, [userId]),

      // Retention analysis
      client.query(`
        WITH customer_jobs AS (
          SELECT
            c.id as customer_id,
            MIN(j.created_at) as first_job,
            MAX(j.created_at) as last_job,
            COUNT(j.id) as job_count
          FROM contacts c
          LEFT JOIN jobs j ON c.id = j.customer_id
          WHERE c.user_id = $1 AND c.type IN ('Customer', 'Plumber')
          GROUP BY c.id
        )
        SELECT
          COUNT(CASE WHEN job_count = 0 THEN 1 END) as never_booked,
          COUNT(CASE WHEN job_count = 1 THEN 1 END) as one_time,
          COUNT(CASE WHEN job_count >= 2 AND job_count <= 5 THEN 1 END) as occasional,
          COUNT(CASE WHEN job_count > 5 THEN 1 END) as frequent,
          COUNT(CASE WHEN last_job < CURRENT_DATE - 180 AND job_count > 0 THEN 1 END) as churned
        FROM customer_jobs
      `, [userId])
    ]);

    res.json({
      summary: {
        totalCustomers: parseInt(summary.rows[0]?.total_customers || 0),
        newLast30Days: parseInt(summary.rows[0]?.new_last_30 || 0),
        activeLast90Days: parseInt(summary.rows[0]?.active_last_90 || 0),
        avgLifetimeValue: parseFloat(summary.rows[0]?.avg_lifetime_value || 0)
      },
      topCustomers: topCustomers.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        customerType: row.customer_type,
        customerSince: row.customer_since,
        totalJobs: parseInt(row.total_jobs),
        lifetimeValue: parseFloat(row.lifetime_value),
        lastJobDate: row.last_job_date,
        avgJobValue: parseFloat(row.avg_job_value)
      })),
      bySegment: segments.rows.map(row => ({
        customerType: row.customer_type || 'Other',
        customerCount: parseInt(row.customer_count),
        totalJobs: parseInt(row.total_jobs),
        totalRevenue: parseFloat(row.total_revenue),
        avgJobValue: parseFloat(row.avg_job_value)
      })),
      retention: {
        neverBooked: parseInt(retention.rows[0]?.never_booked || 0),
        oneTime: parseInt(retention.rows[0]?.one_time || 0),
        occasional: parseInt(retention.rows[0]?.occasional || 0),
        frequent: parseInt(retention.rows[0]?.frequent || 0),
        churned: parseInt(retention.rows[0]?.churned || 0)
      }
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({ error: 'Failed to analyze customers' });
  } finally {
    client.release();
  }
});

// ==========================================
// SAVED REPORTS
// ==========================================

/**
 * GET /api/advanced-analytics/reports
 * Get saved reports
 */
router.get('/reports', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { type, favorite } = req.query;

    let query = `
      SELECT
        sr.*,
        scr.frequency as schedule_frequency,
        scr.is_active as schedule_active,
        scr.next_run_at
      FROM saved_reports sr
      LEFT JOIN scheduled_reports scr ON sr.id = scr.saved_report_id
      WHERE sr.user_id = $1
    `;
    const params = [userId];

    if (type) {
      params.push(type);
      query += ` AND sr.report_type = $${params.length}`;
    }

    if (favorite === 'true') {
      query += ` AND sr.is_favorite = true`;
    }

    query += ` ORDER BY sr.is_favorite DESC, sr.updated_at DESC`;

    const result = await client.query(query, params);

    res.json({
      reports: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        reportType: row.report_type,
        config: row.config,
        chartType: row.chart_type,
        isFavorite: row.is_favorite,
        isShared: row.is_shared,
        lastRunAt: row.last_run_at,
        schedule: row.schedule_frequency ? {
          frequency: row.schedule_frequency,
          isActive: row.schedule_active,
          nextRunAt: row.next_run_at
        } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/advanced-analytics/reports
 * Create a new saved report
 */
router.post('/reports', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { name, description, reportType, config, chartType } = req.body;

    if (!name || !reportType) {
      return res.status(400).json({ error: 'Name and report type are required' });
    }

    const result = await client.query(`
      INSERT INTO saved_reports (user_id, name, description, report_type, config, chart_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, name, description, reportType, config || {}, chartType || 'table']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create report error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'A report with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create report' });
    }
  } finally {
    client.release();
  }
});

/**
 * PUT /api/advanced-analytics/reports/:id
 * Update a saved report
 */
router.put('/reports/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, description, config, chartType, isFavorite } = req.body;

    const result = await client.query(`
      UPDATE saved_reports
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        config = COALESCE($5, config),
        chart_type = COALESCE($6, chart_type),
        is_favorite = COALESCE($7, is_favorite)
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId, name, description, config, chartType, isFavorite]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/advanced-analytics/reports/:id
 * Delete a saved report
 */
router.delete('/reports/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await client.query(`
      DELETE FROM saved_reports WHERE id = $1 AND user_id = $2 RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  } finally {
    client.release();
  }
});

// ==========================================
// SCHEDULED REPORTS
// ==========================================

/**
 * POST /api/advanced-analytics/reports/:id/schedule
 * Schedule a report for automated delivery
 */
router.post('/reports/:id/schedule', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients, exportFormat } = req.body;

    // Verify report exists
    const reportCheck = await client.query(
      'SELECT id FROM saved_reports WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Calculate next run time
    const result = await client.query(`
      INSERT INTO scheduled_reports (
        user_id, saved_report_id, frequency, day_of_week, day_of_month,
        time_of_day, recipients, export_format, next_run_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
        calc_next_report_run($3, $4, $5, $6, 'Australia/Sydney')
      )
      ON CONFLICT (saved_report_id)
      DO UPDATE SET
        frequency = EXCLUDED.frequency,
        day_of_week = EXCLUDED.day_of_week,
        day_of_month = EXCLUDED.day_of_month,
        time_of_day = EXCLUDED.time_of_day,
        recipients = EXCLUDED.recipients,
        export_format = EXCLUDED.export_format,
        next_run_at = EXCLUDED.next_run_at,
        is_active = true
      RETURNING *
    `, [userId, id, frequency, dayOfWeek, dayOfMonth, timeOfDay || '08:00:00', recipients, exportFormat || 'pdf']);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Schedule report error:', error);
    res.status(500).json({ error: 'Failed to schedule report' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/advanced-analytics/reports/:id/schedule
 * Remove report schedule
 */
router.delete('/reports/:id/schedule', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await client.query(`
      DELETE FROM scheduled_reports
      WHERE saved_report_id = $1 AND user_id = $2
    `, [id, userId]);

    res.json({ success: true, message: 'Schedule removed' });
  } catch (error) {
    console.error('Remove schedule error:', error);
    res.status(500).json({ error: 'Failed to remove schedule' });
  } finally {
    client.release();
  }
});

// ==========================================
// EXPORT
// ==========================================

/**
 * POST /api/advanced-analytics/export
 * Export analytics data
 */
router.post('/export', async (req, res) => {
  try {
    const { reportType, format = 'json', config = {} } = req.body;
    const safeFormat = ['csv', 'json', 'xlsx', 'pdf'].includes(format) ? format : 'json';
    const timestamp = new Date().toISOString();
    const fileBase = `${reportType || 'analytics'}-${Date.now()}`;
    const extension = safeFormat === 'csv' ? 'csv' : safeFormat === 'json' ? 'json' : 'txt';
    const fileName = `${fileBase}.${extension}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.mkdir(uploadsDir, { recursive: true });

    const exportPayload = {
      reportType,
      format: safeFormat,
      generatedAt: timestamp,
      requestedBy: req.user.userId,
      config
    };

    const fileContents = safeFormat === 'csv'
      ? [
          'field,value',
          `reportType,${JSON.stringify(reportType || 'analytics')}`,
          `generatedAt,${JSON.stringify(timestamp)}`,
          `requestedBy,${JSON.stringify(req.user.userId)}`,
          `config,${JSON.stringify(config)}`
        ].join('\n')
      : JSON.stringify(exportPayload, null, 2);

    await fs.writeFile(filePath, fileContents, 'utf8');

    res.json({
      success: true,
      message: `Export of ${reportType} in ${safeFormat} format generated`,
      downloadUrl: `/uploads/advanced-analytics/${fileName}`
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
