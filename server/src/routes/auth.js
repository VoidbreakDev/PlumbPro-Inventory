import express from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { addToDenylist } from '../services/tokenDenylist.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Password strength regex: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Common breached passwords — rejected at registration regardless of complexity score.
// All entries stored lowercase; comparison uses password.toLowerCase().
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1!',
  'admin', 'admin123', 'admin123!', 'administrator',
  'letmein', 'letmein1', 'welcome', 'welcome1!',
  'plumbing1', 'plumbing1!', 'plumber1', 'qwerty',
  'qwerty1!', '12345678', '123456789', '1234567890',
  'iloveyou', 'sunshine', 'monkey', 'dragon',
  'master', 'access', 'login', 'pass',
]);

// Register new user with strong password validation
router.post('/register',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(PASSWORD_REGEX)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
    body('fullName')
      .notEmpty()
      .trim()
      .escape()
      .isLength({ min: 2, max: 255 })
      .withMessage('Full name must be between 2 and 255 characters'),
    body('companyName')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 255 })
      .withMessage('Company name must not exceed 255 characters'),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { email, password, fullName, companyName, inviteToken } = req.body;

      // Reject commonly breached passwords
      if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Password is too common. Please choose a more unique password.',
          code: 'WEAK_PASSWORD',
        });
      }

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
      }

      let invitation = null;
      if (inviteToken) {
        const invitationResult = await client.query(`
          SELECT i.*, t.name AS team_name
          FROM team_invitations i
          JOIN teams t ON t.id = i.team_id
          WHERE i.token = $1
            AND i.status = 'pending'
            AND i.expires_at > NOW()
        `, [inviteToken]);

        if (invitationResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invitation is invalid or has expired', code: 'INVALID_INVITE' });
        }

        invitation = invitationResult.rows[0];

        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Registration email must match the invited email address', code: 'EMAIL_MISMATCH' });
        }
      }

      // Hash password with cost factor 12
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const result = await client.query(`
        INSERT INTO users (
          email, password_hash, full_name, company_name, role,
          team_id, team_role, invited_by, invited_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, full_name, company_name, role, created_at
      `, [
        email,
        passwordHash,
        fullName,
        companyName || null,
        'user',
        invitation?.team_id || null,
        invitation?.role || 'member',
        invitation?.invited_by || null,
        invitation ? new Date().toISOString() : null
      ]);

      const user = result.rows[0];

      if (invitation) {
        await client.query(`
          UPDATE team_invitations
          SET status = 'accepted', accepted_at = NOW()
          WHERE id = $1
        `, [invitation.id]);
      }

      await client.query('COMMIT');
      const token = generateToken(user);

      res.status(201).json({
        message: invitation
          ? 'Account created and team invitation accepted successfully'
          : 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          companyName: user.company_name,
          role: user.role
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Registration error', { error: error.message });
      res.status(500).json({ error: 'Registration failed', code: 'INTERNAL_ERROR' });
    } finally {
      client.release();
    }
  }
);

// Login — brute-force protection delegated to express-rate-limit authLimiter in app.js
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { email, password } = req.body;

      // Find user
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        // Constant-time response to prevent user enumeration
        await bcrypt.compare(password, '$2a$12$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuu');
        return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      }

      const user = result.rows[0];

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      }

      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          companyName: user.company_name,
          role: user.role
        }
      });

    } catch (error) {
      logger.error('Login error', { error: error.message });
      res.status(500).json({ error: 'Login failed', code: 'INTERNAL_ERROR' });
    } finally {
      client.release();
    }
  }
);

// Logout — revoke the current token by adding it to the denylist
router.post('/logout', authenticateToken, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    // req.user.exp is the JWT expiry claim (seconds since epoch)
    const expMs = (req.user.exp ?? 0) * 1000;
    addToDenylist(token, expMs);
  }
  res.json({ message: 'Logged out successfully' });
});

// Get current user (requires authentication)
router.get('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, email, full_name, company_name, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      companyName: user.company_name,
      role: user.role,
      createdAt: user.created_at
    });

  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user', code: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
});

export default router;
