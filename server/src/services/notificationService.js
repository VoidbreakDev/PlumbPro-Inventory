import pool from '../config/database.js';
import { queueEmail } from './emailService.js';

// Create a notification
export const createNotification = async (client, userId, type, title, message, options = {}) => {
  try {
    const {
      priority = 'normal',
      link = null,
      referenceId = null,
      referenceType = null
    } = options;

    const result = await client.query(`
      INSERT INTO notifications (user_id, type, priority, title, message, link, reference_id, reference_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, type, priority, title, message, link, referenceId, referenceType]);

    const notification = result.rows[0];
    console.log(`🔔 Notification created: ${type} for user ${userId}`);

    // Check if email notification should be sent
    await checkAndSendEmail(client, userId, type, notification);

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Check user preferences and send email if enabled
const checkAndSendEmail = async (client, userId, type, notification) => {
  try {
    // Get user and preferences
    const userResult = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    const prefsResult = await client.query('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const prefs = prefsResult.rows[0];

    // Check if email is enabled and type is allowed
    if (!prefs || !prefs.email_enabled) return;

    const typeMap = {
      low_stock: 'low_stock_alerts',
      stock_out: 'stock_out_alerts',
      job_reminder: 'job_reminders',
      job_assigned: 'job_assignments',
      system: 'system_notifications'
    };

    const prefKey = typeMap[type];
    if (prefKey && !prefs[prefKey]) return;

    // Queue email based on notification type
    let emailTemplate = null;
    let emailData = null;

    if (type === 'low_stock' && notification.reference_id) {
      const item = await client.query('SELECT * FROM inventory_items WHERE id = $1', [notification.reference_id]);
      if (item.rows.length > 0) {
        emailTemplate = 'lowStock';
        emailData = {
          name: item.rows[0].name,
          category: item.rows[0].category,
          quantity: item.rows[0].quantity,
          reorderLevel: item.rows[0].reorder_level
        };
      }
    } else if (type === 'stock_out' && notification.reference_id) {
      const item = await client.query('SELECT * FROM inventory_items WHERE id = $1', [notification.reference_id]);
      if (item.rows.length > 0) {
        emailTemplate = 'stockOut';
        emailData = {
          name: item.rows[0].name,
          category: item.rows[0].category
        };
      }
    }

    if (emailTemplate && emailData) {
      await queueEmail(client, userId, user.email, emailTemplate, emailData, notification.id);
    }
  } catch (error) {
    console.error('Check and send email error:', error);
  }
};

// Check for low stock items and create notifications
export const checkLowStockAlerts = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find items at or below reorder level
    const lowStockItems = await client.query(`
      SELECT i.*, u.id as user_id, u.email
      FROM inventory_items i
      JOIN users u ON i.user_id = u.id
      WHERE i.quantity <= i.reorder_level AND i.quantity > 0
    `);

    for (const item of lowStockItems.rows) {
      // Check if notification already exists today
      const existing = await client.query(`
        SELECT id FROM notifications
        WHERE user_id = $1
          AND type = 'low_stock'
          AND reference_id = $2
          AND created_at > CURRENT_DATE
      `, [item.user_id, item.id]);

      if (existing.rows.length === 0) {
        await createNotification(
          client,
          item.user_id,
          'low_stock',
          `Low Stock: ${item.name}`,
          `${item.name} is running low (${item.quantity} remaining, reorder at ${item.reorder_level})`,
          {
            priority: 'high',
            link: `/inventory?item=${item.id}`,
            referenceId: item.id,
            referenceType: 'inventory_item'
          }
        );
      }
    }

    // Find out-of-stock items
    const outOfStockItems = await client.query(`
      SELECT i.*, u.id as user_id, u.email
      FROM inventory_items i
      JOIN users u ON i.user_id = u.id
      WHERE i.quantity = 0
    `);

    for (const item of outOfStockItems.rows) {
      const existing = await client.query(`
        SELECT id FROM notifications
        WHERE user_id = $1
          AND type = 'stock_out'
          AND reference_id = $2
          AND created_at > CURRENT_DATE
      `, [item.user_id, item.id]);

      if (existing.rows.length === 0) {
        await createNotification(
          client,
          item.user_id,
          'stock_out',
          `Out of Stock: ${item.name}`,
          `${item.name} is completely out of stock. Reorder immediately.`,
          {
            priority: 'urgent',
            link: `/inventory?item=${item.id}`,
            referenceId: item.id,
            referenceType: 'inventory_item'
          }
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Checked ${lowStockItems.rows.length} low stock items and ${outOfStockItems.rows.length} out of stock items`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Check low stock alerts error:', error);
  } finally {
    client.release();
  }
};

// Check for upcoming job reminders
export const checkJobReminders = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get users with their reminder preferences
    const users = await client.query(`
      SELECT u.id, u.email, np.reminder_days_before
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE np.job_reminders = true OR np.job_reminders IS NULL
    `);

    for (const user of users.rows) {
      const daysBefore = user.reminder_days_before || 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find jobs scheduled for target date
      const jobs = await client.query(`
        SELECT * FROM jobs
        WHERE user_id = $1
          AND date = $2
          AND status IN ('Scheduled', 'In Progress')
      `, [user.id, targetDateStr]);

      for (const job of jobs.rows) {
        // Check if reminder already sent
        const existing = await client.query(`
          SELECT id FROM notifications
          WHERE user_id = $1
            AND type = 'job_reminder'
            AND reference_id = $2
            AND created_at > CURRENT_DATE
        `, [user.id, job.id]);

        if (existing.rows.length === 0) {
          await createNotification(
            client,
            user.id,
            'job_reminder',
            `Upcoming Job: ${job.title}`,
            `Job "${job.title}" is scheduled in ${daysBefore} day${daysBefore > 1 ? 's' : ''} (${new Date(job.date).toLocaleDateString()})`,
            {
              priority: job.is_picked ? 'normal' : 'high',
              link: `/jobs?job=${job.id}`,
              referenceId: job.id,
              referenceType: 'job'
            }
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Checked job reminders for ${users.rows.length} users`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Check job reminders error:', error);
  } finally {
    client.release();
  }
};

// Send daily summary
export const sendDailySummary = async () => {
  const client = await pool.connect();

  try {
    // Get users who want daily summary
    const users = await client.query(`
      SELECT u.id, u.email
      FROM users u
      JOIN notification_preferences np ON u.id = np.user_id
      WHERE np.daily_summary = true
    `);

    for (const user of users.rows) {
      // Gather summary data
      const inventoryData = await client.query(`
        SELECT
          COALESCE(SUM(price * quantity), 0) as total_value,
          COUNT(CASE WHEN quantity <= reorder_level AND quantity > 0 THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count
        FROM inventory_items
        WHERE user_id = $1
      `, [user.id]);

      const jobData = await client.query(`
        SELECT
          COUNT(CASE WHEN date = CURRENT_DATE AND status IN ('Scheduled', 'In Progress') THEN 1 END) as today_jobs,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_jobs,
          COUNT(CASE WHEN date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status = 'Scheduled' THEN 1 END) as upcoming_jobs,
          COUNT(CASE WHEN date = CURRENT_DATE AND status = 'Completed' THEN 1 END) as completed_jobs
        FROM jobs
        WHERE user_id = $1
      `, [user.id]);

      const movementData = await client.query(`
        SELECT COUNT(*) as movement_count
        FROM stock_movements
        WHERE user_id = $1
          AND timestamp >= EXTRACT(EPOCH FROM CURRENT_DATE) * 1000
      `, [user.id]);

      const summary = {
        totalValue: parseFloat(inventoryData.rows[0].total_value),
        lowStockCount: parseInt(inventoryData.rows[0].low_stock_count),
        outOfStockCount: parseInt(inventoryData.rows[0].out_of_stock_count),
        todayJobs: parseInt(jobData.rows[0].today_jobs),
        inProgressJobs: parseInt(jobData.rows[0].in_progress_jobs),
        upcomingJobs: parseInt(jobData.rows[0].upcoming_jobs),
        completedJobs: parseInt(jobData.rows[0].completed_jobs),
        stockMovements: parseInt(movementData.rows[0].movement_count)
      };

      await queueEmail(client, user.id, user.email, 'dailySummary', summary);
    }

    console.log(`✅ Queued daily summaries for ${users.rows.length} users`);
  } catch (error) {
    console.error('Send daily summary error:', error);
  } finally {
    client.release();
  }
};

export default {
  createNotification,
  checkLowStockAlerts,
  checkJobReminders,
  sendDailySummary
};
