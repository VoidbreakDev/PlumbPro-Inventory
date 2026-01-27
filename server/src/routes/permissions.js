/**
 * Permissions & Roles Routes
 * Phase 3: Advanced user permissions and role management
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// ==========================================
// ROLE TEMPLATES
// ==========================================

/**
 * GET /api/permissions/roles
 * Get all role templates
 */
router.get('/roles', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id, name, display_name, description, level,
        is_system_role, is_default, permissions,
        quote_approval_threshold, po_approval_threshold,
        created_at, updated_at
      FROM role_templates
      ORDER BY level ASC
    `);

    res.json({ roles: result.rows });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/permissions/roles/:id
 * Get a specific role template
 */
router.get('/roles/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT * FROM role_templates WHERE id = $1 OR name = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to get role' });
  } finally {
    client.release();
  }
});

// ==========================================
// CUSTOM ROLES
// ==========================================

/**
 * GET /api/permissions/custom-roles
 * Get organization's custom roles
 */
router.get('/custom-roles', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const result = await client.query(`
      SELECT
        cr.*,
        rt.display_name as base_template_name
      FROM custom_roles cr
      LEFT JOIN role_templates rt ON cr.base_template_id = rt.id
      WHERE cr.user_id = $1
      ORDER BY cr.created_at DESC
    `, [userId]);

    res.json({ customRoles: result.rows });
  } catch (error) {
    console.error('Get custom roles error:', error);
    res.status(500).json({ error: 'Failed to get custom roles' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/custom-roles
 * Create a custom role
 */
router.post('/custom-roles', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const {
      name,
      displayName,
      description,
      baseTemplateId,
      permissions,
      quoteApprovalThreshold,
      poApprovalThreshold
    } = req.body;

    if (!name || !displayName || !permissions) {
      return res.status(400).json({ error: 'Name, display name, and permissions are required' });
    }

    const result = await client.query(`
      INSERT INTO custom_roles (
        user_id, name, display_name, description, base_template_id,
        permissions, quote_approval_threshold, po_approval_threshold
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId, name, displayName, description, baseTemplateId,
      permissions, quoteApprovalThreshold, poApprovalThreshold
    ]);

    // Log the action
    await client.query(`
      INSERT INTO permission_audit_log (user_id, action_type, details)
      VALUES ($1, 'role_assigned', $2)
    `, [userId, JSON.stringify({ action: 'created_custom_role', role_name: name })]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create custom role error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'A role with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create custom role' });
    }
  } finally {
    client.release();
  }
});

/**
 * PUT /api/permissions/custom-roles/:id
 * Update a custom role
 */
router.put('/custom-roles/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { displayName, description, permissions, quoteApprovalThreshold, poApprovalThreshold, isActive } = req.body;

    const result = await client.query(`
      UPDATE custom_roles
      SET
        display_name = COALESCE($3, display_name),
        description = COALESCE($4, description),
        permissions = COALESCE($5, permissions),
        quote_approval_threshold = COALESCE($6, quote_approval_threshold),
        po_approval_threshold = COALESCE($7, po_approval_threshold),
        is_active = COALESCE($8, is_active)
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId, displayName, description, permissions, quoteApprovalThreshold, poApprovalThreshold, isActive]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update custom role error:', error);
    res.status(500).json({ error: 'Failed to update custom role' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/permissions/custom-roles/:id
 * Delete a custom role
 */
router.delete('/custom-roles/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Check if any users have this role
    const assignmentCheck = await client.query(`
      SELECT COUNT(*) FROM user_role_assignments
      WHERE custom_role_id = $1 AND is_active = true
    `, [id]);

    if (parseInt(assignmentCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete role',
        details: 'This role is assigned to active users. Please reassign them first.'
      });
    }

    const result = await client.query(`
      DELETE FROM custom_roles WHERE id = $1 AND user_id = $2 RETURNING id, name
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    console.error('Delete custom role error:', error);
    res.status(500).json({ error: 'Failed to delete custom role' });
  } finally {
    client.release();
  }
});

// ==========================================
// USER ROLE ASSIGNMENTS
// ==========================================

