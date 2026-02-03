/**
 * Workflow Automation Routes
 * API endpoints for workflow management and execution
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { executeWorkflow, checkWorkflowTriggers } from '../services/workflowEngine.js';
import db from '../config/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/workflows
 * Get all workflows for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trigger_type, is_active } = req.query;

    let query = 'SELECT * FROM workflows WHERE user_id = $1';
    const params = [userId];

    if (trigger_type) {
      params.push(trigger_type);
      query += ` AND trigger_type = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY priority DESC, created_at DESC';

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/workflows/:id
 * Get a specific workflow with its actions
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get workflow
    const workflowResult = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Get actions
    const actionsResult = await db.query(
      'SELECT * FROM workflow_actions WHERE workflow_id = $1 ORDER BY action_order ASC',
      [id]
    );

    workflow.actions = actionsResult.rows;

    res.json(workflow);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, trigger_type, trigger_config, is_active, priority, actions } = req.body;

    // Validate required fields
    if (!name || !trigger_type || !trigger_config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create workflow
    const workflowResult = await db.query(
      `INSERT INTO workflows (user_id, name, description, trigger_type, trigger_config, is_active, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        name,
        description || null,
        trigger_type,
        JSON.stringify(trigger_config),
        is_active !== false,
        priority || 0
      ]
    );

    const workflow = workflowResult.rows[0];

    // Create actions if provided
    if (actions && actions.length > 0) {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        await db.query(
          `INSERT INTO workflow_actions (workflow_id, action_order, action_type, action_config, retry_on_failure, max_retries)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            workflow.id,
            i + 1,
            action.action_type,
            JSON.stringify(action.action_config),
            action.retry_on_failure !== false,
            action.max_retries || 3
          ]
        );
      }
    }

    res.status(201).json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * PUT /api/workflows/:id
 * Update a workflow
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, description, trigger_type, trigger_config, is_active, priority } = req.body;

    const result = await db.query(
      `UPDATE workflows
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           trigger_type = COALESCE($3, trigger_type),
           trigger_config = COALESCE($4, trigger_config),
           is_active = COALESCE($5, is_active),
           priority = COALESCE($6, priority),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [
        name,
        description,
        trigger_type,
        trigger_config ? JSON.stringify(trigger_config) : null,
        is_active,
        priority,
        id,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

/**
 * POST /api/workflows/:id/execute
 * Manually execute a workflow
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { trigger_data } = req.body;

    // Verify workflow exists and belongs to user
    const workflowResult = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Execute workflow
    const result = await executeWorkflow(id, trigger_data || {}, userId);

    res.json(result);
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: error.message || 'Failed to execute workflow' });
  }
});

/**
 * POST /api/workflows/:id/toggle
 * Toggle workflow active status
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE workflows
       SET is_active = NOT is_active,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ error: 'Failed to toggle workflow' });
  }
});

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a workflow
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify workflow belongs to user
    const workflowResult = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Get executions
    const result = await db.query(
      `SELECT * FROM workflow_executions
       WHERE workflow_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

/**
 * GET /api/workflows/executions/:executionId/logs
 * Get action logs for a specific execution
 */
router.get('/executions/:executionId/logs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { executionId } = req.params;

    // Verify execution belongs to user's workflow
    const executionResult = await db.query(
      `SELECT we.* FROM workflow_executions we
       JOIN workflows w ON we.workflow_id = w.id
       WHERE we.id = $1 AND w.user_id = $2`,
      [executionId, userId]
    );

    if (executionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Get action logs
    const logsResult = await db.query(
      `SELECT wal.*, wa.action_type, wa.action_order
       FROM workflow_action_logs wal
       JOIN workflow_actions wa ON wal.action_id = wa.id
       WHERE wal.execution_id = $1
       ORDER BY wa.action_order ASC`,
      [executionId]
    );

    res.json(logsResult.rows);
  } catch (error) {
    console.error('Error fetching action logs:', error);
    res.status(500).json({ error: 'Failed to fetch action logs' });
  }
});

/**
 * GET /api/workflows/templates
 * Get available workflow templates
 */
router.get('/templates/list', async (req, res) => {
  try {
    const { category } = req.query;

    let query = 'SELECT * FROM workflow_templates WHERE is_public = TRUE';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY category, name';

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/workflows/from-template/:templateId
 * Create a workflow from a template
 */
router.post('/from-template/:templateId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.params;
    const { name, customConfig } = req.body;

    // Get template
    const templateResult = await db.query(
      'SELECT * FROM workflow_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Create workflow from template
    const workflowResult = await db.query(
      `INSERT INTO workflows (user_id, name, description, trigger_type, trigger_config, is_active, priority)
       VALUES ($1, $2, $3, $4, $5, TRUE, 0)
       RETURNING *`,
      [
        userId,
        name || template.name,
        template.description,
        template.trigger_type,
        JSON.stringify(customConfig || template.trigger_config)
      ]
    );

    const workflow = workflowResult.rows[0];

    // Create actions from template
    const templateActions = template.actions;
    for (let i = 0; i < templateActions.length; i++) {
      const action = templateActions[i];
      await db.query(
        `INSERT INTO workflow_actions (workflow_id, action_order, action_type, action_config, retry_on_failure, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          workflow.id,
          i + 1,
          action.action_type,
          JSON.stringify(action.action_config),
          action.retry_on_failure !== false,
          action.max_retries || 3
        ]
      );
    }

    res.status(201).json(workflow);
  } catch (error) {
    console.error('Error creating workflow from template:', error);
    res.status(500).json({ error: 'Failed to create workflow from template' });
  }
});

/**
 * POST /api/workflows/trigger
 * Manually trigger workflows of a specific type
 */
router.post('/trigger', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trigger_type, trigger_data } = req.body;

    if (!trigger_type) {
      return res.status(400).json({ error: 'Missing trigger_type' });
    }

    // Trigger workflows
    await checkWorkflowTriggers(trigger_type, trigger_data || {}, userId);

    res.json({ message: 'Workflows triggered successfully' });
  } catch (error) {
    console.error('Error triggering workflows:', error);
    res.status(500).json({ error: 'Failed to trigger workflows' });
  }
});

/**
 * GET /api/workflows/stats
 * Get workflow statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get workflow counts
    const workflowStats = await db.query(
      `SELECT
         COUNT(*) as total_workflows,
         COUNT(*) FILTER (WHERE is_active = TRUE) as active_workflows,
         COUNT(DISTINCT trigger_type) as trigger_types
       FROM workflows
       WHERE user_id = $1`,
      [userId]
    );

    // Get execution stats (last 30 days)
    const executionStats = await db.query(
      `SELECT
         COUNT(*) as total_executions,
         COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
         COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
         AVG(execution_time_ms) as avg_execution_time
       FROM workflow_executions
       WHERE user_id = $1
         AND started_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );

    // Get most active workflows
    const topWorkflows = await db.query(
      `SELECT w.id, w.name, COUNT(we.id) as execution_count
       FROM workflows w
       LEFT JOIN workflow_executions we ON w.id = we.workflow_id
         AND we.started_at > NOW() - INTERVAL '30 days'
       WHERE w.user_id = $1
       GROUP BY w.id, w.name
       ORDER BY execution_count DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      workflows: workflowStats.rows[0],
      executions: executionStats.rows[0],
      topWorkflows: topWorkflows.rows
    });
  } catch (error) {
    console.error('Error fetching workflow stats:', error);
    res.status(500).json({ error: 'Failed to fetch workflow stats' });
  }
});

export default router;
