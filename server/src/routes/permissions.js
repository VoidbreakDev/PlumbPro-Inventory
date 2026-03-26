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

const splitFullName = (fullName = '') => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ')
  };
};

const toRoleTemplate = (row) => ({
  id: row.id,
  name: row.name,
  displayName: row.display_name,
  description: row.description,
  level: row.level,
  permissions: row.permissions || {},
  quoteApprovalThreshold: row.quote_approval_threshold,
  poApprovalThreshold: row.po_approval_threshold,
  isSystem: Boolean(row.is_system_role),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toCustomRole = (row) => ({
  id: row.id,
  name: row.name,
  displayName: row.display_name,
  description: row.description,
  baseTemplateId: row.base_template_id,
  baseTemplateName: row.base_template_name,
  permissions: row.permissions || {},
  quoteApprovalThreshold: row.quote_approval_threshold,
  poApprovalThreshold: row.po_approval_threshold,
  userCount: Number(row.user_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toPermissionWorkflow = (row) => ({
  id: row.id,
  entityType: row.entity_type,
  name: row.name,
  description: row.description,
  thresholdMin: row.threshold_min,
  thresholdMax: row.threshold_max,
  requiredRoleLevel: row.required_role_level,
  requiredRoleName: row.required_role_name,
  requireMultipleApprovers: Boolean(row.require_multiple_approvers),
  minApprovers: row.min_approvers,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at
});

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

    res.json({ roles: result.rows.map(toRoleTemplate) });
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

    res.json(toRoleTemplate(result.rows[0]));
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
        rt.display_name as base_template_name,
        COUNT(ura.id) FILTER (WHERE ura.is_active = true) as user_count
      FROM custom_roles cr
      LEFT JOIN role_templates rt ON cr.base_template_id = rt.id
      LEFT JOIN user_role_assignments ura ON ura.custom_role_id = cr.id
      WHERE cr.user_id = $1
      GROUP BY cr.id, rt.display_name
      ORDER BY cr.created_at DESC
    `, [userId]);

    res.json({ roles: result.rows.map(toCustomRole) });
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

    res.status(201).json(toCustomRole({ ...result.rows[0], user_count: 0 }));
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

    res.json(toCustomRole({ ...result.rows[0], user_count: 0 }));
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
    const currentUserResult = await client.query(
      'SELECT team_id FROM users WHERE id = $1',
      [userId]
    );
    const teamId = currentUserResult.rows[0]?.team_id || null;

    const params = [userId];
    let whereClause = 'u.id = $1';
    if (teamId) {
      params.push(teamId);
      whereClause = '(u.id = $1 OR u.team_id = $2)';
    }

    const result = await client.query(`
      SELECT
        u.id,
        u.email,
        u.full_name,
        ura.assigned_at,
        ura.assigned_by,
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
      WHERE ${whereClause}
      ORDER BY u.full_name
    `, params);

    res.json({
      users: result.rows.map((row) => {
        const { firstName, lastName } = splitFullName(row.full_name || row.email);
        const roleType = row.role_template_id ? 'template' : row.custom_role_id ? 'custom' : null;
        return {
          id: row.id,
          email: row.email,
          firstName,
          lastName,
          roleId: row.role_template_id || row.custom_role_id,
          roleName: row.role_name || row.custom_role_name,
          roleDisplayName: row.role_display_name || row.custom_role_display_name,
          roleType,
          roleLevel: Number(row.role_level || 0),
          assignedAt: row.assigned_at,
          assignedBy: row.assigned_by
        };
      })
    });
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
    const {
      roleTemplateId,
      customRoleId,
      roleId,
      roleType,
      validUntil,
      permissionOverrides
    } = req.body;

    const resolvedRoleTemplateId = roleType === 'template' ? roleId : roleTemplateId;
    const resolvedCustomRoleId = roleType === 'custom' ? roleId : customRoleId;

    if (!resolvedRoleTemplateId && !resolvedCustomRoleId) {
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
    `, [userId, resolvedRoleTemplateId, resolvedCustomRoleId, assignerId, validUntil, permissionOverrides || {}]);

    // Log the action
    await client.query(`
      INSERT INTO permission_audit_log (user_id, action_type, target_user_id, details)
      VALUES ($1, 'role_assigned', $2, $3)
    `, [assignerId, userId, JSON.stringify({
      role_template_id: resolvedRoleTemplateId,
      custom_role_id: resolvedCustomRoleId
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
    const { entityType } = req.query;

    const params = [userId];
    let query = `
      SELECT *
      FROM permission_workflows
      WHERE user_id = $1
    `;

    if (entityType) {
      params.push(entityType);
      query += ` AND entity_type = $2`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, params);

    res.json({ workflows: result.rows.map(toPermissionWorkflow) });
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
      entityType,
      name,
      description,
      thresholdMin,
      thresholdMax,
      requiredRoleLevel,
      requiredRoleName,
      requireMultipleApprovers,
      minApprovers
    } = req.body;

    if (!entityType || !name || requiredRoleLevel === undefined || requiredRoleLevel === null) {
      return res.status(400).json({ error: 'Entity type, name, and required role level are required' });
    }

    const result = await client.query(`
      INSERT INTO permission_workflows (
        user_id, entity_type, name, description, threshold_min, threshold_max,
        required_role_level, required_role_name, require_multiple_approvers, min_approvers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      userId,
      entityType,
      name,
      description || null,
      thresholdMin ?? null,
      thresholdMax ?? null,
      requiredRoleLevel,
      requiredRoleName || null,
      Boolean(requireMultipleApprovers),
      requireMultipleApprovers ? (minApprovers || 2) : 1
    ]);

    res.status(201).json(toPermissionWorkflow(result.rows[0]));
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
        u.full_name as requested_by_name,
        pw.name as workflow_name,
        pw.min_approvers as required_approvals,
        COALESCE((
          SELECT COUNT(*)
          FROM approval_history ah
          WHERE ah.pending_approval_id = pa.id
            AND ah.action = 'approved'
        ), 0) as approval_count
      FROM pending_approvals pa
      JOIN users u ON pa.requested_by = u.id
      LEFT JOIN permission_workflows pw ON pa.workflow_id = pw.id
      WHERE pa.user_id = $1
        AND pa.status = 'pending'
        AND (pa.expires_at IS NULL OR pa.expires_at > CURRENT_TIMESTAMP)
      ORDER BY pa.created_at DESC
    `, [userId]);

    res.json({
      approvals: result.rows.map((row) => ({
        id: row.id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name || 'Approval',
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityReference: row.approval_data?.reference || row.entity_id,
        amount: row.approval_data?.amount ?? null,
        requestedById: row.requested_by,
        requestedByName: row.requested_by_name,
        requestedAt: row.requested_at,
        status: row.status,
        notes: row.request_notes,
        expiresAt: row.expires_at,
        approvalCount: Number(row.approval_count || 0),
        requiredApprovals: Number(row.required_approvals || 1),
        userRoleLevel: roleLevel
      }))
    });
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
    const notes = req.body.notes ?? req.body.comments ?? null;

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
    const notes = req.body.notes ?? req.body.comments ?? null;

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

    const [result, countResult] = await Promise.all([
      client.query(`
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
    `, [userId, parseInt(limit), parseInt(offset)]),
      client.query(`
        SELECT COUNT(*)::int AS total
        FROM permission_audit_log pal
        WHERE pal.user_id = $1 OR pal.target_user_id = $1
      `, [userId])
    ]);

    res.json({
      entries: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.performer_name,
        action: row.action_type,
        targetUserId: row.target_user_id,
        targetUserName: row.target_user_name,
        details: row.details || {},
        ipAddress: row.ip_address,
        createdAt: row.created_at
      })),
      total: Number(countResult.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  } finally {
    client.release();
  }
});

export default router;
