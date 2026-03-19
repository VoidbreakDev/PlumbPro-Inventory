import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Dashboard KPIs
router.get('/dashboard', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Total inventory value
    const inventoryValue = await client.query(`
      SELECT COALESCE(SUM(price * quantity), 0) as total_value
      FROM inventory_items
      WHERE user_id = $1
    `, [userId]);

    // Low stock items count
    const lowStock = await client.query(`
      SELECT COUNT(*) as count
      FROM inventory_items
      WHERE user_id = $1 AND quantity <= reorder_level
    `, [userId]);

    // Jobs by status
    const jobStats = await client.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM jobs
      WHERE user_id = $1
      GROUP BY status
    `, [userId]);

    const projectStats = await client.query(`
      SELECT
        overall_status,
        COUNT(*) as count
      FROM development_projects
      WHERE user_id = $1
      GROUP BY overall_status
    `, [userId]);

    const stageStats = await client.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM development_stages
      WHERE user_id = $1
      GROUP BY status
    `, [userId]);

    const overdueStages = await client.query(`
      SELECT COUNT(*) as count
      FROM development_stages
      WHERE user_id = $1
        AND planned_date < CURRENT_DATE
        AND status IN ('scheduled', 'in_progress')
    `, [userId]);

    // Recent stock movements (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentMovements = await client.query(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(ABS(quantity)) as total_quantity
      FROM stock_movements
      WHERE user_id = $1 AND timestamp >= $2
      GROUP BY type
    `, [userId, thirtyDaysAgo]);

    // Top used items (by quantity moved out)
    const topItems = await client.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        SUM(ABS(sm.quantity)) as total_used
      FROM stock_movements sm
      JOIN inventory_items i ON sm.item_id = i.id
      WHERE sm.user_id = $1
        AND sm.type = 'Out'
        AND sm.timestamp >= $2
      GROUP BY i.id, i.name, i.category
      ORDER BY total_used DESC
      LIMIT 5
    `, [userId, thirtyDaysAgo]);

    res.json({
      inventoryValue: parseFloat(inventoryValue.rows[0].total_value),
      lowStockCount: parseInt(lowStock.rows[0].count),
      jobStats: jobStats.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      projectStats: projectStats.rows.reduce((acc, row) => {
        acc[row.overall_status] = parseInt(row.count);
        return acc;
      }, {}),
      stageStats: stageStats.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      overdueStageCount: parseInt(overdueStages.rows[0].count),
      recentMovements: recentMovements.rows.map(row => ({
        type: row.type,
        count: parseInt(row.count),
        totalQuantity: parseInt(row.total_quantity)
      })),
      topUsedItems: topItems.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        totalUsed: parseInt(row.total_used)
      }))
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  } finally {
    client.release();
  }
});

// Inventory Analytics
router.get('/inventory', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate).getTime() : Date.now() - (90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // Inventory turnover rate (items sold/used vs average inventory)
    const turnover = await client.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        i.price,
        i.quantity as current_stock,
        i.reorder_level,
        COALESCE(SUM(CASE WHEN sm.type = 'Out' THEN ABS(sm.quantity) ELSE 0 END), 0) as total_used,
        COALESCE(AVG(CASE WHEN sm.type = 'Out' THEN ABS(sm.quantity) ELSE 0 END), 0) as avg_usage,
        COUNT(CASE WHEN sm.type = 'Out' THEN 1 END) as usage_count
      FROM inventory_items i
      LEFT JOIN stock_movements sm ON i.id = sm.item_id
        AND sm.timestamp BETWEEN $2 AND $3
      WHERE i.user_id = $1
      GROUP BY i.id, i.name, i.category, i.price, i.quantity, i.reorder_level
      ORDER BY total_used DESC
    `, [userId, start, end]);

    // Stock value by category
    const categoryValue = await client.query(`
      SELECT
        category,
        COUNT(*) as item_count,
        SUM(quantity) as total_quantity,
        SUM(price * quantity) as total_value
      FROM inventory_items
      WHERE user_id = $1
      GROUP BY category
      ORDER BY total_value DESC
    `, [userId]);

    // Stock aging (items with no recent movement)
    const stockAging = await client.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        i.quantity,
        i.price,
        MAX(sm.timestamp) as last_movement
      FROM inventory_items i
      LEFT JOIN stock_movements sm ON i.id = sm.item_id
      WHERE i.user_id = $1
      GROUP BY i.id, i.name, i.category, i.quantity, i.price
      HAVING MAX(sm.timestamp) < $2 OR MAX(sm.timestamp) IS NULL
      ORDER BY last_movement ASC NULLS FIRST
      LIMIT 20
    `, [userId, Date.now() - (60 * 24 * 60 * 60 * 1000)]); // 60 days

    res.json({
      turnover: turnover.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: parseFloat(row.price),
        currentStock: row.current_stock,
        reorderLevel: row.reorder_level,
        totalUsed: parseInt(row.total_used),
        avgUsage: parseFloat(row.avg_usage),
        usageCount: parseInt(row.usage_count),
        turnoverRate: row.current_stock > 0 ? (parseFloat(row.total_used) / row.current_stock).toFixed(2) : 0
      })),
      categoryValue: categoryValue.rows.map(row => ({
        category: row.category,
        itemCount: parseInt(row.item_count),
        totalQuantity: parseInt(row.total_quantity),
        totalValue: parseFloat(row.total_value)
      })),
      stockAging: stockAging.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        price: parseFloat(row.price),
        lastMovement: row.last_movement,
        daysIdle: row.last_movement ? Math.floor((Date.now() - row.last_movement) / (24 * 60 * 60 * 1000)) : null
      }))
    });

  } catch (error) {
    console.error('Inventory analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory analytics' });
  } finally {
    client.release();
  }
});

