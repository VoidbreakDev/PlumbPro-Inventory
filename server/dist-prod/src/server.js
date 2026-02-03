import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authenticateToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import contactsRoutes from './routes/contacts.js';
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
import cron from 'node-cron';
import { checkLowStockAlerts, checkJobReminders, sendDailySummary } from './services/notificationService.js';
import { processEmailQueue } from './services/emailService.js';
import { runScheduledTasks, runDailyMaintenance } from './services/scheduledTaskRunner.js';
import pool from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// Security: Configure CORS with strict origin checking
// SECURITY: Define explicit allowed origins - no wildcards
const ALLOWED_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5001'
];

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : isDevelopment
    ? ALLOWED_DEV_ORIGINS
    : [];

app.use(cors({
  origin: (origin, callback) => {
    // SECURITY: Only allow requests with no origin from server-side requests
    // Mobile apps should include proper origin headers
    if (!origin) {
      // In production, log and consider blocking
      if (!isDevelopment) {
        console.warn('[CORS] Request without origin header - allowing for backwards compatibility');
      }
      return callback(null, true);
    }

    // SECURITY: Check against explicit whitelist only - no pattern matching
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

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow images from different origins
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health'
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (only in development)
if (isDevelopment) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check (no authentication required)
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {}
  };

  // Database health check
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

  // Memory usage
  const memUsage = process.memoryUsage();
  healthCheck.checks.memory = {
    status: 'ok',
    used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
  };

  // Determine overall status
  const hasErrors = Object.values(healthCheck.checks).some(
    check => check.status === 'error'
  );
  
  if (hasErrors) {
    healthCheck.status = 'error';
    return res.status(503).json(healthCheck);
  }

  res.json(healthCheck);
});

// Detailed health check (authenticated)
app.get('/health/detailed', authenticateToken, async (req, res) => {
  const detailed = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    checks: {},
    stats: {}
  };

  try {
    // Database checks
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    detailed.checks.database = {
      status: 'ok',
      responseTime: `${Date.now() - dbStart}ms`
    };

    // Get table counts
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

    // Recent activity
    const activity = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM stock_movements WHERE created_at > NOW() - INTERVAL '24 hours') as movements_24h,
        (SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_24h
    `);
    
    detailed.stats.activity = {
      stock_movements_24h: parseInt(activity.rows[0].movements_24h),
      new_jobs_24h: parseInt(activity.rows[0].jobs_24h)
    };

  } catch (error) {
    detailed.checks.database = {
      status: 'error',
      message: error.message
    };
    detailed.status = 'error';
  }

  // Memory and CPU
  const memUsage = process.memoryUsage();
  detailed.stats.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  };

  res.json(detailed);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/contacts', contactsRoutes);
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Security: Error handler that doesn't leak sensitive information
app.use((err, req, res, next) => {
  // Log full error internally
  console.error('Error:', err);
  
  // Don't leak error details in production
  const statusCode = err.status || err.statusCode || 500;
  
  if (statusCode === 500 && !isDevelopment) {
    res.status(500).json({ 
      error: 'Internal server error',
      requestId: req.id // If you have request tracking
    });
  } else {
    res.status(statusCode).json({
      error: err.message || 'Internal server error',
      ...(isDevelopment && { stack: err.stack })
    });
  }
});

// Scheduled tasks (cron jobs)
if (process.env.ENABLE_NOTIFICATIONS !== 'false') {
  // Check low stock alerts every hour
  cron.schedule('0 * * * *', () => {
    if (isDevelopment) console.log('⏰ Running low stock check...');
    checkLowStockAlerts();
  });

  // Check job reminders every day at 8 AM
  cron.schedule('0 8 * * *', () => {
    if (isDevelopment) console.log('⏰ Running job reminders check...');
    checkJobReminders();
  });

  // Send daily summary every day at 6 PM
  cron.schedule('0 18 * * *', () => {
    if (isDevelopment) console.log('⏰ Sending daily summaries...');
    sendDailySummary();
  });

  // Process email queue every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processEmailQueue(pool);
    } catch (err) {
      console.error('[Scheduled] Email queue processing error:', err.message);
    }
  });

  // Run workflow scheduled tasks every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    if (isDevelopment) console.log('⏰ Running scheduled workflows...');
    runScheduledTasks();
  });

  // Run daily maintenance at 2 AM
  cron.schedule('0 2 * * *', () => {
    if (isDevelopment) console.log('⏰ Running daily maintenance...');
    runDailyMaintenance();
  });

  console.log('📅 Scheduled tasks initialized');
  console.log('🤖 Workflow automation enabled');
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 PlumbPro Inventory Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🔔 Notifications: ${process.env.ENABLE_NOTIFICATIONS !== 'false' ? 'Enabled' : 'Disabled'}`);
  console.log(`🛡️  Security Headers: Enabled`);
  console.log(`⏱️  Rate Limiting: Enabled`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

export default app;
