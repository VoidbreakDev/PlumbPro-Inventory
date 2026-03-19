import cron from 'node-cron';
import { checkLowStockAlerts, checkJobReminders, sendDailySummary } from './services/notificationService.js';
import { processEmailQueue } from './services/emailService.js';
import { runScheduledTasks, runDailyMaintenance } from './services/scheduledTaskRunner.js';

export function startScheduler({
  pool,
  enabled = process.env.ENABLE_NOTIFICATIONS !== 'false',
  isDevelopment = process.env.NODE_ENV === 'development'
} = {}) {
  if (!enabled) {
    return [];
  }

  const scheduledJobs = [];

  scheduledJobs.push(cron.schedule('0 * * * *', () => {
    if (isDevelopment) console.log('⏰ Running low stock check...');
    checkLowStockAlerts();
  }));

  scheduledJobs.push(cron.schedule('0 8 * * *', () => {
    if (isDevelopment) console.log('⏰ Running job reminders check...');
    checkJobReminders();
  }));

  scheduledJobs.push(cron.schedule('0 18 * * *', () => {
    if (isDevelopment) console.log('⏰ Sending daily summaries...');
    sendDailySummary();
  }));

  scheduledJobs.push(cron.schedule('*/5 * * * *', async () => {
    try {
      await processEmailQueue(pool);
    } catch (err) {
      console.error('[Scheduled] Email queue processing error:', err.message);
    }
  }));

  scheduledJobs.push(cron.schedule('*/5 * * * *', () => {
    if (isDevelopment) console.log('⏰ Running scheduled workflows...');
    runScheduledTasks();
  }));

  scheduledJobs.push(cron.schedule('0 2 * * *', () => {
    if (isDevelopment) console.log('⏰ Running daily maintenance...');
    runDailyMaintenance();
  }));

  console.log('📅 Scheduled tasks initialized');
  console.log('🤖 Workflow automation enabled');

  return scheduledJobs;
}

export default startScheduler;
