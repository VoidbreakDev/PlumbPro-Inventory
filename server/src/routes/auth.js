import express from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Password strength regex: at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// In-memory store for failed login attempts (use Redis in production)
const failedLoginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Helper function to check if account is locked
const isAccountLocked = (email) => {
  const attempts = failedLoginAttempts.get(email);
  if (!attempts) return false;
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_DURATION_MS) {
      return true;
    }
    // Reset after lockout duration
    failedLoginAttempts.delete(email);
  }
  return false;
};

// Helper function to record failed login attempt
const recordFailedLogin = (email) => {
  const existing = failedLoginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  failedLoginAttempts.set(email, {
    count: existing.count + 1,
    lastAttempt: Date.now()
  });
};

// Helper function to clear failed login attempts
const clearFailedLogins = (email) => {
  failedLoginAttempts.delete(email);
};

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
      const { email, password, fullName, companyName } = req.body;

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password with higher cost factor
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const result = await client.query(`
        INSERT INTO users (email, password_hash, full_name, company_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, company_name, role, created_at
      `, [email, passwordHash, fullName, companyName || null, 'user']);

      const user = result.rows[0];
      const token = generateToken(user);

      res.status(201).json({
        message: 'User registered successfully',
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
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    } finally {
      client.release();
    }
  }
);

// Login with account lockout protection
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

      // Check if account is locked
      if (isAccountLocked(email)) {
        const attempts = failedLoginAttempts.get(email);
        const remainingTime = Math.ceil((LOCKOUT_DURATION_MS - (Date.now() - attempts.lastAttempt)) / 60000);
        return res.status(423).json({ 
          error: 'Account temporarily locked due to too many failed login attempts',
          retryAfterMinutes: remainingTime
        });
      }

      // Find user
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        // Use consistent timing to prevent user enumeration
        await bcrypt.compare(password, '$2a$12$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuu'); // dummy hash
        recordFailedLogin(email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        recordFailedLogin(email);
        const attempts = failedLoginAttempts.get(email);
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts.count;
        
        return res.status(401).json({ 
          error: 'Invalid credentials',
          remainingAttempts: Math.max(0, remainingAttempts)
        });
      }

      // Clear failed login attempts on successful login
      clearFailedLogins(email);

      // Generate token
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
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    } finally {
      client.release();
    }
  }
);

// Get current user (requires authentication)
router.get('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, email, full_name, company_name, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  } finally {
    client.release();
  }
});

export default router;
