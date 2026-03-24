import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { isDenylisted } from '../services/tokenDenylist.js';

dotenv.config();

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required', code: 'TOKEN_REQUIRED' });
  }

  // Reject tokens that have been explicitly revoked via logout
  if (isDenylisted(token)) {
    return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, role, exp }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
};

// Middleware to check user roles
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};
