/**
 * Workflow Automation Engine
 * Handles trigger detection, workflow execution, and action processing
 */

import db from '../config/database.js';
import { sendEmail } from './emailService.js';
import { createNotification } from './notificationService.js';

/**
 * Execute a workflow
 */
export const executeWorkflow = async (workflowId, triggerData = {}, userId) => {
  const executionId = await startExecution(workflowId, userId, triggerData);

  try {
    // Get workflow and its actions
    const workflow = await getWorkflow(workflowId);

    if (!workflow.is_active) {
      throw new Error('Workflow is not active');
    }

    // Get all actions ordered by action_order
    const actions = await getWorkflowActions(workflowId);

    console.log(`[Workflow] Executing workflow: ${workflow.name} (${actions.length} actions)`);

    // Execute actions in order
    for (const action of actions) {
      await executeAction(action, executionId, triggerData, userId);
    }

    // Mark execution as completed
    await completeExecution(executionId, 'completed');

    return { success: true, executionId };
  } catch (error) {
    console.error('[Workflow] Execution failed:', error);
    await completeExecution(executionId, 'failed', error.message);
    throw error;
  }
};

/**
 * Execute a single action
 */
async function executeAction(action, executionId, context, userId) {
  const actionLogId = await createActionLog(executionId, action.id);

  try {
    await updateActionLog(actionLogId, 'running');

    const startTime = Date.now();

    let result;

    switch (action.action_type) {
      case 'send_notification':
        result = await actionSendNotification(action.action_config, context, userId);
        break;

      case 'send_email':
        result = await actionSendEmail(action.action_config, context, userId);
        break;

      case 'create_job':
        result = await actionCreateJob(action.action_config, context, userId);
        break;

      case 'update_stock':
        result = await actionUpdateStock(action.action_config, context, userId);
        break;

      case 'assign_worker':
        result = await actionAssignWorker(action.action_config, context, userId);
        break;

      case 'create_purchase_order':
        result = await actionCreatePurchaseOrder(action.action_config, context, userId);
        break;

      case 'webhook':
        result = await actionWebhook(action.action_config, context);
        break;

      case 'update_job_status':
        result = await actionUpdateJobStatus(action.action_config, context, userId);
        break;

      case 'delay':
        result = await actionDelay(action.action_config);
        break;

      case 'conditional':
        result = await actionConditional(action.action_config, context);
        break;

      default:
        throw new Error(`Unknown action type: ${action.action_type}`);
    }

    const executionTime = Date.now() - startTime;

    await updateActionLog(actionLogId, 'success', {
      output_data: result,
      execution_time_ms: executionTime
    });

    return result;
  } catch (error) {
    console.error(`[Workflow] Action ${action.action_type} failed:`, error);

    await updateActionLog(actionLogId, 'failed', {
      error_message: error.message
    });

    // Retry if configured
    if (action.retry_on_failure) {
      const retryCount = await getRetryCount(actionLogId);

      if (retryCount < action.max_retries) {
        console.log(`[Workflow] Retrying action (attempt ${retryCount + 1}/${action.max_retries})`);
        await incrementRetryCount(actionLogId);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
        return await executeAction(action, executionId, context, userId);
      }
    }

    throw error;
  }
}

/**
 * Action: Send Notification
 */
async function actionSendNotification(config, context, userId) {
  const { title, message, type, priority } = config;

  // Replace placeholders in message
  const processedMessage = replacePlaceholders(message, context);

  await createNotification(userId, {
    type: type || 'info',
    title: title || 'Workflow Notification',
    message: processedMessage,
    priority: priority || 'normal'
  });

  return { sent: true, message: processedMessage };
}

/**
 * Action: Send Email
 */
async function actionSendEmail(config, context, userId) {
  const { recipient, subject, body, template } = config;

  const processedSubject = replacePlaceholders(subject, context);
  const processedBody = replacePlaceholders(body, context);

  const user = await getUserById(userId);
  const recipientEmail = recipient || user.email;

  await sendEmail(recipientEmail, processedSubject, processedBody);

  return { sent: true, recipient: recipientEmail };
}

/**
 * Action: Create Job
 */
async function actionCreateJob(config, context, userId) {
  const { name, description, scheduledDate, templateId } = config;

  const jobData = {
    name: replacePlaceholders(name, context),
    description: replacePlaceholders(description || '', context),
    scheduled_date: scheduledDate || new Date(),
    status: 'pending',
    user_id: userId
  };

  const result = await db.query(
    `INSERT INTO jobs (name, description, scheduled_date, status, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [jobData.name, jobData.description, jobData.scheduled_date, jobData.status, jobData.user_id]
  );

  return { jobId: result.rows[0].id };
}

/**
 * Action: Update Stock
 */
async function actionUpdateStock(config, context, userId) {
  const { itemId, quantity, operation, notes } = config;

  const actualItemId = context.itemId || itemId;
  const actualQuantity = quantity || context.quantity || 0;

  // Record stock movement
  await db.query(
    `INSERT INTO stock_movements (user_id, item_id, quantity, type, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, actualItemId, actualQuantity, operation === 'increase' ? 'In' : 'Out', notes]
  );

  // Update item quantity
  const multiplier = operation === 'increase' ? 1 : -1;
  await db.query(
    `UPDATE inventory_items
     SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3`,
    [actualQuantity * multiplier, actualItemId, userId]
  );

  return { itemId: actualItemId, quantity: actualQuantity, operation };
}

