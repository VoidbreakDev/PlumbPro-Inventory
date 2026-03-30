import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import contactsRoutes from './routes/contacts.js';
import developmentProjectsRoutes from './routes/developmentProjects.js';
import jobsRoutes from './routes/jobs.js';
import templatesRoutes from './routes/templates.js';
import movementsRoutes from './routes/movements.js';
import smartOrderingRoutes from './routes/smartOrdering.js';
import analyticsRoutes from './routes/analytics.js';
import notificationsRoutes from './routes/notifications.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import mobileRoutes from './routes/mobile.js';
import workflowRoutes from './routes/workflow.js';
import approvalsRoutes from './routes/approvals.js';
import purchaseOrdersRoutes from './routes/purchaseOrders.js';
import stockReturnsRoutes from './routes/stockReturns.js';
import locationsRoutes from './routes/locations.js';
import stockTransfersRoutes from './routes/stockTransfers.js';
import itemSuppliersRoutes from './routes/itemSuppliers.js';
import supplierRatingsRoutes from './routes/supplierRatings.js';
import priceAlertsRoutes from './routes/priceAlerts.js';
import supplierAnalyticsRoutes from './routes/supplierAnalytics.js';
import quotesRoutes from './routes/quotes.js';
import invoicesRoutes from './routes/invoices.js';
import teamRoutes from './routes/team.js';
import xeroRoutes from './routes/xero.js';
import advancedAnalyticsRoutes from './routes/advancedAnalytics.js';
import permissionsRoutes from './routes/permissions.js';
import apiAccessRoutes from './routes/apiAccess.js';
import vanStockRoutes from './routes/vanStock.js';
import franchiseRoutes from './routes/franchise.js';
import whiteLabelRoutes from './routes/whiteLabel.js';
import portalRoutes from './routes/portal.js';
import assetsRoutes from './routes/assets.js';
import subcontractorsRoutes from './routes/subcontractors.js';
import leadsRoutes from './routes/leads.js';
import kitsRoutes from './routes/kits.js';
import voiceNotesRoutes from './routes/voiceNotes.js';
import importRoutes from './routes/import.js';
import purchaseAnalyticsRoutes from './routes/purchaseAnalytics.js';

const DEFAULT_ALLOWED_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5001'
];

export function createApp({
  pool,
  nodeEnv = process.env.NODE_ENV || 'development',
  corsOrigin = process.env.CORS_ORIGIN,
  allowMissingOrigin = process.env.ALLOW_ORIGINLESS_REQUESTS === 'true',
  uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
} = {}) {
  if (!pool) {
    throw new Error('createApp requires a database pool');
  }

  const app = express();
  const isDevelopment = nodeEnv === 'development';
  const corsOrigins = corsOrigin
    ? corsOrigin.split(',').map((origin) => origin.trim())
    : isDevelopment
      ? DEFAULT_ALLOWED_DEV_ORIGINS
      : [];

  app.use(cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (e.g. server-to-server, curl, integration tests)
      // are allowed outside of production. The embedded Electron desktop app also
      // talks to the local API without an Origin header, so it opts in via
      // ALLOW_ORIGINLESS_REQUESTS=true.
      if (!origin || origin === 'null') {
        if (nodeEnv !== 'production' || allowMissingOrigin) return callback(null, true);
        return callback(new Error('CORS: missing origin header'));
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
      error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => nodeEnv === 'test'
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/uploads', express.static(uploadsDir));

  if (isDevelopment) {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  app.get('/health', async (req, res) => {
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: nodeEnv,
      version: process.env.npm_package_version || '1.0.5',
      checks: {}
    };

    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      healthCheck.checks.database = {
        status: 'ok',
        responseTime: `${Date.now() - dbStart}ms`
      };
    } catch (error) {
      healthCheck.checks.database = {
        status: 'error',
        message: error.message
      };
      healthCheck.status = 'degraded';
    }

    const memUsage = process.memoryUsage();
    healthCheck.checks.memory = {
      status: 'ok',
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    };

    const hasErrors = Object.values(healthCheck.checks).some(
      (check) => check.status === 'error'
    );

    if (hasErrors) {
      healthCheck.status = 'error';
      return res.status(503).json(healthCheck);
    }

    res.json(healthCheck);
  });

  app.get('/health/detailed', authenticateToken, async (req, res) => {
    const detailed = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: nodeEnv,
      version: process.env.npm_package_version || '1.0.5',
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      checks: {},
      stats: {}
    };

    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      detailed.checks.database = {
        status: 'ok',
        responseTime: `${Date.now() - dbStart}ms`
      };

      const tableStats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM inventory_items) as inventory_count,
          (SELECT COUNT(*) FROM contacts) as contacts_count,
          (SELECT COUNT(*) FROM jobs) as jobs_count,
          (SELECT COUNT(*) FROM users) as users_count
      `);

      detailed.stats.database = {
        inventory_items: parseInt(tableStats.rows[0].inventory_count),
        contacts: parseInt(tableStats.rows[0].contacts_count),
        jobs: parseInt(tableStats.rows[0].jobs_count),
        users: parseInt(tableStats.rows[0].users_count)
      };

      const activity = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM stock_movements WHERE created_at > NOW() - INTERVAL '24 hours') as movements_24h,
          (SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_24h
      `);

      detailed.stats.activity = {
        movements_24h: parseInt(activity.rows[0].movements_24h),
        jobs_24h: parseInt(activity.rows[0].jobs_24h)
      };
    } catch (error) {
      detailed.checks.database = {
        status: 'error',
        message: error.message
      };
      detailed.status = 'degraded';
    }

    res.json(detailed);
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/development-projects', developmentProjectsRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/templates', templatesRoutes);
  app.use('/api/movements', movementsRoutes);
  app.use('/api/smart-ordering', smartOrderingRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/mobile', mobileRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/approvals', approvalsRoutes);
  app.use('/api/purchase-orders', purchaseOrdersRoutes);
  app.use('/api/stock-returns', stockReturnsRoutes);
  app.use('/api/locations', locationsRoutes);
  app.use('/api/stock-transfers', stockTransfersRoutes);
  app.use('/api/item-suppliers', itemSuppliersRoutes);
  app.use('/api/suppliers', supplierRatingsRoutes);
  app.use('/api/price-alerts', priceAlertsRoutes);
  app.use('/api/supplier-analytics', supplierAnalyticsRoutes);
  app.use('/api/quotes', quotesRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/xero', xeroRoutes);
  app.use('/api/advanced-analytics', advancedAnalyticsRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/developer', apiAccessRoutes);
  app.use('/api/van-stock', vanStockRoutes);
  app.use('/api/franchise', franchiseRoutes);
  app.use('/api/white-label', whiteLabelRoutes);
  app.use('/api/portal', portalRoutes);
  app.use('/api/assets', assetsRoutes);
  app.use('/api/subcontractors', subcontractorsRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/kits', kitsRoutes);
  app.use('/api/voice-notes', voiceNotesRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/purchase-analytics', purchaseAnalyticsRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
  });

  app.use(errorHandler);

  return app;
}

export default createApp;
