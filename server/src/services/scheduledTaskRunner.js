/**
 * Scheduled Task Runner
 * Executes time-based workflows and scheduled tasks
 */

import db from '../config/database.js';
import { executeWorkflow } from './workflowEngine.js';
import { checkOverdueJobs } from './automationIntegration.js';

/**
 * Run scheduled tasks
 */
export const runScheduledTasks = async () => {
  try {
    console.log('[Scheduler] Checking scheduled tasks...');

    // Get all active scheduled tasks that are due
    const result = await db.query(
      `SELECT * FROM scheduled_tasks
       WHERE is_active = TRUE
         AND next_run_at IS NOT NULL
         AND next_run_at <= CURRENT_TIMESTAMP
       ORDER BY next_run_at ASC`
    );

    const tasks = result.rows;

    console.log(`[Scheduler] Found ${tasks.length} tasks to execute`);

    for (const task of tasks) {
      try {
        await executeScheduledTask(task);
      } catch (error) {
        console.error(`[Scheduler] Failed to execute task ${task.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Failed to run scheduled tasks:', error);
  }
};

/**
 * Execute a single scheduled task
 */
async function executeScheduledTask(task) {
  console.log(`[Scheduler] Executing task: ${task.name}`);

  try {
    // If task has associated workflow, execute it
    if (task.workflow_id) {
      await executeWorkflow(task.workflow_id, {
        scheduledTaskId: task.id,
        scheduledTaskName: task.name,
        currentDate: new Date().toISOString()
      }, task.user_id);
    }

    // Update last run time and calculate next run time
    const nextRun = calculateNextRun(task.schedule_type, task.schedule_config, new Date());

    await db.query(
      `UPDATE scheduled_tasks
       SET last_run_at = CURRENT_TIMESTAMP,
           next_run_at = $1
       WHERE id = $2`,
      [nextRun, task.id]
    );

    console.log(`[Scheduler] Task ${task.name} executed successfully. Next run: ${nextRun}`);
  } catch (error) {
    console.error(`[Scheduler] Task ${task.name} execution failed:`, error);
    throw error;
  }
}

/**
 * Calculate next run time based on schedule
 */
function calculateNextRun(scheduleType, scheduleConfig, lastRun) {
  const config = typeof scheduleConfig === 'string' ? JSON.parse(scheduleConfig) : scheduleConfig;
  const now = new Date(lastRun);

  switch (scheduleType) {
    case 'once':
      // One-time task, no next run
      return null;

    case 'daily':
      // Run every day at specified time
      const dailyTime = config.time || '09:00';
      const [dailyHour, dailyMinute] = dailyTime.split(':').map(Number);
      const nextDaily = new Date(now);
      nextDaily.setDate(nextDaily.getDate() + 1);
      nextDaily.setHours(dailyHour, dailyMinute, 0, 0);
      return nextDaily;

    case 'weekly':
      // Run every week on specified day
      const weeklyDay = config.day || 'monday';
      const weeklyTime = config.time || '09:00';
      const [weeklyHour, weeklyMinute] = weeklyTime.split(':').map(Number);

      const daysOfWeek = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      };
      const targetDay = daysOfWeek[weeklyDay.toLowerCase()];
      const nextWeekly = new Date(now);
      const currentDay = nextWeekly.getDay();
      let daysToAdd = targetDay - currentDay;

      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }

      nextWeekly.setDate(nextWeekly.getDate() + daysToAdd);
      nextWeekly.setHours(weeklyHour, weeklyMinute, 0, 0);
      return nextWeekly;

    case 'monthly':
      // Run every month on specified date
      const monthlyDate = config.date || 1;
      const monthlyTime = config.time || '09:00';
      const [monthlyHour, monthlyMinute] = monthlyTime.split(':').map(Number);
      const nextMonthly = new Date(now);
      nextMonthly.setMonth(nextMonthly.getMonth() + 1);
      nextMonthly.setDate(monthlyDate);
      nextMonthly.setHours(monthlyHour, monthlyMinute, 0, 0);
      return nextMonthly;

    case 'hourly':
      // Run every hour
      const nextHourly = new Date(now);
      nextHourly.setHours(nextHourly.getHours() + 1, 0, 0, 0);
      return nextHourly;

    case 'cron':
      // For cron expressions, we'd need a cron parser library
      // For now, default to daily
      console.warn('[Scheduler] Cron schedules not yet implemented, defaulting to daily');
      const defaultNext = new Date(now);
      defaultNext.setDate(defaultNext.getDate() + 1);
      return defaultNext;

    default:
      console.error(`[Scheduler] Unknown schedule type: ${scheduleType}`);
      return null;
  }
}

/**
 * Run daily maintenance tasks
 */
export const runDailyMaintenance = async () => {
  console.log('[Scheduler] Running daily maintenance...');

  try {
    // Check for overdue jobs
    await checkOverdueJobs();

    // Clean up old execution logs (older than 90 days)
    await db.query(
      `DELETE FROM workflow_action_logs
       WHERE id IN (
         SELECT wal.id FROM workflow_action_logs wal
         JOIN workflow_executions we ON wal.execution_id = we.id
         WHERE we.started_at < NOW() - INTERVAL '90 days'
       )`
    );

    // Clean up old executions (older than 90 days)
    await db.query(
      `DELETE FROM workflow_executions
       WHERE started_at < NOW() - INTERVAL '90 days'`
    );

    console.log('[Scheduler] Daily maintenance completed');
  } catch (error) {
    console.error('[Scheduler] Daily maintenance failed:', error);
  }
};

/**
 * Create or update a scheduled task
 */
export const createScheduledTask = async (userId, workflowId, name, scheduleType, scheduleConfig) => {
  try {
    const nextRun = calculateNextRun(scheduleType, scheduleConfig, new Date());

    const result = await db.query(
      `INSERT INTO scheduled_tasks (user_id, workflow_id, name, schedule_type, schedule_config, next_run_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [userId, workflowId, name, scheduleType, JSON.stringify(scheduleConfig), nextRun]
    );

    console.log(`[Scheduler] Created scheduled task: ${name}, next run: ${nextRun}`);
    return result.rows[0];
  } catch (error) {
    console.error('[Scheduler] Failed to create scheduled task:', error);
    throw error;
  }
};

/**
 * Disable a scheduled task
 */
export const disableScheduledTask = async (taskId, userId) => {
  try {
    await db.query(
      `UPDATE scheduled_tasks
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    console.log(`[Scheduler] Disabled scheduled task: ${taskId}`);
  } catch (error) {
    console.error('[Scheduler] Failed to disable scheduled task:', error);
    throw error;
  }
};

/**
 * Get scheduled tasks for a user
 */
export const getScheduledTasks = async (userId) => {
  try {
    const result = await db.query(
      `SELECT st.*, w.name as workflow_name
       FROM scheduled_tasks st
       LEFT JOIN workflows w ON st.workflow_id = w.id
       WHERE st.user_id = $1
       ORDER BY st.next_run_at ASC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('[Scheduler] Failed to get scheduled tasks:', error);
    throw error;
  }
};

export default {
  runScheduledTasks,
  runDailyMaintenance,
  createScheduledTask,
  disableScheduledTask,
  getScheduledTasks
};