// Job Profitability Analysis
router.get('/jobs/profitability', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate).getTime() : Date.now() - (90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // Jobs with material costs
    const jobProfitability = await client.query(`
      SELECT
        j.id,
        j.title,
        j.job_type,
        j.builder,
        j.status,
        j.date,
        COALESCE(SUM(i.price * jai.quantity), 0) as material_cost,
        COUNT(DISTINCT jw.worker_id) as worker_count,
        COUNT(jai.item_id) as item_count
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id
      LEFT JOIN job_workers jw ON j.id = jw.job_id
      WHERE j.user_id = $1
        AND EXTRACT(EPOCH FROM j.date) * 1000 BETWEEN $2 AND $3
      GROUP BY j.id, j.title, j.job_type, j.builder, j.status, j.date
      ORDER BY j.date DESC
    `, [userId, start, end]);

    // Job type analysis
    const jobTypeStats = await client.query(`
      SELECT
        j.job_type,
        COUNT(*) as job_count,
        AVG(material_costs.cost) as avg_material_cost,
        SUM(material_costs.cost) as total_material_cost
      FROM jobs j
      LEFT JOIN (
        SELECT
          jai.job_id,
          SUM(i.price * jai.quantity) as cost
        FROM job_allocated_items jai
        JOIN inventory_items i ON jai.item_id = i.id
        GROUP BY jai.job_id
      ) material_costs ON j.id = material_costs.job_id
      WHERE j.user_id = $1
        AND EXTRACT(EPOCH FROM j.date) * 1000 BETWEEN $2 AND $3
      GROUP BY j.job_type
      ORDER BY job_count DESC
    `, [userId, start, end]);

    // Monthly job trends
    const monthlyTrends = await client.query(`
      SELECT
        TO_CHAR(j.date, 'YYYY-MM') as month,
        COUNT(*) as job_count,
        COUNT(CASE WHEN j.status = 'Completed' THEN 1 END) as completed_count,
        SUM(material_costs.cost) as total_material_cost
      FROM jobs j
      LEFT JOIN (
        SELECT
          jai.job_id,
          SUM(i.price * jai.quantity) as cost
        FROM job_allocated_items jai
        JOIN inventory_items i ON jai.item_id = i.id
        GROUP BY jai.job_id
      ) material_costs ON j.id = material_costs.job_id
      WHERE j.user_id = $1
        AND EXTRACT(EPOCH FROM j.date) * 1000 BETWEEN $2 AND $3
      GROUP BY TO_CHAR(j.date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `, [userId, start, end]);

    res.json({
      jobs: jobProfitability.rows.map(row => ({
        id: row.id,
        title: row.title,
        jobType: row.job_type,
        builder: row.builder,
        status: row.status,
        date: row.date,
        materialCost: parseFloat(row.material_cost),
        workerCount: parseInt(row.worker_count),
        itemCount: parseInt(row.item_count)
      })),
      jobTypeStats: jobTypeStats.rows.map(row => ({
        jobType: row.job_type,
        jobCount: parseInt(row.job_count),
        avgMaterialCost: parseFloat(row.avg_material_cost || 0),
        totalMaterialCost: parseFloat(row.total_material_cost || 0)
      })),
      monthlyTrends: monthlyTrends.rows.map(row => ({
        month: row.month,
        jobCount: parseInt(row.job_count),
        completedCount: parseInt(row.completed_count),
        totalMaterialCost: parseFloat(row.total_material_cost || 0)
      }))
    });

  } catch (error) {
    console.error('Job profitability error:', error);
    res.status(500).json({ error: 'Failed to fetch job profitability' });
  } finally {
    client.release();
  }
});

