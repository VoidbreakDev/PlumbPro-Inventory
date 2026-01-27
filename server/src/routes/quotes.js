/**
 * Quotes Routes
 * API endpoints for quote management
 */

import express from 'express';
import { body, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import db from '../config/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/quotes
 * Get all quotes for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, customer_id, job_id, from_date, to_date, search } = req.query;

    let query = `
      SELECT q.*,
             c.name as customer_display_name,
             c.company as customer_company,
             j.title as job_title,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count
      FROM quotes q
      LEFT JOIN contacts c ON q.customer_id = c.id
      LEFT JOIN jobs j ON q.job_id = j.id
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.user_id = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    }

    if (customer_id) {
      params.push(customer_id);
      query += ` AND q.customer_id = $${params.length}`;
    }

    if (job_id) {
      params.push(job_id);
      query += ` AND q.job_id = $${params.length}`;
    }

    if (from_date) {
      params.push(from_date);
      query += ` AND q.created_at >= $${params.length}`;
    }

    if (to_date) {
      params.push(to_date);
      query += ` AND q.created_at <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (q.quote_number ILIKE $${params.length} OR q.title ILIKE $${params.length} OR q.customer_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY q.created_at DESC';

    const result = await db.query(query, params);

    // Transform snake_case to camelCase
    const quotes = result.rows.map(row => ({
      id: row.id,
      quoteNumber: row.quote_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      customerDisplayName: row.customer_display_name,
      customerCompany: row.customer_company,
      jobId: row.job_id,
      jobTitle: row.job_title,
      title: row.title,
      description: row.description,
      status: row.status,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      subtotal: parseFloat(row.subtotal) || 0,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxRate: parseFloat(row.tax_rate) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      total: parseFloat(row.total) || 0,
      defaultMarkupPercentage: parseFloat(row.default_markup_percentage) || 0,
      terms: row.terms,
      notes: row.notes,
      customerNotes: row.customer_notes,
      requiresApproval: row.requires_approval,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      respondedAt: row.responded_at,
      convertedToInvoiceId: row.converted_to_invoice_id,
      version: row.version,
      parentQuoteId: row.parent_quote_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      itemCount: parseInt(row.item_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(quotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

/**
 * GET /api/quotes/stats
 * Get quote statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_quotes,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_quotes,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_quotes,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_quotes,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_quotes,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_quotes,
        COUNT(*) FILTER (WHERE status = 'converted') as converted_quotes,
        COALESCE(SUM(total), 0) as total_value,
        COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0) as pending_value,
        COALESCE(SUM(total) FILTER (WHERE status = 'approved'), 0) as approved_value,
        COALESCE(SUM(total) FILTER (WHERE status = 'converted'), 0) as converted_value,
        COALESCE(AVG(total), 0) as avg_quote_value,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as quotes_this_month,
        COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as approved_this_month
      FROM quotes
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    res.json({
      totalQuotes: parseInt(stats.total_quotes) || 0,
      draftQuotes: parseInt(stats.draft_quotes) || 0,
      sentQuotes: parseInt(stats.sent_quotes) || 0,
      approvedQuotes: parseInt(stats.approved_quotes) || 0,
      rejectedQuotes: parseInt(stats.rejected_quotes) || 0,
      expiredQuotes: parseInt(stats.expired_quotes) || 0,
      convertedQuotes: parseInt(stats.converted_quotes) || 0,
      totalValue: parseFloat(stats.total_value) || 0,
      pendingValue: parseFloat(stats.pending_value) || 0,
      approvedValue: parseFloat(stats.approved_value) || 0,
      convertedValue: parseFloat(stats.converted_value) || 0,
      avgQuoteValue: parseFloat(stats.avg_quote_value) || 0,
      quotesThisMonth: parseInt(stats.quotes_this_month) || 0,
      approvedThisMonth: parseInt(stats.approved_this_month) || 0
    });
  } catch (error) {
    console.error('Error fetching quote stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/quotes/:id
 * Get a specific quote with items and history
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get quote
    const quoteResult = await db.query(`
      SELECT q.*,
             c.name as customer_display_name,
             c.email as customer_email_contact,
             c.phone as customer_phone_contact,
             c.company as customer_company,
             j.title as job_title,
             j.builder as job_builder,
             j.status as job_status,
             u.full_name as created_by_name,
             au.full_name as approved_by_name
      FROM quotes q
      LEFT JOIN contacts c ON q.customer_id = c.id
      LEFT JOIN jobs j ON q.job_id = j.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN users au ON q.approved_by = au.id
      WHERE q.id = $1 AND q.user_id = $2
    `, [id, userId]);

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const row = quoteResult.rows[0];

    // Get items
    const itemsResult = await db.query(`
      SELECT qi.*,
             i.name as current_item_name,
             i.category as item_category,
             i.quantity as item_stock_quantity
      FROM quote_items qi
      LEFT JOIN inventory_items i ON qi.inventory_item_id = i.id
      WHERE qi.quote_id = $1
      ORDER BY qi.sort_order ASC, qi.created_at ASC
    `, [id]);

    // Get history
    const historyResult = await db.query(`
      SELECT qh.*, u.full_name as user_name
      FROM quote_history qh
      LEFT JOIN users u ON qh.user_id = u.id
      WHERE qh.quote_id = $1
      ORDER BY qh.created_at DESC
    `, [id]);

    const quote = {
      id: row.id,
      quoteNumber: row.quote_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      customerDisplayName: row.customer_display_name,
      customerEmailContact: row.customer_email_contact,
      customerPhoneContact: row.customer_phone_contact,
      customerCompany: row.customer_company,
      jobId: row.job_id,
      jobTitle: row.job_title,
      jobBuilder: row.job_builder,
      jobStatus: row.job_status,
      title: row.title,
      description: row.description,
      status: row.status,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      subtotal: parseFloat(row.subtotal) || 0,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      taxRate: parseFloat(row.tax_rate) || 0,
      taxAmount: parseFloat(row.tax_amount) || 0,
      total: parseFloat(row.total) || 0,
      defaultMarkupPercentage: parseFloat(row.default_markup_percentage) || 0,
      terms: row.terms,
      notes: row.notes,
      customerNotes: row.customer_notes,
      requiresApproval: row.requires_approval,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name,
      approvedAt: row.approved_at,
      rejectionReason: row.rejection_reason,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      respondedAt: row.responded_at,
      convertedToInvoiceId: row.converted_to_invoice_id,
      version: row.version,
      parentQuoteId: row.parent_quote_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        quoteId: item.quote_id,
        itemType: item.item_type,
        inventoryItemId: item.inventory_item_id,
        itemName: item.item_name,
        itemDescription: item.item_description,
        itemCode: item.item_code,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        unitCost: parseFloat(item.unit_cost) || 0,
        markupPercentage: parseFloat(item.markup_percentage) || 0,
        unitPrice: parseFloat(item.unit_price) || 0,
        lineTotal: parseFloat(item.line_total) || 0,
        profitMargin: parseFloat(item.profit_margin) || 0,
        sortOrder: item.sort_order,
        groupName: item.group_name,
        currentItemName: item.current_item_name,
        itemCategory: item.item_category,
        itemStockQuantity: item.item_stock_quantity,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      history: historyResult.rows.map(h => ({
        id: h.id,
        quoteId: h.quote_id,
        userId: h.user_id,
        userName: h.user_name,
        action: h.action,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        notes: h.notes,
        totalAtAction: parseFloat(h.total_at_action) || 0,
        createdAt: h.created_at
      }))
    };

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

/**
 * POST /api/quotes
 * Create a new quote
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
        jobId,
        title,
        description,
        validFrom,
        validUntil,
        discountType,
        discountValue,
        taxRate,
        defaultMarkupPercentage,
        terms,
        notes,
        customerNotes,
        requiresApproval,
        items // Array of quote items
      } = req.body;

      // Generate quote number
      const quoteNumberResult = await client.query(
        'SELECT generate_quote_number($1) as quote_number',
        [userId]
      );
      const quoteNumber = quoteNumberResult.rows[0].quote_number;

      // Create quote
      const quoteResult = await client.query(`
        INSERT INTO quotes (
          user_id, quote_number, customer_id, customer_name, customer_email,
          customer_phone, customer_address, job_id, title, description,
          valid_from, valid_until, discount_type, discount_value, tax_rate,
          default_markup_percentage, terms, notes, customer_notes,
          requires_approval, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `, [
        userId,
        quoteNumber,
        customerId || null,
        customerName,
        customerEmail || null,
        customerPhone || null,
        customerAddress || null,
        jobId || null,
        title,
        description || null,
        validFrom || new Date().toISOString().split('T')[0],
        validUntil || null,
        discountType || 'fixed',
        discountValue || 0,
        taxRate !== undefined ? taxRate : 10.00,
        defaultMarkupPercentage || 0,
        terms || null,
        notes || null,
        customerNotes || null,
        requiresApproval || false,
        userId
      ]);

      const quote = quoteResult.rows[0];

      // Add items if provided
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const profitMargin = lineTotal - ((item.quantity || 1) * (item.unitCost || 0));

          await client.query(`
            INSERT INTO quote_items (
              quote_id, item_type, inventory_item_id, item_name, item_description,
              item_code, quantity, unit, unit_cost, markup_percentage,
              unit_price, line_total, profit_margin, sort_order, group_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            quote.id,
            item.itemType || 'material',
            item.inventoryItemId || null,
            item.itemName,
            item.itemDescription || null,
            item.itemCode || null,
            item.quantity || 1,
            item.unit || 'EA',
            item.unitCost || 0,
            item.markupPercentage || 0,
            item.unitPrice || 0,
            lineTotal,
            profitMargin,
            item.sortOrder || i,
            item.groupName || null
          ]);
        }
      }

      // Log creation
      await client.query(`
        INSERT INTO quote_history (quote_id, user_id, action, new_status, notes, total_at_action)
        VALUES ($1, $2, 'created', 'draft', 'Quote created', $3)
      `, [quote.id, userId, quote.total]);

      await client.query('COMMIT');

      // Fetch complete quote
      const completeResult = await client.query(`
        SELECT q.*, c.name as customer_display_name
        FROM quotes q
        LEFT JOIN contacts c ON q.customer_id = c.id
        WHERE q.id = $1
      `, [quote.id]);

      res.status(201).json({
        id: completeResult.rows[0].id,
        quoteNumber: completeResult.rows[0].quote_number,
        ...completeResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating quote:', error);
      res.status(500).json({ error: 'Failed to create quote' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/quotes/:id
 * Update a quote (only draft or sent quotes)
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

      // Check quote exists and is editable
      const quoteCheck = await client.query(
        'SELECT status, version FROM quotes WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (quoteCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Quote not found' });
      }

      const currentStatus = quoteCheck.rows[0].status;
      if (!['draft', 'sent'].includes(currentStatus)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot edit quote in current status' });
      }

      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        jobId,
        title,
        description,
        validFrom,
        validUntil,
        discountType,
        discountValue,
        taxRate,
        defaultMarkupPercentage,
        terms,
        notes,
        customerNotes,
        requiresApproval,
        items // If provided, replace all items
      } = req.body;

      // Update quote
      await client.query(`
        UPDATE quotes SET
          customer_id = COALESCE($1, customer_id),
          customer_name = COALESCE($2, customer_name),
          customer_email = COALESCE($3, customer_email),
          customer_phone = COALESCE($4, customer_phone),
          customer_address = COALESCE($5, customer_address),
          job_id = $6,
          title = COALESCE($7, title),
          description = $8,
          valid_from = COALESCE($9, valid_from),
          valid_until = $10,
          discount_type = COALESCE($11, discount_type),
          discount_value = COALESCE($12, discount_value),
          tax_rate = COALESCE($13, tax_rate),
          default_markup_percentage = COALESCE($14, default_markup_percentage),
          terms = $15,
          notes = $16,
          customer_notes = $17,
          requires_approval = COALESCE($18, requires_approval)
        WHERE id = $19 AND user_id = $20
      `, [
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        jobId,
        title,
        description,
        validFrom,
        validUntil,
        discountType,
        discountValue,
        taxRate,
        defaultMarkupPercentage,
        terms,
        notes,
        customerNotes,
        requiresApproval,
        id,
        userId
      ]);

      // If items provided, replace them
      if (items !== undefined) {
        // Delete existing items
        await client.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

        // Add new items
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);
            const profitMargin = lineTotal - ((item.quantity || 1) * (item.unitCost || 0));

            await client.query(`
              INSERT INTO quote_items (
                quote_id, item_type, inventory_item_id, item_name, item_description,
                item_code, quantity, unit, unit_cost, markup_percentage,
                unit_price, line_total, profit_margin, sort_order, group_name
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `, [
              id,
              item.itemType || 'material',
              item.inventoryItemId || null,
              item.itemName,
              item.itemDescription || null,
              item.itemCode || null,
              item.quantity || 1,
              item.unit || 'EA',
              item.unitCost || 0,
              item.markupPercentage || 0,
              item.unitPrice || 0,
              lineTotal,
              profitMargin,
              item.sortOrder || i,
              item.groupName || null
            ]);
          }
        }
      }

      // Log update
      await client.query(`
        INSERT INTO quote_history (quote_id, user_id, action, notes)
        VALUES ($1, $2, 'updated', 'Quote updated')
      `, [id, userId]);

      await client.query('COMMIT');

      // Fetch updated quote
      const result = await client.query(`
        SELECT q.*, c.name as customer_display_name
        FROM quotes q
        LEFT JOIN contacts c ON q.customer_id = c.id
        WHERE q.id = $1
      `, [id]);

      res.json(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating quote:', error);
      res.status(500).json({ error: 'Failed to update quote' });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/quotes/:id/send
 * Mark quote as sent to customer
 */
router.post('/:id/send', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;

    const result = await client.query(`
      UPDATE quotes
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot send quote - must be in draft status' });
    }

    // Log action
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, old_status, new_status, notes, total_at_action)
      VALUES ($1, $2, 'sent', 'draft', 'sent', 'Quote sent to customer', $3)
    `, [id, userId, result.rows[0].total]);

    await client.query('COMMIT');

    res.json({ message: 'Quote sent successfully', quote: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending quote:', error);
    res.status(500).json({ error: 'Failed to send quote' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/quotes/:id/approve
 * Approve a quote (customer approval or internal approval)
 */
router.post('/:id/approve', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const { notes } = req.body;

    const result = await client.query(`
      UPDATE quotes
      SET status = 'approved',
          approved_by = $3,
          approved_at = CURRENT_TIMESTAMP,
          responded_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status IN ('sent', 'viewed')
      RETURNING *
    `, [id, userId, userId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot approve quote' });
    }

    // Log action
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, old_status, new_status, notes, total_at_action)
      VALUES ($1, $2, 'approved', 'sent', 'approved', $3, $4)
    `, [id, userId, notes || 'Quote approved', result.rows[0].total]);

    await client.query('COMMIT');

    res.json({ message: 'Quote approved successfully', quote: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving quote:', error);
    res.status(500).json({ error: 'Failed to approve quote' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/quotes/:id/reject
 * Reject a quote
 */
router.post('/:id/reject', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await client.query(`
      UPDATE quotes
      SET status = 'rejected',
          rejection_reason = $3,
          responded_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status IN ('sent', 'viewed')
      RETURNING *
    `, [id, userId, reason || null]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot reject quote' });
    }

    // Log action
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, old_status, new_status, notes, total_at_action)
      VALUES ($1, $2, 'rejected', 'sent', 'rejected', $3, $4)
    `, [id, userId, reason || 'Quote rejected', result.rows[0].total]);

    await client.query('COMMIT');

    res.json({ message: 'Quote rejected', quote: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting quote:', error);
    res.status(500).json({ error: 'Failed to reject quote' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/quotes/:id/duplicate
 * Create a copy of a quote
 */
router.post('/:id/duplicate', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;

    // Get original quote
    const originalResult = await client.query(
      'SELECT * FROM quotes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    const original = originalResult.rows[0];

    // Generate new quote number
    const quoteNumberResult = await client.query(
      'SELECT generate_quote_number($1) as quote_number',
      [userId]
    );
    const quoteNumber = quoteNumberResult.rows[0].quote_number;

    // Create new quote
    const newQuoteResult = await client.query(`
      INSERT INTO quotes (
        user_id, quote_number, customer_id, customer_name, customer_email,
        customer_phone, customer_address, job_id, title, description,
        valid_from, valid_until, discount_type, discount_value, tax_rate,
        default_markup_percentage, terms, notes, customer_notes,
        requires_approval, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      userId,
      quoteNumber,
      original.customer_id,
      original.customer_name,
      original.customer_email,
      original.customer_phone,
      original.customer_address,
      original.job_id,
      original.title + ' (Copy)',
      original.description,
      new Date().toISOString().split('T')[0],
      original.valid_until,
      original.discount_type,
      original.discount_value,
      original.tax_rate,
      original.default_markup_percentage,
      original.terms,
      original.notes,
      original.customer_notes,
      original.requires_approval,
      userId
    ]);

    const newQuote = newQuoteResult.rows[0];

    // Copy items
    await client.query(`
      INSERT INTO quote_items (
        quote_id, item_type, inventory_item_id, item_name, item_description,
        item_code, quantity, unit, unit_cost, markup_percentage,
        unit_price, line_total, profit_margin, sort_order, group_name
      )
      SELECT
        $1, item_type, inventory_item_id, item_name, item_description,
        item_code, quantity, unit, unit_cost, markup_percentage,
        unit_price, line_total, profit_margin, sort_order, group_name
      FROM quote_items
      WHERE quote_id = $2
    `, [newQuote.id, id]);

    // Log creation
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, new_status, notes)
      VALUES ($1, $2, 'created', 'draft', $3)
    `, [newQuote.id, userId, `Duplicated from ${original.quote_number}`]);

    await client.query('COMMIT');

    res.status(201).json({ message: 'Quote duplicated', quoteId: newQuote.id, quoteNumber });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error duplicating quote:', error);
    res.status(500).json({ error: 'Failed to duplicate quote' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/quotes/:id/revise
 * Create a new version of a quote
 */
router.post('/:id/revise', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id } = req.params;

    // Get original quote
    const originalResult = await client.query(
      'SELECT * FROM quotes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    const original = originalResult.rows[0];
    const newVersion = original.version + 1;

    // Create revised quote with same quote number but incremented version
    const newQuoteResult = await client.query(`
      INSERT INTO quotes (
        user_id, quote_number, customer_id, customer_name, customer_email,
        customer_phone, customer_address, job_id, title, description,
        valid_from, valid_until, discount_type, discount_value, tax_rate,
        default_markup_percentage, terms, notes, customer_notes,
        requires_approval, version, parent_quote_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      userId,
      original.quote_number,
      original.customer_id,
      original.customer_name,
      original.customer_email,
      original.customer_phone,
      original.customer_address,
      original.job_id,
      original.title,
      original.description,
      new Date().toISOString().split('T')[0],
      original.valid_until,
      original.discount_type,
      original.discount_value,
      original.tax_rate,
      original.default_markup_percentage,
      original.terms,
      original.notes,
      original.customer_notes,
      original.requires_approval,
      newVersion,
      id,
      userId
    ]);

    const newQuote = newQuoteResult.rows[0];

    // Copy items
    await client.query(`
      INSERT INTO quote_items (
        quote_id, item_type, inventory_item_id, item_name, item_description,
        item_code, quantity, unit, unit_cost, markup_percentage,
        unit_price, line_total, profit_margin, sort_order, group_name
      )
      SELECT
        $1, item_type, inventory_item_id, item_name, item_description,
        item_code, quantity, unit, unit_cost, markup_percentage,
        unit_price, line_total, profit_margin, sort_order, group_name
      FROM quote_items
      WHERE quote_id = $2
    `, [newQuote.id, id]);

    // Log revision
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, new_status, notes)
      VALUES ($1, $2, 'created', 'draft', $3)
    `, [newQuote.id, userId, `Revision ${newVersion} created`]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Quote revision created',
      quoteId: newQuote.id,
      version: newVersion
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quote revision:', error);
    res.status(500).json({ error: 'Failed to create revision' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/quotes/:id
 * Delete a quote (only drafts)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM quotes
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING *
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Can only delete draft quotes' });
    }

    res.json({ message: 'Quote deleted' });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

/**
 * POST /api/quotes/:id/items
 * Add an item to a quote
 */
router.post('/:id/items',
  [
    body('itemName').notEmpty().trim().withMessage('Item name is required'),
    validate
  ],
  async (req, res) => {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const userId = req.user.userId;
      const { id } = req.params;

      // Verify quote exists and is editable
      const quoteCheck = await client.query(
        'SELECT status FROM quotes WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (quoteCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Quote not found' });
      }

      if (!['draft', 'sent'].includes(quoteCheck.rows[0].status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot modify quote in current status' });
      }

      const {
        itemType,
        inventoryItemId,
        itemName,
        itemDescription,
        itemCode,
        quantity,
        unit,
        unitCost,
        markupPercentage,
        unitPrice,
        sortOrder,
        groupName
      } = req.body;

      const lineTotal = (quantity || 1) * (unitPrice || 0);
      const profitMargin = lineTotal - ((quantity || 1) * (unitCost || 0));

      const result = await client.query(`
        INSERT INTO quote_items (
          quote_id, item_type, inventory_item_id, item_name, item_description,
          item_code, quantity, unit, unit_cost, markup_percentage,
          unit_price, line_total, profit_margin, sort_order, group_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        id,
        itemType || 'material',
        inventoryItemId || null,
        itemName,
        itemDescription || null,
        itemCode || null,
        quantity || 1,
        unit || 'EA',
        unitCost || 0,
        markupPercentage || 0,
        unitPrice || 0,
        lineTotal,
        profitMargin,
        sortOrder || 0,
        groupName || null
      ]);

      await client.query('COMMIT');

      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding quote item:', error);
      res.status(500).json({ error: 'Failed to add item' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/quotes/:id/items/:itemId
 * Update a quote item
 */
router.put('/:id/items/:itemId', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id, itemId } = req.params;

    // Verify quote exists and is editable
    const quoteCheck = await client.query(
      'SELECT status FROM quotes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (quoteCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (!['draft', 'sent'].includes(quoteCheck.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot modify quote in current status' });
    }

    const {
      itemType,
      inventoryItemId,
      itemName,
      itemDescription,
      itemCode,
      quantity,
      unit,
      unitCost,
      markupPercentage,
      unitPrice,
      sortOrder,
      groupName
    } = req.body;

    const lineTotal = (quantity || 1) * (unitPrice || 0);
    const profitMargin = lineTotal - ((quantity || 1) * (unitCost || 0));

    const result = await client.query(`
      UPDATE quote_items SET
        item_type = COALESCE($1, item_type),
        inventory_item_id = $2,
        item_name = COALESCE($3, item_name),
        item_description = $4,
        item_code = $5,
        quantity = COALESCE($6, quantity),
        unit = COALESCE($7, unit),
        unit_cost = COALESCE($8, unit_cost),
        markup_percentage = COALESCE($9, markup_percentage),
        unit_price = COALESCE($10, unit_price),
        line_total = $11,
        profit_margin = $12,
        sort_order = COALESCE($13, sort_order),
        group_name = $14
      WHERE id = $15 AND quote_id = $16
      RETURNING *
    `, [
      itemType,
      inventoryItemId,
      itemName,
      itemDescription,
      itemCode,
      quantity,
      unit,
      unitCost,
      markupPercentage,
      unitPrice,
      lineTotal,
      profitMargin,
      sortOrder,
      groupName,
      itemId,
      id
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    await client.query('COMMIT');

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quote item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/quotes/:id/items/:itemId
 * Remove an item from a quote
 */
router.delete('/:id/items/:itemId', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { id, itemId } = req.params;

    // Verify quote exists and is editable
    const quoteCheck = await client.query(
      'SELECT status FROM quotes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (quoteCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (!['draft', 'sent'].includes(quoteCheck.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot modify quote in current status' });
    }

    const result = await client.query(
      'DELETE FROM quote_items WHERE id = $1 AND quote_id = $2 RETURNING *',
      [itemId, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Item removed' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing quote item:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/quotes/templates
 * Get all quote templates
 */
router.get('/templates/list', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(`
      SELECT qt.*,
             (SELECT COUNT(*) FROM quote_template_items WHERE template_id = qt.id) as item_count
      FROM quote_templates qt
      WHERE qt.user_id = $1
      ORDER BY qt.name ASC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quote templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/quotes/from-job/:jobId
 * Create a quote from a job's allocated items
 */
router.post('/from-job/:jobId', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { jobId } = req.params;
    const { customerId, customerName, defaultMarkup } = req.body;

    // Get job with allocated items
    const jobResult = await client.query(`
      SELECT j.*,
             json_agg(
               json_build_object(
                 'itemId', jai.item_id,
                 'quantity', jai.quantity,
                 'itemName', i.name,
                 'buyPrice', COALESCE(i.buy_price_excl_gst, i.price, 0),
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
    const markup = defaultMarkup || 0;

    // Generate quote number
    const quoteNumberResult = await client.query(
      'SELECT generate_quote_number($1) as quote_number',
      [userId]
    );
    const quoteNumber = quoteNumberResult.rows[0].quote_number;

    // Create quote
    const quoteResult = await client.query(`
      INSERT INTO quotes (
        user_id, quote_number, customer_id, customer_name, job_id, title,
        description, default_markup_percentage, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      userId,
      quoteNumber,
      customerId || null,
      customerName || job.builder || 'Customer',
      jobId,
      `Quote for ${job.title}`,
      `Materials and labor for job: ${job.title}`,
      markup,
      userId
    ]);

    const quote = quoteResult.rows[0];

    // Add items from job
    if (job.allocated_items && job.allocated_items.length > 0) {
      for (let i = 0; i < job.allocated_items.length; i++) {
        const item = job.allocated_items[i];
        const unitCost = item.buyPrice || 0;
        const unitPrice = markup > 0 ? unitCost * (1 + markup / 100) : (item.sellPrice || unitCost);
        const lineTotal = item.quantity * unitPrice;
        const profitMargin = lineTotal - (item.quantity * unitCost);

        await client.query(`
          INSERT INTO quote_items (
            quote_id, item_type, inventory_item_id, item_name,
            quantity, unit, unit_cost, markup_percentage,
            unit_price, line_total, profit_margin, sort_order, group_name
          ) VALUES ($1, 'material', $2, $3, $4, 'EA', $5, $6, $7, $8, $9, $10, $11)
        `, [
          quote.id,
          item.itemId,
          item.itemName,
          item.quantity,
          unitCost,
          markup,
          unitPrice,
          lineTotal,
          profitMargin,
          i,
          item.category || 'Materials'
        ]);
      }
    }

    // Log creation
    await client.query(`
      INSERT INTO quote_history (quote_id, user_id, action, new_status, notes)
      VALUES ($1, $2, 'created', 'draft', $3)
    `, [quote.id, userId, `Created from job: ${job.title}`]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Quote created from job',
      quoteId: quote.id,
      quoteNumber
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quote from job:', error);
    res.status(500).json({ error: 'Failed to create quote from job' });
  } finally {
    client.release();
  }
});

export default router;
