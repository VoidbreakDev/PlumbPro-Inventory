/**
 * Email Service
 * Handles sending transactional emails via SendGrid, AWS SES, or SMTP
 */

import nodemailer from 'nodemailer';
import pool from '../config/database.js';

// Email provider configuration
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'smtp'; // 'sendgrid', 'ses', 'smtp'
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@plumbpro.com';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'PlumbPro Inventory';

// Initialize transporter
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  
  switch (EMAIL_PROVIDER) {
    case 'sendgrid':
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SendGrid API key not configured');
      }
      // Using nodemailer-sendgrid-transport or direct SendGrid SDK
      const sgTransport = await import('nodemailer-sendgrid-transport');
      transporter = nodemailer.createTransport(sgTransport.default({
        auth: { api_key: process.env.SENDGRID_API_KEY }
      }));
      break;
      
    case 'ses':
      if (!process.env.AWS_ACCESS_KEY_ID) {
        throw new Error('AWS credentials not configured');
      }
      const ses = await import('nodemailer-ses-transport');
      transporter = nodemailer.createTransport(ses.default({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      }));
      break;
      
    case 'smtp':
    default:
      if (!process.env.SMTP_HOST) {
        // Create ethereal test account for development
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        console.log('📧 Using Ethereal test email account:', testAccount.web);
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
      }
      break;
  }
  
  return transporter;
}

/**
 * Queue an email for sending
 */
export async function queueEmail({
  userId,
  templateId = null,
  to,
  toName = '',
  subject,
  bodyHtml = '',
  bodyText = '',
  variables = {}
}) {
  try {
    // Check if email_queue table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_queue'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.warn('[Email] Email queue table not found, email not queued');
      return null;
    }
    
    const result = await pool.query(
      `INSERT INTO email_queue (
        user_id, template_id, to_address, to_name,
        subject, body_html, body_text, variables, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *`,
      [userId, templateId, to, toName, subject, bodyHtml, bodyText, JSON.stringify(variables)]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Queue email error:', error);
    throw error;
  }
}

/**
 * Send a single email immediately
 */
export async function sendEmail({
  to,
  toName = '',
  subject,
  bodyHtml,
  bodyText,
  from = FROM_EMAIL,
  fromName = FROM_NAME,
  attachments = []
}) {
  try {
    const transport = await getTransporter();
    
    const info = await transport.sendMail({
      from: `"${fromName}" <${from}>`,
      to: `"${toName}" <${to}>`,
      subject,
      text: bodyText,
      html: bodyHtml,
      attachments
    });
    
    console.log('📧 Email sent:', info.messageId);
    
    // If using Ethereal, log the preview URL
    if (info.ethereal) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: info.ethereal ? nodemailer.getTestMessageUrl(info) : null
    };
    
  } catch (error) {
    console.error('Send email error:', error);
    throw error;
  }
}

/**
 * Process the email queue
 * Called by scheduled task runner
 */
