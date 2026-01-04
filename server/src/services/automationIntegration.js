/**
 * Automation Integration Service
 * Connects workflow automation to inventory, jobs, and other services
 */

import { checkWorkflowTriggers } from './workflowEngine.js';
import db from '../config/database.js';

/**
 * Trigger workflows when stock levels change
 */
export const triggerStockWorkflows = async (userId, itemId, newQuantity, oldQuantity) => {
  try {
    // Get item details
    const itemResult = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) return;

    const item = itemResult.rows[0];
    const reorderLevel = item.reorder_level || 0;

    // Build trigger data
    const triggerData = {
      itemId: item.id,
      itemName: item.name,
      quantity: newQuantity,
      oldQuantity: oldQuantity,
      reorderLevel: reorderLevel,
      supplier: item.supplier,
      price: item.price,
      category: item.category,
      movementType: newQuantity > oldQuantity ? 'in' : 'out',
      recommendedOrderQty: calculateReorderQuantity(newQuantity, reorderLevel)
    };

    // Trigger stock level workflows
    await checkWorkflowTriggers('stock_level', triggerData, userId);

    console.log(`[Automation] Stock workflows triggered for ${item.name}`);
  } catch (error) {
    console.error('[Automation] Failed to trigger stock workflows:', error);
  }
};

/**
 * Trigger workflows when job status changes
 */
export const triggerJobWorkflows = async (userId, jobId, newStatus, oldStatus) => {
  try {
    // Get job details
    const jobResult = await db.query(
      `SELECT j.*, c.name as customer_name, c.email as customer_email
       FROM jobs j
       LEFT JOIN contacts c ON j.contact_id = c.id
       WHERE j.id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) return;

    const job = jobResult.rows[0];

    // Build trigger data
    const triggerData = {
      jobId: job.id,
      jobName: job.name,
      status: newStatus,
      oldStatus: oldStatus,
      scheduledDate: job.scheduled_date,
      customerName: job.customer_name,
      customerEmail: job.customer_email,
      description: job.description,
      notes: job.notes,
      completedDate: newStatus === 'completed' ? new Date().toISOString() : null
    };

    // Trigger job status workflows
    await checkWorkflowTriggers('job_status', triggerData, userId);

    console.log(`[Automation] Job workflows triggered for ${job.name} (${oldStatus} -> ${newStatus})`);
  } catch (error) {
    console.error('[Automation] Failed to trigger job workflows:', error);
  }
};

/**
 * Trigger workflows when stock movement occurs
 */
export const triggerStockMovementWorkflows = async (userId, itemId, quantity, type, notes) => {
  try {
    // Get current stock level
    const itemResult = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) return;

    const item = itemResult.rows[0];
    const oldQuantity = item.quantity;
    const newQuantity = type === 'In' ? oldQuantity + quantity : oldQuantity - quantity;

    // Trigger stock workflows with movement data
    await triggerStockWorkflows(userId, itemId, newQuantity, oldQuantity);

    // If it's a large movement, trigger additional workflows
    if (Math.abs(quantity) >= 50) {
      const triggerData = {
        itemId: item.id,
        itemName: item.name,
        quantity: Math.abs(quantity),
        movementType: type,
        notes: notes,
        timestamp: new Date().toISOString()
      };

      await checkWorkflowTriggers('stock_level', triggerData, userId);
    }
  } catch (error) {
    console.error('[Automation] Failed to trigger stock movement workflows:', error);
  }
};

/**
 * Calculate recommended reorder quantity
 */
function calculateReorderQuantity(currentQuantity, reorderLevel) {
  // Simple calculation: order enough to reach 3x reorder level
  const targetQuantity = reorderLevel * 3;
  const needed = targetQuantity - currentQuantity;
  return Math.max(needed, reorderLevel);
}

/**
 * Check for overdue jobs and trigger workflows
 */
export const checkOverdueJobs = async () => {
  try {
    const result = await db.query(
      `SELECT j.*, u.id as user_id
       FROM jobs j
       JOIN users u ON j.user_id = u.id
       WHERE j.status IN ('pending', 'in_progress')
         AND j.scheduled_date < CURRENT_DATE
         AND j.scheduled_date IS NOT NULL`
    );

    const overdueJobs = result.rows;

    // Group by user
    const jobsByUser = {};
    overdueJobs.forEach(job => {
      if (!jobsByUser[job.user_id]) {
        jobsByUser[job.user_id] = [];
      }
      jobsByUser[job.user_id].push(job);
    });

    // Trigger workflows for each user
    for (const userId in jobsByUser) {
      const userJobs = jobsByUser[userId];
      const triggerData = {
        overdueCount: userJobs.length,
        overdueJobsList: userJobs.map(j => `${j.name} (${j.scheduled_date})`).join(', '),
        jobs: userJobs
      };

      await checkWorkflowTriggers('time_schedule', triggerData, userId);
    }

    console.log(`[Automation] Checked ${overdueJobs.length} overdue jobs`);
  } catch (error) {
    console.error('[Automation] Failed to check overdue jobs:', error);
  }
};

/**
 * Auto-assign jobs using assignment rules
 */
export const autoAssignJob = async (userId, jobId) => {
  try {
    // Get active assignment rules for jobs
    const rulesResult = await db.query(
      `SELECT * FROM assignment_rules
       WHERE user_id = $1 AND entity_type = 'job' AND is_active = TRUE
       ORDER BY priority DESC`,
      [userId]
    );

    if (rulesResult.rows.length === 0) {
      console.log('[Automation] No active assignment rules found');
      return null;
    }

    // Get job details
    const jobResult = await db.query(
      'SELECT * FROM jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) return null;

    const job = jobResult.rows[0];

    // Find matching rule
    for (const rule of rulesResult.rows) {
      if (matchesRuleConditions(job, rule.rule_conditions)) {
        // Execute assignment strategy
        const workerId = await executeAssignmentStrategy(
          rule.assignment_strategy,
          rule.assignment_config,
          userId,
          jobId
        );

        if (workerId) {
          // Assign worker to job
          await db.query(
            `INSERT INTO job_workers (job_id, worker_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [jobId, workerId]
          );

          console.log(`[Automation] Auto-assigned job ${jobId} to worker ${workerId} using rule: ${rule.name}`);

          // Trigger job status workflow for assignment
          await triggerJobWorkflows(userId, jobId, 'assigned', job.status);

          return workerId;
        }
      }
    }

    console.log('[Automation] No matching assignment rules found');
    return null;
  } catch (error) {
    console.error('[Automation] Failed to auto-assign job:', error);
    return null;
  }
};