/**
 * GET /api/permissions/users
 * Get all users with their roles
 */
router.get('/users', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const result = await client.query(`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.created_at as user_created_at,
        ura.id as assignment_id,
        ura.is_active as role_active,
        ura.assigned_at,
        ura.valid_until,
        rt.id as role_template_id,
        rt.name as role_name,
        rt.display_name as role_display_name,
        rt.level as role_level,
        cr.id as custom_role_id,
        cr.name as custom_role_name,
        cr.display_name as custom_role_display_name
      FROM users u
      LEFT JOIN user_role_assignments ura ON u.id = ura.assigned_user_id AND ura.is_active = true
      LEFT JOIN role_templates rt ON ura.role_template_id = rt.id
      LEFT JOIN custom_roles cr ON ura.custom_role_id = cr.id
      WHERE u.id = $1 OR EXISTS (
        SELECT 1 FROM team_members tm WHERE tm.user_id = $1 AND tm.member_user_id = u.id
      )
      ORDER BY u.full_name
    `, [userId]);

    // Group by user
    const usersMap = new Map();
    result.rows.forEach(row => {
      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          email: row.email,
          fullName: row.full_name,
          createdAt: row.user_created_at,
          role: null
        });
      }

      if (row.role_template_id || row.custom_role_id) {
        usersMap.get(row.id).role = {
          assignmentId: row.assignment_id,
          isActive: row.role_active,
          assignedAt: row.assigned_at,
          validUntil: row.valid_until,
          templateId: row.role_template_id,
          customRoleId: row.custom_role_id,
          name: row.role_name || row.custom_role_name,
          displayName: row.role_display_name || row.custom_role_display_name,
          level: row.role_level
        };
      }
    });

    res.json({ users: Array.from(usersMap.values()) });
  } catch (error) {
    console.error('Get users with roles error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/users/:userId/role
 * Assign a role to a user
 */
router.post('/users/:userId/role', async (req, res) => {
  const client = await pool.connect();

  try {
    const assignerId = req.user.userId;
    const { userId } = req.params;
    const { roleTemplateId, customRoleId, validUntil, permissionOverrides } = req.body;

    if (!roleTemplateId && !customRoleId) {
      return res.status(400).json({ error: 'Either roleTemplateId or customRoleId is required' });
    }

    await client.query('BEGIN');

    // Deactivate existing role assignment
    await client.query(`
      UPDATE user_role_assignments
      SET is_active = false
      WHERE assigned_user_id = $1 AND is_active = true
    `, [userId]);

    // Create new assignment
    const result = await client.query(`
      INSERT INTO user_role_assignments (
        assigned_user_id, role_template_id, custom_role_id,
        assigned_by, valid_until, permission_overrides
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, roleTemplateId, customRoleId, assignerId, validUntil, permissionOverrides || {}]);

    // Log the action
    await client.query(`
      INSERT INTO permission_audit_log (user_id, action_type, target_user_id, details)
      VALUES ($1, 'role_assigned', $2, $3)
    `, [assignerId, userId, JSON.stringify({
      role_template_id: roleTemplateId,
      custom_role_id: customRoleId
    })]);

    await client.query('COMMIT');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/permissions/users/:userId/role
 * Remove role from user
 */
router.delete('/users/:userId/role', async (req, res) => {
  const client = await pool.connect();

  try {
    const assignerId = req.user.userId;
    const { userId } = req.params;

    const result = await client.query(`
      UPDATE user_role_assignments
      SET is_active = false
      WHERE assigned_user_id = $1 AND is_active = true
      RETURNING *
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active role assignment found' });
    }

    // Log the action
    await client.query(`
      INSERT INTO permission_audit_log (user_id, action_type, target_user_id, details)
      VALUES ($1, 'role_removed', $2, $3)
    `, [assignerId, userId, JSON.stringify({ removed_assignment: result.rows[0].id })]);

    res.json({ success: true, message: 'Role removed' });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  } finally {
    client.release();
  }
});

// ==========================================
// PERMISSION CHECKING
// ==========================================

/**
 * GET /api/permissions/check
 * Check if current user has specific permission
 */
router.get('/check', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { permission } = req.query;

    if (!permission) {
      return res.status(400).json({ error: 'Permission parameter required' });
    }

    // Get user's role and permissions
    const roleResult = await client.query(`
      SELECT
        ura.permission_overrides,
        COALESCE(rt.permissions, cr.permissions) as role_permissions,
        rt.quote_approval_threshold,
        rt.po_approval_threshold,
        rt.level as role_level
      FROM user_role_assignments ura
      LEFT JOIN role_templates rt ON ura.role_template_id = rt.id
      LEFT JOIN custom_roles cr ON ura.custom_role_id = cr.id
      WHERE ura.assigned_user_id = $1
        AND ura.is_active = true
        AND (ura.valid_until IS NULL OR ura.valid_until > CURRENT_TIMESTAMP)
      LIMIT 1
    `, [userId]);

    if (roleResult.rows.length === 0) {
      return res.json({ hasPermission: false, reason: 'No active role' });
    }

    const { role_permissions, permission_overrides, role_level } = roleResult.rows[0];

    // Owner has all permissions
    if (role_level === 5) {
      return res.json({ hasPermission: true, reason: 'Owner role' });
    }

    // Check permission path
    const pathParts = permission.split('.');
    let current = permission_overrides?.[pathParts[0]] || role_permissions;

    for (const part of pathParts) {
      if (current === undefined || current === null) {
        return res.json({ hasPermission: false, reason: 'Permission not found' });
      }
      current = current[part];
    }

    const hasPermission = current === true;
    res.json({ hasPermission, reason: hasPermission ? 'Granted by role' : 'Not granted' });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/permissions/my-permissions
 * Get current user's full permission set
 */
router.get('/my-permissions', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const result = await client.query(`
      SELECT
        ura.id as assignment_id,
        ura.permission_overrides,
        ura.valid_until,
        rt.id as role_template_id,
        rt.name as role_name,
        rt.display_name as role_display_name,
        rt.level as role_level,
        rt.permissions as template_permissions,
        rt.quote_approval_threshold,
        rt.po_approval_threshold,
        cr.id as custom_role_id,
        cr.name as custom_role_name,
        cr.display_name as custom_role_display_name,
        cr.permissions as custom_permissions,
        cr.quote_approval_threshold as custom_quote_threshold,
        cr.po_approval_threshold as custom_po_threshold
      FROM user_role_assignments ura
      LEFT JOIN role_templates rt ON ura.role_template_id = rt.id
      LEFT JOIN custom_roles cr ON ura.custom_role_id = cr.id
      WHERE ura.assigned_user_id = $1
        AND ura.is_active = true
        AND (ura.valid_until IS NULL OR ura.valid_until > CURRENT_TIMESTAMP)
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        hasRole: false,
        role: null,
        permissions: {},
        thresholds: {}
      });
    }

    const row = result.rows[0];
    const basePermissions = row.template_permissions || row.custom_permissions || {};
    const effectivePermissions = {
      ...basePermissions,
      ...(row.permission_overrides || {})
    };

    res.json({
      hasRole: true,
      role: {
        id: row.role_template_id || row.custom_role_id,
        name: row.role_name || row.custom_role_name,
        displayName: row.role_display_name || row.custom_role_display_name,
        level: row.role_level,
        isTemplate: !!row.role_template_id,
        validUntil: row.valid_until
      },
      permissions: effectivePermissions,
      thresholds: {
        quote: row.quote_approval_threshold || row.custom_quote_threshold,
        purchaseOrder: row.po_approval_threshold || row.custom_po_threshold
      }
    });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  } finally {
    client.release();
  }
});

// ==========================================
// APPROVAL WORKFLOWS
// ==========================================

/**
 * GET /api/permissions/workflows
 * Get approval workflows
 */
router.get('/workflows', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    const result = await client.query(`
      SELECT * FROM approval_workflows
      WHERE user_id = $1
      ORDER BY priority DESC, created_at DESC
    `, [userId]);

    res.json({ workflows: result.rows });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/workflows
 * Create approval workflow
 */
router.post('/workflows', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const {
      workflowType,
      triggerCondition,
      approvalChain,
      requireAllApprovers,
      autoApproveAfterHours,
      escalationHours,
      priority
    } = req.body;

    if (!workflowType || !triggerCondition || !approvalChain) {
      return res.status(400).json({ error: 'Workflow type, trigger condition, and approval chain are required' });
    }

    const result = await client.query(`
      INSERT INTO approval_workflows (
        user_id, workflow_type, trigger_condition, approval_chain,
        require_all_approvers, auto_approve_after_hours, escalation_hours, priority
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId, workflowType, triggerCondition, approvalChain,
      requireAllApprovers || false, autoApproveAfterHours, escalationHours, priority || 0
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/permissions/pending-approvals
 * Get pending approvals for current user
 */
router.get('/pending-approvals', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get user's role level
    const roleResult = await client.query(`
      SELECT rt.level
      FROM user_role_assignments ura
      JOIN role_templates rt ON ura.role_template_id = rt.id
      WHERE ura.assigned_user_id = $1 AND ura.is_active = true
      LIMIT 1
    `, [userId]);

    const roleLevel = roleResult.rows[0]?.level || 0;

    const result = await client.query(`
      SELECT
        pa.*,
        u.full_name as requested_by_name
      FROM pending_approvals pa
      JOIN users u ON pa.requested_by = u.id
      WHERE pa.user_id = $1
        AND pa.status = 'pending'
        AND (pa.expires_at IS NULL OR pa.expires_at > CURRENT_TIMESTAMP)
      ORDER BY pa.created_at DESC
    `, [userId]);

    res.json({ pendingApprovals: result.rows, userRoleLevel: roleLevel });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to get pending approvals' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/pending-approvals/:id/approve
 * Approve a pending approval
 */
router.post('/pending-approvals/:id/approve', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { notes } = req.body;

    await client.query('BEGIN');

    // Get the pending approval
    const approvalResult = await client.query(`
      SELECT * FROM pending_approvals WHERE id = $1 AND status = 'pending'
    `, [id]);

    if (approvalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending approval not found' });
    }

    // Update status
    await client.query(`
      UPDATE pending_approvals
      SET status = 'approved', resolved_by = $2, resolved_at = CURRENT_TIMESTAMP, resolution_notes = $3
      WHERE id = $1
    `, [id, userId, notes]);

    // Add to history
    await client.query(`
      INSERT INTO approval_history (pending_approval_id, approver_id, approver_index, action, notes)
      VALUES ($1, $2, $3, 'approved', $4)
    `, [id, userId, approvalResult.rows[0].current_approver_index, notes]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/permissions/pending-approvals/:id/reject
 * Reject a pending approval
 */
router.post('/pending-approvals/:id/reject', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { notes } = req.body;

    await client.query('BEGIN');

    // Update status
    await client.query(`
      UPDATE pending_approvals
      SET status = 'rejected', resolved_by = $2, resolved_at = CURRENT_TIMESTAMP, resolution_notes = $3
      WHERE id = $1 AND status = 'pending'
    `, [id, userId, notes]);

    // Add to history
    await client.query(`
      INSERT INTO approval_history (pending_approval_id, approver_id, approver_index, action, notes)
      VALUES ($1, $2, 0, 'rejected', $3)
    `, [id, userId, notes]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Rejected' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject' });
  } finally {
    client.release();
  }
});

// ==========================================
// AUDIT LOG
// ==========================================

/**
 * GET /api/permissions/audit-log
 * Get permission audit log
 */
router.get('/audit-log', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await client.query(`
      SELECT
        pal.*,
        u.full_name as performer_name,
        tu.full_name as target_user_name
      FROM permission_audit_log pal
      JOIN users u ON pal.user_id = u.id
      LEFT JOIN users tu ON pal.target_user_id = tu.id
      WHERE pal.user_id = $1 OR pal.target_user_id = $1
      ORDER BY pal.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    res.json({ auditLog: result.rows });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  } finally {
    client.release();
  }
});

export default router;