export async function processEmailQueue() {
  try {
    // Check if email_queue table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_queue'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('[Email] Email queue table not found, skipping queue processing');
      return;
    }
    
    // Get pending emails
    const pendingEmails = await pool.query(
      `SELECT * FROM email_queue 
       WHERE status = 'pending' 
       AND retry_count < max_retries
       ORDER BY created_at ASC
       LIMIT 10`
    );
    
    for (const email of pendingEmails.rows) {
      try {
        // Mark as sending
        await pool.query(
          `UPDATE email_queue SET status = 'sending', updated_at = NOW() WHERE id = $1`,
          [email.id]
        );
        
        // Prepare email content
        let bodyHtml = email.body_html;
        let bodyText = email.body_text;
        let subject = email.subject;
        
        // Apply template variables
        if (email.variables) {
          const vars = typeof email.variables === 'string' 
            ? JSON.parse(email.variables) 
            : email.variables;
          
          Object.entries(vars).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            bodyHtml = bodyHtml?.replace(regex, value) || '';
            bodyText = bodyText?.replace(regex, value) || '';
            subject = subject?.replace(regex, value) || '';
          });
        }
        
        // Send email
        await sendEmail({
          to: email.to_address,
          toName: email.to_name,
          subject,
          bodyHtml,
          bodyText
        });
        
        // Mark as sent
        await pool.query(
          `UPDATE email_queue 
           SET status = 'sent', sent_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [email.id]
        );
        
      } catch (error) {
        console.error(`Failed to send email ${email.id}:`, error);
        
        // Increment retry count
        await pool.query(
          `UPDATE email_queue 
           SET retry_count = retry_count + 1, 
               error_message = $1,
               status = CASE WHEN retry_count + 1 >= max_retries THEN 'failed' ELSE 'pending' END,
               updated_at = NOW()
           WHERE id = $2`,
          [error.message, email.id]
        );
      }
    }
    
    return { processed: pendingEmails.rows.length };
    
  } catch (error) {
    console.error('Process email queue error:', error);
    throw error;
  }
}

/**
 * Send invoice email
 */
export async function sendInvoiceEmail({ userId, invoiceId, to, toName }) {
  try {
    // Get invoice details
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, u.company_name as business_name
       FROM invoices i
       JOIN contacts c ON i.contact_id = c.id
       JOIN users u ON i.user_id = u.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [invoiceId, userId]
    );
    
    if (invoiceResult.rows.length === 0) {
      throw new Error('Invoice not found');
    }
    
    const invoice = invoiceResult.rows[0];
    
    // Get invoice items
    const itemsResult = await pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoiceId]
    );
    
    // Build email content
    const itemsHtml = itemsResult.rows.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.unit_price}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.line_total}</td>
      </tr>
    `).join('');
    
    const subject = `Invoice ${invoice.invoice_number} from ${invoice.business_name}`;
    
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice ${invoice.invoice_number}</h2>
        <p>Dear ${invoice.customer_name},</p>
        <p>Please find your invoice below:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">Description</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Subtotal:</td>
              <td style="padding: 8px; text-align: right;">$${invoice.subtotal}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Tax:</td>
              <td style="padding: 8px; text-align: right;">$${invoice.tax_amount}</td>
            </tr>
            <tr style="font-size: 1.2em;">
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Total:</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">$${invoice.total_amount}</td>
            </tr>
          </tfoot>
        </table>
        
        <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
        
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
        
        <p style="margin-top: 30px;">
          <a href="${process.env.PORTAL_URL}/portal/invoices/${invoice.id}" 
             style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View & Pay Online
          </a>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 0.9em;">
          Thank you for your business!<br>
          ${invoice.business_name}
        </p>
      </div>
    `;
    
    const bodyText = `
Invoice ${invoice.invoice_number} from ${invoice.business_name}

Dear ${invoice.customer_name},

Please find your invoice details:

Total Amount: $${invoice.total_amount}
Due Date: ${new Date(invoice.due_date).toLocaleDateString()}

View and pay online: ${process.env.PORTAL_URL}/portal/invoices/${invoice.id}

Thank you for your business!
${invoice.business_name}
    `.trim();
    
    // Queue the email
    return await queueEmail({
      userId,
      to,
      toName: toName || invoice.customer_name,
      subject,
      bodyHtml,
      bodyText,
      variables: {
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        totalAmount: invoice.total_amount
      }
    });
    
  } catch (error) {
    console.error('Send invoice email error:', error);
    throw error;
  }
}

/**
 * Send quote email
 */
export async function sendQuoteEmail({ userId, jobId, to, toName }) {
  try {
    // Get job details
    const jobResult = await pool.query(
      `SELECT j.*, c.name as customer_name, u.company_name as business_name
       FROM jobs j
       JOIN contacts c ON j.builder::uuid = c.id
       JOIN users u ON j.user_id = u.id
       WHERE j.id = $1 AND j.user_id = $2`,
      [jobId, userId]
    );
    
    if (jobResult.rows.length === 0) {
      throw new Error('Job not found');
    }
    
    const job = jobResult.rows[0];
    
    // Get quote items
    const itemsResult = await pool.query(
      `SELECT * FROM quote_items WHERE job_id = $1 ORDER BY sort_order`,
      [jobId]
    );
    
    const totalAmount = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.line_total), 0);
    
    const subject = `Quote from ${job.business_name} - ${job.title}`;
    
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Quote: ${job.title}</h2>
        <p>Dear ${job.customer_name},</p>
        <p>Please find your quote below:</p>
        
        <p><strong>Job Type:</strong> ${job.job_type}<br>
           <strong>Proposed Date:</strong> ${new Date(job.date).toLocaleDateString()}</p>
        
        <p style="margin-top: 30px;">
          <a href="${process.env.PORTAL_URL}/portal/quotes/${job.id}" 
             style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
            Accept Quote
          </a>
          <a href="${process.env.PORTAL_URL}/portal/quotes/${job.id}" 
             style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Decline Quote
          </a>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 0.9em;">
          We look forward to working with you!<br>
          ${job.business_name}
        </p>
      </div>
    `;
    
    return await queueEmail({
      userId,
      to,
      toName: toName || job.customer_name,
      subject,
      bodyHtml,
      variables: {
        jobTitle: job.title,
        customerName: job.customer_name,
        totalAmount
      }
    });
    
  } catch (error) {
    console.error('Send quote email error:', error);
    throw error;
  }
}

export default {
  queueEmail,
  sendEmail,
  processEmailQueue,
  sendInvoiceEmail,
  sendQuoteEmail
};