/**
 * Check if job matches rule conditions
 */
function matchesRuleConditions(job, conditions) {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  for (const field in conditions) {
    const expected = conditions[field];
    const actual = job[field];

    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (expected !== actual) {
      return false;
    }
  }

  return true;
}

/**
 * Execute assignment strategy
 */
async function executeAssignmentStrategy(strategy, config, userId, jobId) {
  switch (strategy) {
    case 'round_robin':
      return await findWorkerRoundRobin(userId);

    case 'least_busy':
      return await findLeastBusyWorker(userId);

    case 'skills_based':
      return await findWorkerBySkills(config.requiredSkills || [], userId);

    case 'location_based':
      return await findWorkerByLocation(config.location, userId);

    default:
      return await findWorkerRoundRobin(userId);
  }
}

async function findWorkerRoundRobin(userId) {
  const result = await db.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN job_workers jw ON u.id = jw.worker_id
     WHERE u.id IN (SELECT id FROM users WHERE id != $1)
     GROUP BY u.id
     ORDER BY COUNT(jw.job_id) ASC, MAX(jw.created_at) ASC NULLS FIRST
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id || userId;
}

async function findLeastBusyWorker(userId) {
  const result = await db.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN job_workers jw ON u.id = jw.worker_id
     LEFT JOIN jobs j ON jw.job_id = j.id AND j.status IN ('pending', 'in_progress')
     WHERE u.id IN (SELECT id FROM users WHERE id != $1)
     GROUP BY u.id
     ORDER BY COUNT(j.id) ASC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id || userId;
}

async function findWorkerBySkills(requiredSkills, userId) {
  // Placeholder - would need a skills table
  // For now, fall back to round robin
  return await findWorkerRoundRobin(userId);
}

async function findWorkerByLocation(location, userId) {
  // Placeholder - would need location data
  // For now, fall back to round robin
  return await findWorkerRoundRobin(userId);
}

/**
 * Create stock trigger for automatic monitoring
 */
export const createStockTrigger = async (userId, itemId, triggerType, threshold = null, workflowId = null) => {
  try {
    await db.query(
      `INSERT INTO stock_triggers (user_id, item_id, trigger_type, threshold_value, workflow_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (user_id, item_id, trigger_type) DO UPDATE
       SET threshold_value = $4, workflow_id = $5, is_active = TRUE`,
      [userId, itemId, triggerType, threshold, workflowId]
    );

    console.log(`[Automation] Created stock trigger: ${triggerType} for item ${itemId}`);
  } catch (error) {
    console.error('[Automation] Failed to create stock trigger:', error);
    throw error;
  }
};

export default {
  triggerStockWorkflows,
  triggerJobWorkflows,
  triggerStockMovementWorkflows,
  checkOverdueJobs,
  autoAssignJob,
  createStockTrigger
};