// Worker Performance
router.get('/workers/performance', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate).getTime() : Date.now() - (90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    const workerStats = await client.query(`
      SELECT
        c.id,
        c.name,
        COUNT(DISTINCT j.id) as total_jobs,
        COUNT(CASE WHEN j.status = 'Completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN j.status = 'In Progress' THEN 1 END) as in_progress_jobs,
        COALESCE(SUM(material_costs.cost), 0) as total_materials_handled
      FROM contacts c
      LEFT JOIN job_workers jw ON c.id = jw.worker_id
      LEFT JOIN jobs j ON jw.job_id = j.id
        AND EXTRACT(EPOCH FROM j.date) * 1000 BETWEEN $2 AND $3
      LEFT JOIN (
        SELECT
          jai.job_id,
          SUM(i.price * jai.quantity) as cost
        FROM job_allocated_items jai
        JOIN inventory_items i ON jai.item_id = i.id
        GROUP BY jai.job_id
      ) material_costs ON j.id = material_costs.job_id
      WHERE c.user_id = $1 AND c.type = 'Plumber'
      GROUP BY c.id, c.name
      ORDER BY total_jobs DESC
    `, [userId, start, end]);

    res.json({
      workers: workerStats.rows.map(row => ({
        id: row.id,
        name: row.name,
        totalJobs: parseInt(row.total_jobs || 0),
        completedJobs: parseInt(row.completed_jobs || 0),
        inProgressJobs: parseInt(row.in_progress_jobs || 0),
        totalMaterialsHandled: parseFloat(row.total_materials_handled),
        completionRate: row.total_jobs > 0 ?
          ((parseInt(row.completed_jobs) / parseInt(row.total_jobs)) * 100).toFixed(1) : 0
      }))
    });

  } catch (error) {
    console.error('Worker performance error:', error);
    res.status(500).json({ error: 'Failed to fetch worker performance' });
  } finally {
    client.release();
  }
});

// Supplier Performance
router.get('/suppliers/performance', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const supplierStats = await client.query(`
      SELECT
        c.id,
        c.name,
        c.company,
        COUNT(i.id) as total_items,
        SUM(i.quantity) as total_stock,
        SUM(i.price * i.quantity) as total_value,
        COUNT(CASE WHEN i.quantity <= i.reorder_level THEN 1 END) as low_stock_items
      FROM contacts c
      LEFT JOIN inventory_items i ON c.id = i.supplier_id
      WHERE c.user_id = $1 AND c.type = 'Supplier'
      GROUP BY c.id, c.name, c.company
      ORDER BY total_value DESC
    `, [userId]);

    res.json({
      suppliers: supplierStats.rows.map(row => ({
        id: row.id,
        name: row.name,
        company: row.company,
        totalItems: parseInt(row.total_items || 0),
        totalStock: parseInt(row.total_stock || 0),
        totalValue: parseFloat(row.total_value || 0),
        lowStockItems: parseInt(row.low_stock_items || 0)
      }))
    });

  } catch (error) {
    console.error('Supplier performance error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier performance' });
  } finally {
    client.release();
  }
});

// Stock Movement Trends
router.get('/movements/trends', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate).getTime() : Date.now() - (30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // Determine SQL date format based on groupBy
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';

    const trends = await client.query(`
      SELECT
        TO_CHAR(TO_TIMESTAMP(timestamp / 1000), $4) as period,
        type,
        COUNT(*) as movement_count,
        SUM(ABS(quantity)) as total_quantity
      FROM stock_movements
      WHERE user_id = $1
        AND timestamp BETWEEN $2 AND $3
      GROUP BY TO_CHAR(TO_TIMESTAMP(timestamp / 1000), $4), type
      ORDER BY period DESC, type
    `, [userId, start, end, dateFormat]);

    res.json({
      trends: trends.rows.map(row => ({
        period: row.period,
        type: row.type,
        movementCount: parseInt(row.movement_count),
        totalQuantity: parseInt(row.total_quantity)
      }))
    });

  } catch (error) {
    console.error('Movement trends error:', error);
    res.status(500).json({ error: 'Failed to fetch movement trends' });
  } finally {
    client.release();
  }
});

