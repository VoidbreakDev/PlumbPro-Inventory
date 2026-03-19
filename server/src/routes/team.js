/**
 * Team Management Routes
 * API endpoints for team/organization management
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import crypto from 'crypto';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { getAppBaseUrl, sendTeamInvitationEmail } from '../services/emailService.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/team
 * Get current user's team information
 */
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get user with team info
    const userResult = await client.query(`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.team_id,
        u.team_role,
        t.name as team_name,
        t.subscription_tier,
        t.max_users,
        t.owner_id,
        t.settings as team_settings
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // If user has a team, get team members
    let members = [];
    if (user.team_id) {
      const membersResult = await client.query(`
        SELECT
          id,
          email,
          full_name,
          team_role,
          last_active_at,
          created_at
        FROM users
        WHERE team_id = $1 AND is_active = true
        ORDER BY
          CASE team_role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'manager' THEN 3
            WHEN 'member' THEN 4
            WHEN 'viewer' THEN 5
          END,
          full_name
      `, [user.team_id]);

      members = membersResult.rows.map(m => ({
        id: m.id,
        email: m.email,
        fullName: m.full_name,
        role: m.team_role,
        lastActiveAt: m.last_active_at,
        createdAt: m.created_at,
        isCurrentUser: m.id === userId
      }));
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.team_role || 'owner'
      },
      team: user.team_id ? {
        id: user.team_id,
        name: user.team_name,
        subscriptionTier: user.subscription_tier,
        maxUsers: user.max_users,
        isOwner: user.owner_id === userId,
        settings: user.team_settings
      } : null,
      members
    });

  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team information' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/team
 * Create a new team (upgrade from solo to team)
 */
router.post('/', [
  body('name').notEmpty().trim().isLength({ max: 255 }),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { name } = req.body;

    // Check if user already has a team
    const userCheck = await client.query(
      'SELECT team_id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0]?.team_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already belongs to a team' });
    }

    // Create team
    const teamResult = await client.query(`
      INSERT INTO teams (name, owner_id, subscription_tier, max_users)
      VALUES ($1, $2, 'team', 5)
      RETURNING *
    `, [name, userId]);

    const team = teamResult.rows[0];

    // Update user with team membership
    await client.query(`
      UPDATE users
      SET team_id = $1, team_role = 'owner'
      WHERE id = $2
    `, [team.id, userId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Team created successfully',
      team: {
        id: team.id,
        name: team.name,
        subscriptionTier: team.subscription_tier,
        maxUsers: team.max_users
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/team
 * Update team settings (owner/admin only)
 */
router.put('/', [
  body('name').optional().trim().isLength({ max: 255 }),
  body('settings').optional().isObject(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { name, settings } = req.body;

    // Get user's team and role
    const userResult = await client.query(`
      SELECT u.team_id, u.team_role, t.owner_id
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role, owner_id } = userResult.rows[0];

    // Check permission
    if (team_role !== 'owner' && team_role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can update team settings' });
    }

    // Update team
    const updateResult = await client.query(`
      UPDATE teams
      SET
        name = COALESCE($1, name),
        settings = COALESCE($2, settings)
      WHERE id = $3
      RETURNING *
    `, [name, settings ? JSON.stringify(settings) : null, team_id]);

    res.json({
      message: 'Team updated successfully',
      team: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/team/invite
 * Invite a user to the team
 */
router.post('/invite', [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'manager', 'member', 'viewer']),
  body('message').optional().trim(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { email, role, message } = req.body;

    // Get user's team and check permission
    const userResult = await client.query(`
      SELECT u.team_id, u.team_role, u.full_name, t.name as team_name, t.max_users
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0 || !userResult.rows[0].team_id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role, team_name, max_users, full_name } = userResult.rows[0];

    // Check permission to invite
    if (!['owner', 'admin'].includes(team_role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only owners and admins can invite users' });
    }

    // Check team capacity
    const memberCount = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE team_id = $1 AND is_active = true',
      [team_id]
    );

    if (parseInt(memberCount.rows[0].count) >= max_users) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Team has reached maximum users. Upgrade to add more members.'
      });
    }

    // Check if user already exists in team
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND team_id = $2',
      [email, team_id]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User is already a team member' });
    }

    // Check for pending invitation
    const existingInvite = await client.query(
      "SELECT id FROM team_invitations WHERE email = $1 AND team_id = $2 AND status = 'pending'",
      [email, team_id]
    );

    if (existingInvite.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invitation already sent to this email' });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const inviteResult = await client.query(`
      INSERT INTO team_invitations (team_id, email, role, token, invited_by, message, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [team_id, email, role, token, userId, message || null, expiresAt]);

    await client.query('COMMIT');

    const inviteLink = `${getAppBaseUrl()}/?inviteToken=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await sendTeamInvitationEmail({
      to: email,
      teamName: team_name,
      inviterName: full_name,
      role,
      inviteLink,
      message,
      expiresAt
    });

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: inviteResult.rows[0].id,
        email,
        role,
        expiresAt,
        inviteLink
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/team/invitations
 * Get pending invitations for the team
 */
router.get('/invitations', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get user's team
    const userResult = await client.query(
      'SELECT team_id, team_role FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role } = userResult.rows[0];

    // Check permission
    if (!['owner', 'admin'].includes(team_role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const invitations = await client.query(`
      SELECT
        i.*,
        u.full_name as invited_by_name
      FROM team_invitations i
      JOIN users u ON i.invited_by = u.id
      WHERE i.team_id = $1 AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `, [team_id]);

    res.json(invitations.rows.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invited_by_name,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at
    })));

  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/team/invitations/:id
 * Cancel a pending invitation
 */
router.delete('/invitations/:id', [
  param('id').isUUID(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get user's team
    const userResult = await client.query(
      'SELECT team_id, team_role FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role } = userResult.rows[0];

    // Check permission
    if (!['owner', 'admin'].includes(team_role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cancel invitation
    const result = await client.query(`
      UPDATE team_invitations
      SET status = 'cancelled'
      WHERE id = $1 AND team_id = $2 AND status = 'pending'
      RETURNING id
    `, [id, team_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    res.json({ message: 'Invitation cancelled' });

  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/team/members/:id/role
 * Update a team member's role
 */
router.put('/members/:id/role', [
  param('id').isUUID(),
  body('role').isIn(['admin', 'manager', 'member', 'viewer']),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { role } = req.body;

    // Get user's team and role
    const userResult = await client.query(`
      SELECT u.team_id, u.team_role, t.owner_id
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (!userResult.rows[0]?.team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role, owner_id } = userResult.rows[0];

    // Check permission (only owner can change admin roles, admins can change others)
    if (team_role !== 'owner' && (team_role !== 'admin' || role === 'admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cannot change owner's role
    if (id === owner_id) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    // Cannot change your own role
    if (id === userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Verify target user is in the same team
    const targetUser = await client.query(
      'SELECT id FROM users WHERE id = $1 AND team_id = $2',
      [id, team_id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in team' });
    }

    // Update role
    await client.query(
      'UPDATE users SET team_role = $1 WHERE id = $2',
      [role, id]
    );

    res.json({ message: 'Role updated successfully' });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/team/members/:id
 * Remove a team member
 */
router.delete('/members/:id', [
  param('id').isUUID(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get user's team and role
    const userResult = await client.query(`
      SELECT u.team_id, u.team_role, t.owner_id
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (!userResult.rows[0]?.team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, team_role, owner_id } = userResult.rows[0];

    // Check permission
    if (!['owner', 'admin'].includes(team_role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cannot remove owner
    if (id === owner_id) {
      return res.status(400).json({ error: 'Cannot remove team owner' });
    }

    // Cannot remove yourself
    if (id === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself. Use leave team instead.' });
    }

    // Admin cannot remove other admins (only owner can)
    if (team_role === 'admin') {
      const targetUser = await client.query(
        'SELECT team_role FROM users WHERE id = $1 AND team_id = $2',
        [id, team_id]
      );

      if (targetUser.rows[0]?.team_role === 'admin') {
        return res.status(403).json({ error: 'Only the owner can remove admins' });
      }
    }

    // Remove user from team
    await client.query(
      'UPDATE users SET team_id = NULL, team_role = NULL WHERE id = $1 AND team_id = $2',
      [id, team_id]
    );

    res.json({ message: 'Member removed successfully' });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/team/leave
 * Leave the current team
 */
router.post('/leave', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get user's team and role
    const userResult = await client.query(`
      SELECT u.team_id, u.team_role, t.owner_id
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (!userResult.rows[0]?.team_id) {
      return res.status(404).json({ error: 'No team found' });
    }

    const { team_id, owner_id } = userResult.rows[0];

    // Owner cannot leave (must transfer ownership or delete team)
    if (userId === owner_id) {
      return res.status(400).json({
        error: 'Team owner cannot leave. Transfer ownership or delete the team first.'
      });
    }

    // Leave team
    await client.query(
      'UPDATE users SET team_id = NULL, team_role = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Left team successfully' });

  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/team/permissions
 * Get current user's permissions
 */
router.get('/permissions', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.userId;

    // Get user's team and role
    const userResult = await client.query(
      'SELECT team_id, team_role FROM users WHERE id = $1',
      [userId]
    );

    const { team_id, team_role } = userResult.rows[0];
    const role = team_role || 'owner'; // Solo users are owners

    // Get permissions
    const permissionsResult = await client.query(`
      SELECT * FROM get_role_permissions($1, $2)
    `, [role, team_id || null]);

    // Group permissions by category
    const permissions = {};
    for (const row of permissionsResult.rows) {
      if (!permissions[row.category]) {
        permissions[row.category] = {};
      }
      permissions[row.category][row.action] = row.is_allowed;
    }

    res.json({
      role,
      permissions
    });

  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  } finally {
    client.release();
  }
});

export default router;
