import cron from 'node-cron';
import pool from '../config/database.js';

function addInterval(dateStr, frequency) {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'daily':       d.setDate(d.getDate() + 1);      break;
    case 'weekly':      d.setDate(d.getDate() + 7);      break;
    case 'fortnightly': d.setDate(d.getDate() + 14);     break;
    case 'monthly':     d.setMonth(d.getMonth() + 1);    break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3);    break;
  }
  return d.toISOString().slice(0, 10); // yyyy-MM-dd
}

async function generateDueRecurringJobs() {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);

    const due = await client.query(`
      SELECT r.*, j.title, j.job_type, j.user_id, j.job_address
      FROM job_recurring r
      JOIN jobs j ON r.job_id = j.id
      WHERE r.is_active = TRUE AND r.next_due <= $1
    `, [today]);

    for (const rule of due.rows) {
      const txClient = await pool.connect();
      try {
        await txClient.query('BEGIN');
        const newJob = await txClient.query(`
          INSERT INTO jobs (user_id, title, job_type, status, date)
          VALUES ($1, $2, $3, 'Unscheduled', $4)
          RETURNING id
        `, [rule.user_id, rule.title, rule.job_type, rule.next_due]);

        const nextDue = addInterval(rule.next_due, rule.frequency);

        await txClient.query(`
          UPDATE job_recurring
          SET next_due = $1, last_generated = $2
          WHERE id = $3
        `, [nextDue, today, rule.id]);

        await txClient.query('COMMIT');
        console.log(`[recurringJobs] Generated job ${newJob.rows[0].id} from rule ${rule.id}`);
      } catch (err) {
        await txClient.query('ROLLBACK');
        console.error(`[recurringJobs] Failed to generate from rule ${rule.id}:`, err.message);
      } finally {
        txClient.release();
      }
    }
  } catch (error) {
    console.error('[recurringJobs] Error checking due rules:', error.message);
  } finally {
    client.release();
  }
}

export function startRecurringJobsCron() {
  // Run at 6am every day
  cron.schedule('0 6 * * *', async () => {
    try {
      await generateDueRecurringJobs();
    } catch (err) {
      console.error('[recurringJobs] Unhandled cron error:', err.message);
    }
  });
  console.log('[recurringJobs] Cron scheduled (daily at 6am)');
}
