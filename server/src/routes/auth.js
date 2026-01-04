import express from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Register new user
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').notEmpty().trim(),
    body('companyName').optional().trim(),
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

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

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

// Login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
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
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

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
