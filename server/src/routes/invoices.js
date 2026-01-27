/**
 * Invoices Routes
 * API endpoints for invoice management
 */

import express from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import db from '../config/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/invoices
 * Get all invoices for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, customer_id, job_id, from_date, to_date, search, overdue_only } = req.query;

    let query = `
      SELECT i.*,
             c.name as customer_display_name,
             c.company as customer_company,
             j.title as job_title,
             q.quote_number,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count,
             (SELECT COUNT(*) FROM invoice_payments WHERE invoice_id = i.id) as payment_count
      FROM invoices i
      LEFT JOIN contacts c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN quotes q ON i.quote_id = q.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.user_id = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }

    if (customer_id) {
      params.push(customer_id);
      query += ` AND i.customer_id = $${params.length}`;
    }

    if (job_id) {
      params.push(job_id);
      query += ` AND i.job_id = $${params.length}`;
    }

    if (from_date) {
      params.push(from_date);
      query += ` AND i.invoice_date >= $${params.length}`;
    }

    if (to_date) {
      params.push(to_date);
      query += ` AND i.invoice_date <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (i.invoice_number ILIKE $${params.length} OR i.title ILIKE $${params.length} OR i.customer_name ILIKE $${params.length})`;
    }

    if (overdue_only === 'true') {
      query += ` AND i.status = 'overdue'`;
    }

    query += ' ORDER BY i.created_at DESC';

    const result = await db.query(query, params);

    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      customerDisplayName: row.customer_display_name,
      customerCompany: row.customer_company,
      jobId: row.job_id,
      jobTitle: row.job_title,
      quoteId: row.quote_id,
      quoteNumber: row.quote_number,
      title: row.title,
      description: row.description,
      status: row.status,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      paymentTerms: row.payment_terms,
      subtotal: parseFloat(row.subtotal) || 0,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxRate: parseFloat(row.tax_rate) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      total: parseFloat(row.total) || 0,
      amountPaid: parseFloat(row.amount_paid) || 0,
      amountDue: parseFloat(row.amount_due) || 0,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      paidAt: row.paid_at,
      lastPaymentDate: row.last_payment_date,
      isProgressInvoice: row.is_progress_invoice,
      progressPercentage: row.progress_percentage,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      itemCount: parseInt(row.item_count) || 0,
      paymentCount: parseInt(row.payment_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/invoices/stats
 * Get invoice statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_invoices,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_invoices,
        COUNT(*) FILTER (WHERE status = 'partially_paid') as partially_paid_invoices,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
        COALESCE(SUM(total), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE status NOT IN ('paid', 'cancelled', 'void')), 0) as total_outstanding,
        COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0) as overdue_value,
        COALESCE(AVG(total), 0) as avg_invoice_value,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as invoices_this_month,
        COALESCE(SUM(total) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as revenue_this_month,
        COALESCE(SUM(amount_paid) FILTER (WHERE last_payment_date >= CURRENT_DATE - INTERVAL '30 days'), 0) as collected_this_month
      FROM invoices
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    res.json({
      totalInvoices: parseInt(stats.total_invoices) || 0,
      draftInvoices: parseInt(stats.draft_invoices) || 0,
      sentInvoices: parseInt(stats.sent_invoices) || 0,
      partiallyPaidInvoices: parseInt(stats.partially_paid_invoices) || 0,
      paidInvoices: parseInt(stats.paid_invoices) || 0,
      overdueInvoices: parseInt(stats.overdue_invoices) || 0,
      totalValue: parseFloat(stats.total_value) || 0,
      totalPaid: parseFloat(stats.total_paid) || 0,
      totalOutstanding: parseFloat(stats.total_outstanding) || 0,
      overdueValue: parseFloat(stats.overdue_value) || 0,
      avgInvoiceValue: parseFloat(stats.avg_invoice_value) || 0,
      invoicesThisMonth: parseInt(stats.invoices_this_month) || 0,
      revenueThisMonth: parseFloat(stats.revenue_this_month) || 0,
      collectedThisMonth: parseFloat(stats.collected_this_month) || 0
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/invoices/:id
 * Get a specific invoice with items, payments, and history
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get invoice
    const invoiceResult = await db.query(`
      SELECT i.*,
             c.name as customer_display_name,
             c.email as customer_email_contact,
             c.phone as customer_phone_contact,
             c.company as customer_company,
             j.title as job_title,
             j.status as job_status,
             q.quote_number,
             u.full_name as created_by_name
      FROM invoices i
      LEFT JOIN contacts c ON i.customer_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      LEFT JOIN quotes q ON i.quote_id = q.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1 AND i.user_id = $2
    `, [id, userId]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const row = invoiceResult.rows[0];

    // Get items
    const itemsResult = await db.query(`
      SELECT ii.*,
             inv.name as current_item_name,
             inv.category as item_category
      FROM invoice_items ii
      LEFT JOIN inventory_items inv ON ii.inventory_item_id = inv.id
      WHERE ii.invoice_id = $1
      ORDER BY ii.sort_order ASC, ii.created_at ASC
    `, [id]);

    // Get payments
    const paymentsResult = await db.query(`
      SELECT ip.*, u.full_name as recorded_by_name
      FROM invoice_payments ip
      LEFT JOIN users u ON ip.user_id = u.id
      WHERE ip.invoice_id = $1
      ORDER BY ip.payment_date DESC, ip.created_at DESC
    `, [id]);

    // Get history
    const historyResult = await db.query(`
      SELECT ih.*, u.full_name as user_name
      FROM invoice_history ih
      LEFT JOIN users u ON ih.user_id = u.id
      WHERE ih.invoice_id = $1
      ORDER BY ih.created_at DESC
    `, [id]);

    const invoice = {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      customerAbn: row.customer_abn,
      customerDisplayName: row.customer_display_name,
      customerCompany: row.customer_company,
      jobId: row.job_id,
      jobTitle: row.job_title,
      jobStatus: row.job_status,
      quoteId: row.quote_id,
      quoteNumber: row.quote_number,
      title: row.title,
      description: row.description,
      status: row.status,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      paymentTerms: row.payment_terms,
      customTermsDays: row.custom_terms_days,
      subtotal: parseFloat(row.subtotal) || 0,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxRate: parseFloat(row.tax_rate) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      total: parseFloat(row.total) || 0,
      amountPaid: parseFloat(row.amount_paid) || 0,
      amountDue: parseFloat(row.amount_due) || 0,
      terms: row.terms,
      notes: row.notes,
      customerNotes: row.customer_notes,
      paymentInstructions: row.payment_instructions,
      bankName: row.bank_name,
      bankAccountName: row.bank_account_name,
      bankBsb: row.bank_bsb,
      bankAccountNumber: row.bank_account_number,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      paidAt: row.paid_at,
      lastPaymentDate: row.last_payment_date,
      lastReminderSentAt: row.last_reminder_sent_at,
      reminderCount: row.reminder_count,
      isProgressInvoice: row.is_progress_invoice,
      progressPercentage: row.progress_percentage,
      parentInvoiceId: row.parent_invoice_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        invoiceId: item.invoice_id,
        itemType: item.item_type,
        inventoryItemId: item.inventory_item_id,
        itemName: item.item_name,
        itemDescription: item.item_description,
        itemCode: item.item_code,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        unitPrice: parseFloat(item.unit_price) || 0,
        lineTotal: parseFloat(item.line_total) || 0,
        isTaxable: item.is_taxable,
        sortOrder: item.sort_order,
        groupName: item.group_name,
        currentItemName: item.current_item_name,
        itemCategory: item.item_category,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      payments: paymentsResult.rows.map(p => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: parseFloat(p.amount) || 0,
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        referenceNumber: p.reference_number,
        notes: p.notes,
        recordedByName: p.recorded_by_name,
        createdAt: p.created_at
      })),
      history: historyResult.rows.map(h => ({
        id: h.id,
        invoiceId: h.invoice_id,
        userId: h.user_id,
        userName: h.user_name,
        action: h.action,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        notes: h.notes,
        totalAtAction: parseFloat(h.total_at_action) || 0,
        amountPaidAtAction: parseFloat(h.amount_paid_at_action) || 0,
        createdAt: h.created_at
      }))
    };

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/',
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('customerName').notEmpty().trim().withMessage('Customer name is required'),
    validate
  ],
  async (req, res) => {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.userId;
      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerAbn,
        jobId,
        quoteId,
        title,
        description,
        invoiceDate,
        paymentTerms,
        customTermsDays,
        discountType,
        discountValue,
        taxRate,
        terms,
        notes,
        customerNotes,
        paymentInstructions,
        bankName,
        bankAccountName,
        bankBsb,
        bankAccountNumber,
        isProgressInvoice,
        progressPercentage,
        parentInvoiceId,
        items
      } = req.body;

      // Generate invoice number
      const invoiceNumberResult = await client.query(
        'SELECT generate_invoice_number($1) as invoice_number',
        [userId]
      );
      const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

      // Calculate due date
      const invDate = invoiceDate || new Date().toISOString().split('T')[0];
      const dueDateResult = await client.query(
        'SELECT calculate_due_date($1::DATE, $2, $3) as due_date',
        [invDate, paymentTerms || 'NET30', customTermsDays || null]
      );
      const dueDate = dueDateResult.rows[0].due_date;

      // Create invoice
      const invoiceResult = await client.query(`
        INSERT INTO invoices (
          user_id, invoice_number, customer_id, customer_name, customer_email,
          customer_phone, customer_address, customer_abn, job_id, quote_id,
          title, description, invoice_date, due_date, payment_terms, custom_terms_days,
          discount_type, discount_value, tax_rate, terms, notes, customer_notes,
          payment_instructions, bank_name, bank_account_name, bank_bsb, bank_account_number,
          is_progress_invoice, progress_percentage, parent_invoice_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
        RETURNING *
      `, [
        userId,
        invoiceNumber,
        customerId || null,
        customerName,
        customerEmail || null,
        customerPhone || null,
        customerAddress || null,
        customerAbn || null,
        jobId || null,
        quoteId || null,
        title,
        description || null,
        invDate,
        dueDate,
        paymentTerms || 'NET30',
        customTermsDays || null,
        discountType || 'fixed',
        discountValue || 0,
        taxRate !== undefined ? taxRate : 10.00,
        terms || null,
        notes || null,
        customerNotes || null,
        paymentInstructions || null,
        bankName || null,
        bankAccountName || null,
        bankBsb || null,
        bankAccountNumber || null,
        isProgressInvoice || false,
        progressPercentage || null,
        parentInvoiceId || null,
        userId
      ]);

      const invoice = invoiceResult.rows[0];

      // Add items if provided
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);

          await client.query(`
            INSERT INTO invoice_items (
              invoice_id, item_type, inventory_item_id, item_name, item_description,
              item_code, quantity, unit, unit_price, line_total, is_taxable,
              sort_order, group_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            invoice.id,
            item.itemType || 'material',
            item.inventoryItemId || null,
            item.itemName,
            item.itemDescription || null,
            item.itemCode || null,
            item.quantity || 1,
            item.unit || 'EA',
            item.unitPrice || 0,
            lineTotal,
            item.isTaxable !== false,
            item.sortOrder || i,
            item.groupName || null
          ]);
        }
      }

      // Log creation
      await client.query(`
        INSERT INTO invoice_history (invoice_id, user_id, action, new_status, notes, total_at_action)
        VALUES ($1, $2, 'created', 'draft', 'Invoice created', $3)
      `, [invoice.id, userId, invoice.total]);

      // If created from quote, mark quote as converted
      if (quoteId) {
        await client.query(`
          UPDATE quotes
          SET status = 'converted', converted_to_invoice_id = $1
          WHERE id = $2 AND user_id = $3
        `, [invoice.id, quoteId, userId]);
      }

      await client.query('COMMIT');

      // Fetch complete invoice
      const completeResult = await client.query(`
        SELECT i.*, c.name as customer_display_name
        FROM invoices i
        LEFT JOIN contacts c ON i.customer_id = c.id
        WHERE i.id = $1
      `, [invoice.id]);

      res.status(201).json({
        id: completeResult.rows[0].id,
        invoiceNumber: completeResult.rows[0].invoice_number,
        ...completeResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/invoices/:id
 * Update an invoice (only draft or sent invoices)
 */
router.put('/:id',
  [
    body('title').optional().notEmpty().trim(),
    validate
  ],
  async (req, res) => {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.userId;
      const { id } = req.params;

      // Check invoice exists and is editable
      const invoiceCheck = await client.query(
        'SELECT status FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (invoiceCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const currentStatus = invoiceCheck.rows[0].status;
      if (!['draft', 'sent'].includes(currentStatus)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot edit invoice in current status' });
      }

      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerAbn,
        jobId,
        title,
        description,
        invoiceDate,
        paymentTerms,
        customTermsDays,
        discountType,
        discountValue,
        taxRate,
        terms,
        notes,
        customerNotes,
        paymentInstructions,
        bankName,
        bankAccountName,
        bankBsb,
        bankAccountNumber,
        items
      } = req.body;

      // Recalculate due date if invoice date or payment terms changed
      let dueDate = null;
      if (invoiceDate || paymentTerms) {
        const invDate = invoiceDate || new Date().toISOString().split('T')[0];
        const dueDateResult = await client.query(
          'SELECT calculate_due_date($1::DATE, $2, $3) as due_date',
          [invDate, paymentTerms || 'NET30', customTermsDays || null]
        );
        dueDate = dueDateResult.rows[0].due_date;
      }

      // Update invoice
      await client.query(`
        UPDATE invoices SET
          customer_id = COALESCE($1, customer_id),
          customer_name = COALESCE($2, customer_name),
          customer_email = COALESCE($3, customer_email),
          customer_phone = COALESCE($4, customer_phone),
          customer_address = COALESCE($5, customer_address),
          customer_abn = $6,
          job_id = $7,
          title = COALESCE($8, title),
          description = $9,
          invoice_date = COALESCE($10, invoice_date),
          due_date = COALESCE($11, due_date),
          payment_terms = COALESCE($12, payment_terms),
          custom_terms_days = $13,
          discount_type = COALESCE($14, discount_type),
          discount_value = COALESCE($15, discount_value),
          tax_rate = COALESCE($16, tax_rate),
          terms = $17,
          notes = $18,
          customer_notes = $19,
          payment_instructions = $20,
          bank_name = $21,
          bank_account_name = $22,
          bank_bsb = $23,
          bank_account_number = $24
        WHERE id = $25 AND user_id = $26
      `, [
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerAbn,
        jobId,
        title,
        description,
        invoiceDate,
        dueDate,
        paymentTerms,
        customTermsDays,
        discountType,
        discountValue,
        taxRate,
        terms,
        notes,
        customerNotes,
        paymentInstructions,
        bankName,
        bankAccountName,
        bankBsb,
        bankAccountNumber,
        id,
        userId
      ]);

      // If items provided, replace them
      if (items !== undefined) {
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);

            await client.query(`
              INSERT INTO invoice_items (
                invoice_id, item_type, inventory_item_id, item_name, item_description,
                item_code, quantity, unit, unit_price, line_total, is_taxable,
                sort_order, group_name
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
              id,
              item.itemType || 'material',
              item.inventoryItemId || null,
              item.itemName,
              item.itemDescription || null,
              item.itemCode || null,
              item.quantity || 1,
              item.unit || 'EA',
              item.unitPrice || 0,
              lineTotal,
              item.isTaxable !== false,
              item.sortOrder || i,
              item.groupName || null
            ]);
          }
        }
      }

      // Log update
      await client.query(`
        INSERT INTO invoice_history (invoice_id, user_id, action, notes)
        VALUES ($1, $2, 'updated', 'Invoice updated')
      `, [id, userId]);

      await client.query('COMMIT');

      // Fetch updated invoice
      const result = await client.query(`
        SELECT i.*, c.name as customer_display_name
        FROM invoices i
        LEFT JOIN contacts c ON i.customer_id = c.id
        WHERE i.id = $1
      `, [id]);

      res.json(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating invoice:', error);
      res.status(500).json({ error: 'Failed to update invoice' });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/invoices/:id/send
 * Mark invoice as sent to customer
 */
router.post('/:id/send', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;

    const result = await client.query(`
      UPDATE invoices
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot send invoice - must be in draft status' });
    }

    // Log action
    await client.query(`
      INSERT INTO invoice_history (invoice_id, user_id, action, old_status, new_status, notes, total_at_action)
      VALUES ($1, $2, 'sent', 'draft', 'sent', 'Invoice sent to customer', $3)
    `, [id, userId, result.rows[0].total]);

    await client.query('COMMIT');

    res.json({ message: 'Invoice sent successfully', invoice: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/invoices/:id/payments
 * Record a payment for an invoice
 */
router.post('/:id/payments',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    validate
  ],
  async (req, res) => {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.userId;
      const { id } = req.params;
      const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;

      // Verify invoice exists and can receive payment
      const invoiceCheck = await client.query(
        'SELECT status, total, amount_paid FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (invoiceCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = invoiceCheck.rows[0];
      if (['draft', 'paid', 'cancelled', 'void'].includes(invoice.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot record payment for this invoice' });
      }

      // Check if payment would exceed amount due
      const amountDue = parseFloat(invoice.total) - parseFloat(invoice.amount_paid);
      if (amount > amountDue + 0.01) { // Small tolerance for rounding
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Payment amount exceeds amount due ($${amountDue.toFixed(2)})` });
      }

      // Record payment
      const paymentResult = await client.query(`
        INSERT INTO invoice_payments (invoice_id, user_id, amount, payment_date, payment_method, reference_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        id,
        userId,
        amount,
        paymentDate || new Date().toISOString().split('T')[0],
        paymentMethod,
        referenceNumber || null,
        notes || null
      ]);

      // Log payment
      const newAmountPaid = parseFloat(invoice.amount_paid) + amount;
      const newStatus = newAmountPaid >= parseFloat(invoice.total) ? 'paid' : 'partially_paid';

      await client.query(`
        INSERT INTO invoice_history (invoice_id, user_id, action, old_status, new_status, notes, total_at_action, amount_paid_at_action)
        VALUES ($1, $2, 'payment_received', $3, $4, $5, $6, $7)
      `, [
        id,
        userId,
        invoice.status,
        newStatus,
        `Payment of $${amount.toFixed(2)} received via ${paymentMethod}`,
        invoice.total,
        newAmountPaid
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Payment recorded successfully',
        payment: paymentResult.rows[0],
        invoiceStatus: newStatus
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error recording payment:', error);
      res.status(500).json({ error: 'Failed to record payment' });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/invoices/:id/void
 * Void an invoice
 */
router.post('/:id/void', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await client.query(`
      UPDATE invoices
      SET status = 'void'
      WHERE id = $1 AND user_id = $2 AND status NOT IN ('paid', 'void')
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot void this invoice' });
    }

    // Log action
    await client.query(`
      INSERT INTO invoice_history (invoice_id, user_id, action, old_status, new_status, notes)
      VALUES ($1, $2, 'voided', $3, 'void', $4)
    `, [id, userId, result.rows[0].status, reason || 'Invoice voided']);

    await client.query('COMMIT');

    res.json({ message: 'Invoice voided', invoice: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error voiding invoice:', error);
    res.status(500).json({ error: 'Failed to void invoice' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/invoices/:id
 * Delete an invoice (only drafts)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM invoices
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Can only delete draft invoices' });
    }

    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

/**
 * POST /api/invoices/from-quote/:quoteId
 * Create an invoice from an approved quote
 */
router.post('/from-quote/:quoteId', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { quoteId } = req.params;

    // Get quote with items
    const quoteResult = await client.query(`
      SELECT q.*,
             json_agg(
               json_build_object(
                 'itemType', qi.item_type,
                 'inventoryItemId', qi.inventory_item_id,
                 'itemName', qi.item_name,
                 'itemDescription', qi.item_description,
                 'itemCode', qi.item_code,
                 'quantity', qi.quantity,
                 'unit', qi.unit,
                 'unitPrice', qi.unit_price,
                 'lineTotal', qi.line_total,
                 'sortOrder', qi.sort_order,
                 'groupName', qi.group_name
               )
             ) FILTER (WHERE qi.id IS NOT NULL) as items
      FROM quotes q
      LEFT JOIN quote_items qi ON q.id = qi.quote_id
      WHERE q.id = $1 AND q.user_id = $2
      GROUP BY q.id
    `, [quoteId, userId]);

    if (quoteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quote = quoteResult.rows[0];

    if (!['approved', 'sent', 'viewed'].includes(quote.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Quote must be approved before converting to invoice' });
    }

    // Generate invoice number
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [userId]
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Calculate due date
    const invDate = new Date().toISOString().split('T')[0];
    const dueDateResult = await client.query(
      'SELECT calculate_due_date($1::DATE, $2, NULL) as due_date',
      [invDate, 'NET30']
    );
    const dueDate = dueDateResult.rows[0].due_date;

    // Create invoice from quote
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        user_id, invoice_number, customer_id, customer_name, customer_email,
        customer_phone, customer_address, job_id, quote_id, title, description,
        invoice_date, due_date, payment_terms, discount_type, discount_value,
        tax_rate, terms, customer_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      userId,
      invoiceNumber,
      quote.customer_id,
      quote.customer_name,
      quote.customer_email,
      quote.customer_phone,
      quote.customer_address,
      quote.job_id,
      quoteId,
      quote.title,
      quote.description,
      invDate,
      dueDate,
      'NET30',
      quote.discount_type,
      quote.discount_value,
      quote.tax_rate,
      quote.terms,
      quote.customer_notes,
      userId
    ]);

    const invoice = invoiceResult.rows[0];

    // Copy items from quote
    if (quote.items && quote.items.length > 0) {
      for (const item of quote.items) {
        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, inventory_item_id, item_name, item_description,
            item_code, quantity, unit, unit_price, line_total, is_taxable,
            sort_order, group_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12)
        `, [
          invoice.id,
          item.itemType,
          item.inventoryItemId,
          item.itemName,
          item.itemDescription,
          item.itemCode,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.lineTotal,
          item.sortOrder,
          item.groupName
        ]);
      }
    }

    // Update quote status
    await client.query(`
      UPDATE quotes
      SET status = 'converted', converted_to_invoice_id = $1
      WHERE id = $2
    `, [invoice.id, quoteId]);

    // Log creation
    await client.query(`
      INSERT INTO invoice_history (invoice_id, user_id, action, new_status, notes)
      VALUES ($1, $2, 'created', 'draft', $3)
    `, [invoice.id, userId, `Created from quote ${quote.quote_number}`]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Invoice created from quote',
      invoiceId: invoice.id,
      invoiceNumber
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice from quote:', error);
    res.status(500).json({ error: 'Failed to create invoice from quote' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/invoices/from-job/:jobId
 * Create an invoice from a completed job
 */
router.post('/from-job/:jobId', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { jobId } = req.params;
    const { customerId, customerName } = req.body;

    // Get job with allocated items
    const jobResult = await client.query(`
      SELECT j.*,
             json_agg(
               json_build_object(
                 'itemId', jai.item_id,
                 'quantity', jai.quantity,
                 'itemName', i.name,
                 'sellPrice', COALESCE(i.sell_price_excl_gst, i.price, 0),
                 'category', i.category
               )
             ) FILTER (WHERE jai.item_id IS NOT NULL) as allocated_items
      FROM jobs j
      LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
      LEFT JOIN inventory_items i ON jai.item_id = i.id
      WHERE j.id = $1 AND j.user_id = $2
      GROUP BY j.id
    `, [jobId, userId]);

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Generate invoice number
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [userId]
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Calculate due date
    const invDate = new Date().toISOString().split('T')[0];
    const dueDateResult = await client.query(
      'SELECT calculate_due_date($1::DATE, $2, NULL) as due_date',
      [invDate, 'NET30']
    );
    const dueDate = dueDateResult.rows[0].due_date;

    // Create invoice
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        user_id, invoice_number, customer_id, customer_name, job_id,
        title, description, invoice_date, due_date, payment_terms, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userId,
      invoiceNumber,
      customerId || null,
      customerName || job.builder || 'Customer',
      jobId,
      `Invoice for ${job.title}`,
      `Materials and labor for job: ${job.title}`,
      invDate,
      dueDate,
      'NET30',
      userId
    ]);

    const invoice = invoiceResult.rows[0];

    // Add items from job
    if (job.allocated_items && job.allocated_items.length > 0) {
      for (let i = 0; i < job.allocated_items.length; i++) {
        const item = job.allocated_items[i];
        const lineTotal = item.quantity * (item.sellPrice || 0);

        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, inventory_item_id, item_name,
            quantity, unit, unit_price, line_total, sort_order, group_name
          ) VALUES ($1, 'material', $2, $3, $4, 'EA', $5, $6, $7, $8)
        `, [
          invoice.id,
          item.itemId,
          item.itemName,
          item.quantity,
          item.sellPrice || 0,
          lineTotal,
          i,
          item.category || 'Materials'
        ]);
      }
    }

    // Log creation
    await client.query(`
      INSERT INTO invoice_history (invoice_id, user_id, action, new_status, notes)
      VALUES ($1, $2, 'created', 'draft', $3)
    `, [invoice.id, userId, `Created from job: ${job.title}`]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Invoice created from job',
      invoiceId: invoice.id,
      invoiceNumber
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice from job:', error);
    res.status(500).json({ error: 'Failed to create invoice from job' });
  } finally {
    client.release();
  }
});

export default router;