// ABC Classification Summary
router.get('/abc-classification', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get ABC classification distribution
    const distribution = await client.query(`
      SELECT
        abc_classification,
        COUNT(*) as item_count,
        COALESCE(SUM(quantity * COALESCE(sell_price_excl_gst, price)), 0) as total_value
      FROM inventory_items
      WHERE user_id = $1 AND abc_classification IS NOT NULL
      GROUP BY abc_classification
      ORDER BY abc_classification
    `, [userId]);

    // Get top A items
    const topAItems = await client.query(`
      SELECT
        id,
        name,
        category,
        quantity,
        COALESCE(sell_price_excl_gst, price) as price,
        (quantity * COALESCE(sell_price_excl_gst, price)) as total_value,
        usage_frequency_score,
        allocation_rate_score
      FROM inventory_items
      WHERE user_id = $1 AND abc_classification = 'A'
      ORDER BY (quantity * COALESCE(sell_price_excl_gst, price)) DESC
      LIMIT 10
    `, [userId]);

    res.json({
      distribution: distribution.rows.map(row => ({
        classification: row.abc_classification,
        itemCount: parseInt(row.item_count),
        totalValue: parseFloat(row.total_value)
      })),
      topAItems: topAItems.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        price: parseFloat(row.price),
        totalValue: parseFloat(row.total_value),
        usageFrequency: row.usage_frequency_score,
        allocationRate: parseFloat(row.allocation_rate_score)
      }))
    });

  } catch (error) {
    console.error('ABC classification error:', error);
    res.status(500).json({ error: 'Failed to fetch ABC classification' });
  } finally {
    client.release();
  }
});

// Recalculate ABC Classification
router.post('/recalculate-abc', async (req, res) => {
  const client = await pool.connect();

  try {
    // Call the database function to recalculate ABC classification
    await client.query('SELECT calculate_abc_classification()');

    res.json({ message: 'ABC classification recalculated successfully' });

  } catch (error) {
    console.error('Recalculate ABC error:', error);
    res.status(500).json({ error: 'Failed to recalculate ABC classification' });
  } finally {
    client.release();
  }
});

// Dead Stock Report
router.get('/dead-stock', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get all dead stock items
    const deadStockItems = await client.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        i.quantity,
        COALESCE(i.sell_price_excl_gst, i.price) as price,
        (i.quantity * COALESCE(i.sell_price_excl_gst, i.price)) as total_value,
        i.last_movement_date,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'locationId', ls.location_id,
              'locationName', l.name,
              'quantity', ls.quantity
            )
          ) FILTER (WHERE ls.location_id IS NOT NULL),
          '[]'
        ) as location_stock
      FROM inventory_items i
      LEFT JOIN location_stock ls ON i.id = ls.item_id
      LEFT JOIN locations l ON ls.location_id = l.id
      WHERE i.user_id = $1 AND i.is_dead_stock = true
      GROUP BY i.id
      ORDER BY i.last_movement_date ASC NULLS FIRST, (i.quantity * COALESCE(i.sell_price_excl_gst, i.price)) DESC
    `, [userId]);

    // Calculate summary
    const summary = await client.query(`
      SELECT
        COUNT(*) as dead_stock_count,
        COALESCE(SUM(quantity * COALESCE(sell_price_excl_gst, price)), 0) as total_value_tied_up
      FROM inventory_items
      WHERE user_id = $1 AND is_dead_stock = true
    `, [userId]);

    res.json({
      summary: {
        count: parseInt(summary.rows[0].dead_stock_count),
        totalValue: parseFloat(summary.rows[0].total_value_tied_up)
      },
      items: deadStockItems.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        price: parseFloat(row.price),
        totalValue: parseFloat(row.total_value),
        lastMovementDate: row.last_movement_date,
        locationStock: row.location_stock || [],
        daysSinceLastMovement: row.last_movement_date
          ? Math.floor((Date.now() - new Date(row.last_movement_date).getTime()) / (1000 * 60 * 60 * 24))
          : null
      }))
    });

  } catch (error) {
    console.error('Dead stock report error:', error);
    res.status(500).json({ error: 'Failed to fetch dead stock report' });
  } finally {
    client.release();
  }
});

export default router;
