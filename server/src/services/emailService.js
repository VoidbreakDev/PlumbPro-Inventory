import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create email transporter
const createTransporter = () => {
  // For development, use ethereal email (fake SMTP)
  // For production, use real SMTP service (Gmail, SendGrid, AWS SES, etc.)

  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  } else {
    // Development mode - log to console
    console.log('📧 Email service in development mode (emails logged to console)');
    return null;
  }
};

const transporter = createTransporter();

// Email templates
const emailTemplates = {
  lowStock: (item) => ({
    subject: `⚠️ Low Stock Alert: ${item.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Low Stock Alert</h2>
        <p>The following item is running low:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${item.name}</h3>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${item.category}</p>
          <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${item.quantity}</p>
          <p style="margin: 5px 0;"><strong>Reorder Level:</strong> ${item.reorderLevel}</p>
          <p style="margin: 5px 0;"><strong>Supplier:</strong> ${item.supplier || 'N/A'}</p>
        </div>
        <p>Please reorder this item soon to avoid stockouts.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated notification from PlumbPro Inventory
        </p>
      </div>
    `
  }),

  stockOut: (item) => ({
    subject: `🚨 Out of Stock: ${item.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Out of Stock Alert</h2>
        <p>The following item is out of stock:</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${item.name}</h3>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${item.category}</p>
          <p style="margin: 5px 0;"><strong>Stock:</strong> 0</p>
          <p style="margin: 5px 0;"><strong>Supplier:</strong> ${item.supplier || 'N/A'}</p>
        </div>
        <p><strong>Action Required:</strong> Place an order immediately to restore stock.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated notification from PlumbPro Inventory
        </p>
      </div>
    `
  }),

  jobReminder: (job, daysUntil) => ({
    subject: `📅 Job Reminder: ${job.title} in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Upcoming Job Reminder</h2>
        <p>You have a job scheduled in ${daysUntil} day${daysUntil > 1 ? 's' : ''}:</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${job.title}</h3>
          <p style="margin: 5px 0;"><strong>Job Type:</strong> ${job.jobType}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(job.date).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Builder:</strong> ${job.builder || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${job.status}</p>
        </div>
        ${!job.isPicked ? '<p><strong>⚠️ Note:</strong> Materials have not been picked yet.</p>' : ''}
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated notification from PlumbPro Inventory
        </p>
      </div>
    `
  }),

  jobAssigned: (job, workerName) => ({
    subject: `👷 New Job Assigned: ${job.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Job Assignment</h2>
        <p>Hello ${workerName},</p>
        <p>You have been assigned to a new job:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${job.title}</h3>
          <p style="margin: 5px 0;"><strong>Job Type:</strong> ${job.jobType}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(job.date).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Builder:</strong> ${job.builder || 'N/A'}</p>
        </div>
        <p>Please review the job details and materials list in the system.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated notification from PlumbPro Inventory
        </p>
      </div>
    `
  }),

  dailySummary: (summary) => ({
    subject: `📊 Daily Summary - ${new Date().toLocaleDateString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Daily Summary</h2>
        <p>Here's your daily inventory summary for ${new Date().toLocaleDateString()}:</p>

        <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0;">📦 Inventory</h3>
          <p style="margin: 5px 0;">Total Value: £${summary.totalValue?.toFixed(2) || 0}</p>
          <p style="margin: 5px 0;">Low Stock Items: ${summary.lowStockCount || 0}</p>
          <p style="margin: 5px 0;">Out of Stock: ${summary.outOfStockCount || 0}</p>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0;">📅 Jobs</h3>
          <p style="margin: 5px 0;">Scheduled Today: ${summary.todayJobs || 0}</p>
          <p style="margin: 5px 0;">In Progress: ${summary.inProgressJobs || 0}</p>
          <p style="margin: 5px 0;">Upcoming (7 days): ${summary.upcomingJobs || 0}</p>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0;">📊 Activity</h3>
          <p style="margin: 5px 0;">Stock Movements: ${summary.stockMovements || 0}</p>
          <p style="margin: 5px 0;">Jobs Completed: ${summary.completedJobs || 0}</p>
        </div>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated daily summary from PlumbPro Inventory
        </p>
      </div>
    `
  })
};

// Send email function
export const sendEmail = async (to, template, data) => {
  try {
    const emailContent = emailTemplates[template](data);

    if (!emailContent) {
      throw new Error(`Unknown email template: ${template}`);
    }

    if (transporter) {
      // Send via real SMTP
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"PlumbPro Inventory" <noreply@plumbpro.com>',
        to,
        subject: emailContent.subject,
        html: emailContent.html
      });

      console.log(`📧 Email sent to ${to}: ${emailContent.subject}`);
      return { success: true, messageId: info.messageId };
    } else {
      // Development mode - log to console
      console.log('\n📧 ============ EMAIL (DEV MODE) ============');
      console.log(`To: ${to}`);
      console.log(`Subject: ${emailContent.subject}`);
      console.log(`Body: ${emailContent.html.substring(0, 200)}...`);
      console.log('📧 =========================================\n');
      return { success: true, dev: true };
    }
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Queue email for async sending
export const queueEmail = async (pool, userId, toEmail, template, data, notificationId = null) => {
  try {
    const emailContent = emailTemplates[template](data);

    await pool.query(`
      INSERT INTO email_queue (user_id, to_email, subject, body, notification_id, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [userId, toEmail, emailContent.subject, emailContent.html, notificationId]);

    console.log(`📬 Email queued for ${toEmail}: ${emailContent.subject}`);
  } catch (error) {
    console.error('Email queue error:', error);
    throw error;
  }
};

// Process email queue (call this periodically)
export const processEmailQueue = async (pool) => {
  try {
    const result = await pool.query(`
      SELECT * FROM email_queue
      WHERE status = 'pending' AND attempts < 3
      ORDER BY created_at ASC
      LIMIT 10
    `);

    for (const email of result.rows) {
      try {
        if (transporter) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"PlumbPro Inventory" <noreply@plumbpro.com>',
            to: email.to_email,
            subject: email.subject,
            html: email.body
          });
        }

        await pool.query(`
          UPDATE email_queue
          SET status = 'sent', sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [email.id]);

        if (email.notification_id) {
          await pool.query(`
            UPDATE notifications
            SET is_sent_email = true
            WHERE id = $1
          `, [email.notification_id]);
        }

        console.log(`✅ Email sent from queue: ${email.subject}`);
      } catch (error) {
        await pool.query(`
          UPDATE email_queue
          SET attempts = attempts + 1, error_message = $1
          WHERE id = $2
        `, [error.message, email.id]);

        if (email.attempts >= 2) {
          await pool.query(`
            UPDATE email_queue SET status = 'failed' WHERE id = $1
          `, [email.id]);
        }

        console.error(`❌ Email failed: ${email.subject}`, error.message);
      }
    }
  } catch (error) {
    console.error('Process email queue error:', error);
  }
};

export default {
  sendEmail,
  queueEmail,
  processEmailQueue
};