/**
 * Action: Assign Worker
 */
async function actionAssignWorker(config, context, userId) {
  const { jobId, workerId, strategy } = config;

  const actualJobId = context.jobId || jobId;
  let actualWorkerId = workerId;

  // If no worker specified, use assignment strategy
  if (!actualWorkerId && strategy) {
    actualWorkerId = await findWorkerByStrategy(strategy, actualJobId, userId);
  }

  if (!actualWorkerId) {
    throw new Error('No worker available for assignment');
  }

  // Assign worker to job
  await db.query(
    `INSERT INTO job_workers (job_id, worker_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [actualJobId, actualWorkerId]
  );

  // Send notification to worker
  await createNotification(actualWorkerId, {
    type: 'job_assigned',
    title: 'New Job Assigned',
    message: `You have been assigned to a new job`,
    data: { jobId: actualJobId }
  });

  return { jobId: actualJobId, workerId: actualWorkerId };
}

/**
 * Action: Create Purchase Order
 */
async function actionCreatePurchaseOrder(config, context, userId) {
  const { itemId, quantity, supplier, notes } = config;

  const actualItemId = context.itemId || itemId;
  const actualQuantity = quantity || context.recommendedOrderQty || 0;

  // Get item details
  const itemResult = await db.query(
    `SELECT name, price, supplier FROM inventory_items WHERE id = $1`,
    [actualItemId]
  );

  if (itemResult.rows.length === 0) {
    throw new Error('Item not found');
  }

  const item = itemResult.rows[0];
  const actualSupplier = supplier || item.supplier || 'Unknown';

  // Create notification about PO
  await createNotification(userId, {
    type: 'purchase_order',
    title: 'Purchase Order Created',
    message: `PO created for ${actualQuantity}x ${item.name} from ${actualSupplier}`,
    data: {
      itemId: actualItemId,
      quantity: actualQuantity,
      supplier: actualSupplier
    }
  });

  return {
    itemId: actualItemId,
    itemName: item.name,
    quantity: actualQuantity,
    supplier: actualSupplier,
    estimatedCost: item.price * actualQuantity
  };
}

/**
 * Action: Webhook
 */
async function actionWebhook(config, context) {
  const { url, method, headers, body } = config;

  const processedBody = body ? JSON.parse(replacePlaceholders(JSON.stringify(body), context)) : context;

  const response = await fetch(url, {
    method: method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(processedBody)
  });

  const responseData = await response.json().catch(() => ({}));

  return {
    status: response.status,
    statusText: response.statusText,
    data: responseData
  };
}

/**
 * Action: Update Job Status
 */
async function actionUpdateJobStatus(config, context, userId) {
  const { jobId, status } = config;

  const actualJobId = context.jobId || jobId;

  await db.query(
    `UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3`,
    [status, actualJobId, userId]
  );

  return { jobId: actualJobId, status };
}

/**
 * Action: Delay
 */
async function actionDelay(config) {
  const { duration } = config; // in milliseconds

  await new Promise(resolve => setTimeout(resolve, duration));

  return { delayed: duration };
}

/**
 * Action: Conditional
 */
async function actionConditional(config, context) {
  const { condition, ifTrue, ifFalse } = config;

  const result = evaluateCondition(condition, context);

  return { conditionMet: result, branch: result ? 'true' : 'false' };
}

/**
 * Check if workflow should be triggered
 */
export const checkWorkflowTriggers = async (triggerType, triggerData, userId) => {
  // Get all active workflows for this trigger type
  const result = await db.query(
    `SELECT * FROM workflows
     WHERE user_id = $1 AND trigger_type = $2 AND is_active = TRUE
     ORDER BY priority DESC`,
    [userId, triggerType]
  );

  const workflows = result.rows;

  for (const workflow of workflows) {
    // Check if trigger conditions match
    if (shouldTriggerWorkflow(workflow, triggerData)) {
      console.log(`[Workflow] Triggering workflow: ${workflow.name}`);

      // Execute workflow asynchronously
      executeWorkflow(workflow.id, triggerData, userId).catch(error => {
        console.error(`[Workflow] Failed to execute workflow ${workflow.name}:`, error);
      });
    }
  }
};

/**
 * Check if workflow conditions are met
 */
function shouldTriggerWorkflow(workflow, triggerData) {
  const config = workflow.trigger_config;

  switch (workflow.trigger_type) {
    case 'stock_level':
      return checkStockLevelTrigger(config, triggerData);

    case 'job_status':
      return checkJobStatusTrigger(config, triggerData);

    case 'project_stage':
      return checkProjectStageTrigger(config, triggerData);

    case 'manual':
      return true; // Always trigger when called manually

    case 'webhook':
      return true; // Always trigger for webhooks

    default:
      return false;
  }
}

function checkStockLevelTrigger(config, data) {
  const { condition, threshold } = config;
  const currentLevel = data.quantity || 0;
  const reorderLevel = data.reorderLevel || 0;

  switch (condition) {
    case 'below_reorder':
      return currentLevel <= reorderLevel;
    case 'out_of_stock':
      return currentLevel === 0;
    case 'below_threshold':
      return currentLevel <= threshold;
    default:
      return false;
  }
}

function checkJobStatusTrigger(config, data) {
  const { targetStatus } = config;
  return data.status === targetStatus;
}

function checkProjectStageTrigger(config, data) {
  const { targetStatus, stageType } = config;

  if (targetStatus && data.status !== targetStatus) {
    return false;
  }

  if (stageType && data.stageType !== stageType) {
    return false;
  }

  return true;
}

/**
 * Helper functions
 */

function replacePlaceholders(text, context) {
  if (!text) return text;

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}

function evaluateCondition(condition, context) {
  // Simple condition evaluation (can be extended)
  const { field, operator, value } = condition;

  const contextValue = context[field];

  switch (operator) {
    case 'equals':
      return contextValue == value;
    case 'not_equals':
      return contextValue != value;
    case 'greater_than':
      return contextValue > value;
    case 'less_than':
      return contextValue < value;
    case 'contains':
      return String(contextValue).includes(value);
    default:
      return false;
  }
}

async function findWorkerByStrategy(strategy, jobId, userId) {
  switch (strategy) {
    case 'round_robin':
      return await findWorkerRoundRobin(userId);
    case 'least_busy':
      return await findLeastBusyWorker(userId);
    default:
      return await findWorkerRoundRobin(userId);
  }
}

async function findWorkerRoundRobin(userId) {
  // Simple round-robin: find worker with least recent assignment
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
  // Find worker with fewest active jobs
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

async function getUserById(userId) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

async function getWorkflow(workflowId) {
  const result = await db.query('SELECT * FROM workflows WHERE id = $1', [workflowId]);
  return result.rows[0];
}

async function getWorkflowActions(workflowId) {
  const result = await db.query(
    `SELECT * FROM workflow_actions WHERE workflow_id = $1 ORDER BY action_order ASC`,
    [workflowId]
  );
  return result.rows;
}

async function startExecution(workflowId, userId, triggerData) {
  const result = await db.query(
    `INSERT INTO workflow_executions (workflow_id, user_id, trigger_data, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [workflowId, userId, JSON.stringify(triggerData)]
  );

  return result.rows[0].id;
}

async function completeExecution(executionId, status, errorMessage = null) {
  const result = await db.query(
    `UPDATE workflow_executions
     SET status = $1,
         completed_at = CURRENT_TIMESTAMP,
         error_message = $2,
         execution_time_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) * 1000
     WHERE id = $3`,
    [status, errorMessage, executionId]
  );

  return result.rowCount > 0;
}

async function createActionLog(executionId, actionId) {
  const result = await db.query(
    `INSERT INTO workflow_action_logs (execution_id, action_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [executionId, actionId]
  );

  return result.rows[0].id;
}

async function updateActionLog(actionLogId, status, updates = {}) {
  const fields = ['status = $1', 'completed_at = CURRENT_TIMESTAMP'];
  const values = [status];
  let paramIndex = 2;

  if (updates.output_data) {
    fields.push(`output_data = $${paramIndex}`);
    values.push(JSON.stringify(updates.output_data));
    paramIndex++;
  }

  if (updates.error_message) {
    fields.push(`error_message = $${paramIndex}`);
    values.push(updates.error_message);
    paramIndex++;
  }

  if (updates.execution_time_ms) {
    fields.push(`execution_time_ms = $${paramIndex}`);
    values.push(updates.execution_time_ms);
    paramIndex++;
  }

  values.push(actionLogId);

  await db.query(
    `UPDATE workflow_action_logs SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

async function getRetryCount(actionLogId) {
  const result = await db.query(
    'SELECT retry_count FROM workflow_action_logs WHERE id = $1',
    [actionLogId]
  );
  return result.rows[0]?.retry_count || 0;
}

async function incrementRetryCount(actionLogId) {
  await db.query(
    'UPDATE workflow_action_logs SET retry_count = retry_count + 1 WHERE id = $1',
    [actionLogId]
  );
}

export default {
  executeWorkflow,
  checkWorkflowTriggers
};
