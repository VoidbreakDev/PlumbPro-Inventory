import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import cron from 'node-cron';
import { checkLowStockAlerts, checkJobReminders, sendDailySummary } from './services/notificationService.js';
import { processEmailQueue } from './services/emailService.js';
import { runScheduledTasks, runDailyMaintenance } from './services/scheduledTaskRunner.js';
import pool from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Scheduled tasks (cron jobs)
if (process.env.ENABLE_NOTIFICATIONS !== 'false') {
  // Check low stock alerts every hour
  cron.schedule('0 * * * *', () => {
    console.log('⏰ Running low stock check...');
    checkLowStockAlerts();
  });

  // Check job reminders every day at 8 AM
  cron.schedule('0 8 * * *', () => {
    console.log('⏰ Running job reminders check...');
    checkJobReminders();
  });

  // Send daily summary every day at 6 PM
  cron.schedule('0 18 * * *', () => {
    console.log('⏰ Sending daily summaries...');
    sendDailySummary();
  });

  // Process email queue every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processEmailQueue(pool);
  });

  // Run workflow scheduled tasks every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    console.log('⏰ Running scheduled workflows...');
    runScheduledTasks();
  });

  // Run daily maintenance at 2 AM
  cron.schedule('0 2 * * *', () => {
    console.log('⏰ Running daily maintenance...');
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
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🔔 Notifications: ${process.env.ENABLE_NOTIFICATIONS !== 'false' ? 'Enabled' : 'Disabled'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

export default app;
