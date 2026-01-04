import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();
router.use(authenticateToken);

// Get all notifications for user
router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { unreadOnly, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    if (unreadOnly === 'true') {
      query += ' AND is_read = false';
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

    const result = await client.query(query, [req.user.userId, limit, offset]);

    // Get unread count
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(countResult.rows[0].count),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  } finally {
    client.release();
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  } finally {
    client.release();
  }
});

// Mark all notifications as read
router.post('/read-all', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query(`
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `, [req.user.userId]);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  } finally {
    client.release();
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  } finally {
    client.release();
  }
});

// Delete all read notifications
router.delete('/read/all', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [req.user.userId]
    );

    res.json({ message: 'All read notifications deleted' });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  } finally {
    client.release();
  }
});

// Get notification preferences
router.get('/preferences', async (req, res) => {
  const client = await pool.connect();

  try {
    let result = await client.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.userId]
    );

    // If no preferences exist, create default ones
    if (result.rows.length === 0) {
      result = await client.query(`
        INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `, [req.user.userId]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  } finally {
    client.release();
  }
});

// Update notification preferences
router.put('/preferences', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      emailEnabled,
      browserEnabled,
      lowStockAlerts,
      jobReminders,
      jobAssignments,
      stockOutAlerts,
      systemNotifications,
      reminderDaysBefore,
      dailySummary
    } = req.body;

    // First, ensure preferences exist
    await client.query(`
      INSERT INTO notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.user.userId]);

    // Update preferences
    const result = await client.query(`
      UPDATE notification_preferences
      SET
        email_enabled = COALESCE($1, email_enabled),
        browser_enabled = COALESCE($2, browser_enabled),
        low_stock_alerts = COALESCE($3, low_stock_alerts),
        job_reminders = COALESCE($4, job_reminders),
        job_assignments = COALESCE($5, job_assignments),
        stock_out_alerts = COALESCE($6, stock_out_alerts),
        system_notifications = COALESCE($7, system_notifications),
        reminder_days_before = COALESCE($8, reminder_days_before),
        daily_summary = COALESCE($9, daily_summary),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $10
      RETURNING *
    `, [
      emailEnabled,
      browserEnabled,
      lowStockAlerts,
      jobReminders,
      jobAssignments,
      stockOutAlerts,
      systemNotifications,
      reminderDaysBefore,
      dailySummary,
      req.user.userId
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  } finally {
    client.release();
  }
});

// Create a test notification (for testing purposes)
router.post('/test', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const notification = await createNotification(
      client,
      req.user.userId,
      'system',
      'Test Notification',
      'This is a test notification to verify the system is working correctly.',
      {
        priority: 'normal',
        link: '/dashboard'
      }
    );

    await client.query('COMMIT');

    res.status(201).json(notification);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create test notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  } finally {
    client.release();
  }
});

export default router;
