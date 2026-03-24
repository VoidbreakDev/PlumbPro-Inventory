/**
 * Invoice Management Routes
 * Business-side invoice creation, management, and payment processing
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendInvoiceEmail } from '../services/emailService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all invoices for user
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  const { status, contact_id, limit = 50, offset = 0 } = req.query;
  
  try {
    let query = `
      SELECT i.*, c.name as customer_name, c.email as customer_email, j.title as job_title
      FROM invoices i
      JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.user_id = $1
    `;
    
    const params = [userId];
    
    if (status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }
    
    if (contact_id) {
      query += ` AND i.contact_id = $${params.length + 1}`;
      params.push(contact_id);
    }
    
    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

// Get invoice statistics
router.get('/stats/summary', async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('sent', 'partial')) as outstanding_count,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('sent', 'partial', 'overdue')), 0) as outstanding_amount,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('sent', 'partial', 'overdue')), 0) as due_amount,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '30 days'), 0) as collected_30d
       FROM invoices
       WHERE user_id = $1`,
      [userId]
    );
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Invoice stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

// Get single invoice
router.get('/:id', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
        j.title as job_title
       FROM invoices i
       JOIN contacts c ON i.contact_id = c.id
       LEFT JOIN jobs j ON i.job_id = j.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, userId]
    );
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Get invoice items
    const itemsResult = await pool.query(
      `SELECT * FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY sort_order`,
      [id]
    );
    
    // Get payments
    const paymentsResult = await pool.query(
      `SELECT * FROM payments
       WHERE invoice_id = $1
       ORDER BY payment_date DESC`,
      [id]
    );
    
    res.json({
      ...invoiceResult.rows[0],
      items: itemsResult.rows,
      payments: paymentsResult.rows
    });
    
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
});

// Generate invoice number
async function generateInvoiceNumber(userId) {
  const date = new Date();
  const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM invoices 
     WHERE user_id = $1 AND invoice_number LIKE $2`,
    [userId, `${prefix}%`]
  );
  
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

// Create invoice
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const {
    contact_id,
    job_id,
    issue_date = new Date(),
    due_date,
    items,
    notes,
    terms
  } = req.body;
  
  if (!contact_id) {
    return res.status(400).json({ error: 'Customer is required' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    
    items.forEach(item => {
      const lineTotal = item.quantity * item.unit_price;
      const lineTax = lineTotal * (item.tax_rate || 0) / 100;
      subtotal += lineTotal;
      taxAmount += lineTax;
    });
    
    const totalAmount = subtotal + taxAmount;
    
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(userId);
    
    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        user_id, contact_id, job_id, invoice_number, status,
        issue_date, due_date, subtotal, tax_amount, total_amount,
        notes, terms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId, contact_id, job_id, invoiceNumber, 'draft',
        issue_date, due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal, taxAmount, totalAmount,
        notes, terms
      ]
    );
    
    const invoiceId = invoiceResult.rows[0].id;
    
    // Create invoice items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lineTotal = item.quantity * item.unit_price;
      
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, description, quantity, unit_price,
          tax_rate, line_total, item_type, inventory_item_id, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          invoiceId, item.description, item.quantity, item.unit_price,
          item.tax_rate || 0, lineTotal, item.item_type || 'material',
          item.inventory_item_id, i
        ]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(invoiceResult.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// Update invoice
router.put('/:id', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const { due_date, notes, terms, items } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check invoice exists and is editable
    const checkResult = await client.query(
      `SELECT * FROM invoices WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = checkResult.rows[0];
    
    // Don't allow editing paid invoices
    if (invoice.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot edit a paid invoice' });
    }
    
    // Update items if provided
    if (items && items.length > 0) {
      // Delete existing items
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      
      // Calculate new totals
      let subtotal = 0;
      let taxAmount = 0;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = item.quantity * item.unit_price;
        const lineTax = lineTotal * (item.tax_rate || 0) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
        
        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, description, quantity, unit_price,
            tax_rate, line_total, item_type, inventory_item_id, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id, item.description, item.quantity, item.unit_price,
            item.tax_rate || 0, lineTotal, item.item_type || 'material',
            item.inventory_item_id, i
          ]
        );
      }
      
      const totalAmount = subtotal + taxAmount;
      
      // Update invoice totals
      await client.query(
        `UPDATE invoices 
         SET subtotal = $1, tax_amount = $2, total_amount = $3, updated_at = NOW()
         WHERE id = $4`,
        [subtotal, taxAmount, totalAmount, id]
      );
    }
    
    // Update other fields
    const updateResult = await client.query(
      `UPDATE invoices 
       SET due_date = COALESCE($1, due_date),
           notes = COALESCE($2, notes),
           terms = COALESCE($3, terms),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [due_date, notes, terms, id, userId]
    );
    
    await client.query('COMMIT');
    
    res.json(updateResult.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  } finally {
    client.release();
  }
});

// Send invoice to customer
router.post('/:id/send', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  
  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const recipientResult = await client.query(
        `SELECT i.id, c.name as customer_name, c.email as customer_email
         FROM invoices i
         JOIN contacts c ON i.contact_id = c.id
         WHERE i.id = $1 AND i.user_id = $2`,
        [id, userId]
      );

      if (recipientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const result = await client.query(
        `UPDATE invoices 
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND status = 'draft'
         RETURNING *`,
        [id, userId]
      );
    
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invoice not found or already sent' });
      }

      const invoice = recipientResult.rows[0];
      const recipientEmail = req.body?.to || invoice.customer_email;

      if (!recipientEmail) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Customer email is required before sending an invoice' });
      }

      await sendInvoiceEmail({
        userId,
        invoiceId: id,
        to: recipientEmail,
        toName: req.body?.toName || invoice.customer_name || undefined,
      });

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Record payment
router.post('/:id/payments', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const { amount, payment_method, payment_date, reference, notes } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get invoice
    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = invoiceResult.rows[0];
    const remainingAmount = invoice.total_amount - invoice.amount_paid;
    
    if (amount > remainingAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Payment amount exceeds remaining balance',
        remaining: remainingAmount
      });
    }
    
    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (
        invoice_id, amount, payment_method, payment_date, reference, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, amount, payment_method, payment_date || new Date(), reference, notes]
    );
    
    // Update invoice
    const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
    let newStatus = invoice.status;
    
    if (newAmountPaid >= invoice.total_amount) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    }
    
    await client.query(
      `UPDATE invoices 
       SET amount_paid = $1, status = $2, paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $3`,
      [newAmountPaid, newStatus, id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json(paymentResult.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// Delete invoice (draft only)
router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      `DELETE FROM invoices 
       WHERE id = $1 AND user_id = $2 AND status = 'draft'
       RETURNING id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invoice not found or cannot be deleted' });
    }
    
    res.json({ message: 'Invoice deleted successfully' });
    
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// Stripe: Create payment intent
router.post('/:id/payment-intent', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Payment processing not configured' });
  }
  
  try {
    const result = await pool.query(
      `SELECT i.*, c.email as customer_email, c.name as customer_name
       FROM invoices i
       JOIN contacts c ON i.contact_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = result.rows[0];

    // Resolve currency: prefer request body, then user preference, then default AUD
    let currency = (req.body?.currency || 'aud').toLowerCase();
    try {
      const prefResult = await pool.query(
        'SELECT currency_code FROM users WHERE id = $1',
        [userId]
      );
      if (prefResult.rows.length > 0 && prefResult.rows[0].currency_code) {
        currency = prefResult.rows[0].currency_code.toLowerCase();
      }
    } catch {
      // Column may not exist yet; fall back to 'aud'
    }

    // Lazy load Stripe
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round((invoice.total_amount - invoice.amount_paid) * 100), // Convert to cents
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.contact_id
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount
    });
    
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

export default router;
