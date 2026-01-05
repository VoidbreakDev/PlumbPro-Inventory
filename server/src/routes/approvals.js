/**
 * Approval Workflows Routes
 * API endpoints for approval workflow management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/approvals
 * Get all approval workflows for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, entity_type } = req.query;

    let query = `
      SELECT aw.*,
             u1.username as requested_by_name,
             COUNT(ast.id) as total_stages,
             COUNT(ast.id) FILTER (WHERE ast.status = 'approved') as approved_stages
      FROM approval_workflows aw
      LEFT JOIN users u1 ON aw.requested_by = u1.id
      LEFT JOIN approval_stages ast ON aw.id = ast.approval_workflow_id
      WHERE aw.user_id = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND aw.status = $${params.length}`;
    }

    if (entity_type) {
      params.push(entity_type);
      query += ` AND aw.entity_type = $${params.length}`;
    }

    query += ' GROUP BY aw.id, u1.username ORDER BY aw.requested_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * GET /api/approvals/pending
 * Get pending approvals where current user is an approver
 */
router.get('/pending', async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT aw.*,
             u1.username as requested_by_name,
             ast.id as stage_id,
             ast.stage_number,
             ast.status as stage_status
      FROM approval_workflows aw
      JOIN approval_stages ast ON aw.id = ast.approval_workflow_id
      LEFT JOIN users u1 ON aw.requested_by = u1.id
      WHERE ast.approver_id = $1
        AND ast.status = 'pending'
        AND aw.status = 'pending'
      ORDER BY aw.requested_at ASC
    `;

    const result = await db.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /api/approvals/:id
 * Get a specific approval workflow with all stages
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get approval workflow
    const approvalResult = await db.query(
      `SELECT aw.*, u1.username as requested_by_name
       FROM approval_workflows aw
       LEFT JOIN users u1 ON aw.requested_by = u1.id
       WHERE aw.id = $1 AND aw.user_id = $2`,
      [id, userId]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval workflow not found' });
    }

    const approval = approvalResult.rows[0];

    // Get stages
    const stagesResult = await db.query(
      `SELECT ast.*, u.username as approver_name
       FROM approval_stages ast
       LEFT JOIN users u ON ast.approver_id = u.id
       WHERE ast.approval_workflow_id = $1
       ORDER BY ast.stage_number ASC`,
      [id]
    );

    approval.stages = stagesResult.rows;

    res.json(approval);
  } catch (error) {
    console.error('Error fetching approval:', error);
    res.status(500).json({ error: 'Failed to fetch approval' });
  }
});

/**
 * POST /api/approvals
 * Create a new approval workflow
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { entity_type, entity_id, approvers } = req.body;

    // Validate required fields
    if (!entity_type || !entity_id || !approvers || approvers.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create approval workflow
    const approvalResult = await db.query(
      `INSERT INTO approval_workflows
       (user_id, entity_type, entity_id, current_stage, total_stages, requested_by)
       VALUES ($1, $2, $3, 1, $4, $5)
       RETURNING *`,
      [userId, entity_type, entity_id, approvers.length, userId]
    );

    const approval = approvalResult.rows[0];

    // Create approval stages
    for (let i = 0; i < approvers.length; i++) {
      await db.query(
        `INSERT INTO approval_stages
         (approval_workflow_id, stage_number, approver_id)
         VALUES ($1, $2, $3)`,
        [approval.id, i + 1, approvers[i]]
      );
    }

    res.status(201).json(approval);
  } catch (error) {
    console.error('Error creating approval:', error);
    res.status(500).json({ error: 'Failed to create approval' });
  }
});

/**
 * POST /api/approvals/:id/approve
 * Approve a stage in the approval workflow
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { comments } = req.body;

    // Get current approval workflow
    const approvalResult = await db.query(
      'SELECT * FROM approval_workflows WHERE id = $1',
      [id]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval workflow not found' });
    }

    const approval = approvalResult.rows[0];

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval workflow is not pending' });
    }

    // Get current stage
    const stageResult = await db.query(
      `SELECT * FROM approval_stages
       WHERE approval_workflow_id = $1
         AND stage_number = $2
         AND approver_id = $3`,
      [id, approval.current_stage, userId]
    );

    if (stageResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to approve this stage' });
    }

    const stage = stageResult.rows[0];

    if (stage.status !== 'pending') {
      return res.status(400).json({ error: 'This stage has already been processed' });
    }

    // Update stage to approved
    await db.query(
      `UPDATE approval_stages
       SET status = 'approved',
           comments = $1,
           responded_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [comments || null, stage.id]
    );

    // Check if this was the final stage
    if (approval.current_stage >= approval.total_stages) {
      // All stages approved - mark workflow as approved
      await db.query(
        `UPDATE approval_workflows
         SET status = 'approved',
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    } else {
      // Move to next stage
      await db.query(
        `UPDATE approval_workflows
         SET current_stage = current_stage + 1
         WHERE id = $1`,
        [id]
      );
    }

    // Get updated approval
    const updatedResult = await db.query(
      'SELECT * FROM approval_workflows WHERE id = $1',
      [id]
    );

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error approving:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

/**
 * POST /api/approvals/:id/reject
 * Reject a stage in the approval workflow
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { comments } = req.body;

    if (!comments) {
      return res.status(400).json({ error: 'Comments are required for rejection' });
    }

    // Get current approval workflow
    const approvalResult = await db.query(
      'SELECT * FROM approval_workflows WHERE id = $1',
      [id]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval workflow not found' });
    }

    const approval = approvalResult.rows[0];

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval workflow is not pending' });
    }

    // Get current stage
    const stageResult = await db.query(
      `SELECT * FROM approval_stages
       WHERE approval_workflow_id = $1
         AND stage_number = $2
         AND approver_id = $3`,
      [id, approval.current_stage, userId]
    );

    if (stageResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to reject this stage' });
    }

    const stage = stageResult.rows[0];

    if (stage.status !== 'pending') {
      return res.status(400).json({ error: 'This stage has already been processed' });
    }

    // Update stage to rejected
    await db.query(
      `UPDATE approval_stages
       SET status = 'rejected',
           comments = $1,
           responded_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [comments, stage.id]
    );

    // Mark entire workflow as rejected
    await db.query(
      `UPDATE approval_workflows
       SET status = 'rejected',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Get updated approval
    const updatedResult = await db.query(
      'SELECT * FROM approval_workflows WHERE id = $1',
      [id]
    );

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

/**
 * POST /api/approvals/:id/cancel
 * Cancel an approval workflow
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE approval_workflows
       SET status = 'cancelled',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval workflow not found or cannot be cancelled' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling approval:', error);
    res.status(500).json({ error: 'Failed to cancel approval' });
  }
});

/**
 * GET /api/approvals/stats/summary
 * Get approval statistics for the current user
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get overall stats
    const statsResult = await db.query(
      `SELECT
         COUNT(*) as total_approvals,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_approvals,
         COUNT(*) FILTER (WHERE status = 'approved') as approved_approvals,
         COUNT(*) FILTER (WHERE status = 'rejected') as rejected_approvals,
         AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_approval_time
       FROM approval_workflows
       WHERE user_id = $1`,
      [userId]
    );

    // Get pending approvals for user as approver
    const myApprovalsResult = await db.query(
      `SELECT COUNT(*) as pending_my_approvals
       FROM approval_stages ast
       JOIN approval_workflows aw ON ast.approval_workflow_id = aw.id
       WHERE ast.approver_id = $1
         AND ast.status = 'pending'
         AND aw.status = 'pending'`,
      [userId]
    );

    res.json({
      ...statsResult.rows[0],
      pending_my_approvals: parseInt(myApprovalsResult.rows[0].pending_my_approvals)
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({ error: 'Failed to fetch approval stats' });
  }
});

export default router;
