/**
 * Supplier Ratings Routes
 * API endpoints for rating and reviewing suppliers
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/suppliers/:supplierId/ratings
 * Get all ratings for a specific supplier
 */
router.get('/:supplierId/ratings', [
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Verify supplier exists and belongs to user
    const supplierCheck = await client.query(
      "SELECT id, name, average_rating, total_ratings FROM contacts WHERE id = $1 AND user_id = $2 AND type = 'Supplier'",
      [supplierId, req.user.userId]
    );

    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = supplierCheck.rows[0];

    // Get ratings
    const ratingsResult = await client.query(`
      SELECT
        r.id,
        r.supplier_id as "supplierId",
        r.purchase_order_id as "purchaseOrderId",
        po.po_number as "poNumber",
        r.overall_rating as "overallRating",
        r.quality_rating as "qualityRating",
        r.delivery_rating as "deliveryRating",
        r.communication_rating as "communicationRating",
        r.pricing_rating as "pricingRating",
        r.review_title as "reviewTitle",
        r.review_text as "reviewText",
        r.would_recommend as "wouldRecommend",
        r.created_at as "createdAt",
        r.updated_at as "updatedAt"
      FROM supplier_ratings r
      LEFT JOIN purchase_orders po ON r.purchase_order_id = po.id
      WHERE r.supplier_id = $1 AND r.user_id = $2
      ORDER BY r.created_at DESC
      LIMIT $3 OFFSET $4
    `, [supplierId, req.user.userId, limit, offset]);

    // Get total count
    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM supplier_ratings WHERE supplier_id = $1 AND user_id = $2',
      [supplierId, req.user.userId]
    );

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        averageRating: supplier.average_rating,
        totalRatings: supplier.total_ratings
      },
      ratings: ratingsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Get supplier ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier ratings' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/supplier-ratings
 * Get all ratings (for admin/reporting)
 */
router.get('/', [
  query('supplierId').optional().isUUID(),
  query('minRating').optional().isInt({ min: 1, max: 5 }),
  query('wouldRecommend').optional().isBoolean(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId, minRating, wouldRecommend } = req.query;

    let whereConditions = ['r.user_id = $1'];
    const values = [req.user.userId];
    let paramIndex = 2;

    if (supplierId) {
      whereConditions.push(`r.supplier_id = $${paramIndex++}`);
      values.push(supplierId);
    }

    if (minRating) {
      whereConditions.push(`r.overall_rating >= $${paramIndex++}`);
      values.push(minRating);
    }

    if (wouldRecommend !== undefined) {
      whereConditions.push(`r.would_recommend = $${paramIndex++}`);
      values.push(wouldRecommend === 'true');
    }

    const result = await client.query(`
      SELECT
        r.id,
        r.supplier_id as "supplierId",
        c.name as "supplierName",
        r.overall_rating as "overallRating",
        r.would_recommend as "wouldRecommend",
        r.review_title as "reviewTitle",
        r.created_at as "createdAt"
      FROM supplier_ratings r
      JOIN contacts c ON r.supplier_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY r.created_at DESC
    `, values);

    res.json(result.rows);

  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/suppliers/:supplierId/ratings
 * Create a new rating for a supplier
 */
router.post('/:supplierId/ratings', [
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  body('purchaseOrderId').optional().isUUID(),
  body('overallRating').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be 1-5'),
  body('qualityRating').optional().isInt({ min: 1, max: 5 }).withMessage('Quality rating must be 1-5'),
  body('deliveryRating').optional().isInt({ min: 1, max: 5 }).withMessage('Delivery rating must be 1-5'),
  body('communicationRating').optional().isInt({ min: 1, max: 5 }).withMessage('Communication rating must be 1-5'),
  body('pricingRating').optional().isInt({ min: 1, max: 5 }).withMessage('Pricing rating must be 1-5'),
  body('reviewTitle').optional().trim().isLength({ max: 200 }),
  body('reviewText').optional().trim(),
  body('wouldRecommend').optional().isBoolean(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { supplierId } = req.params;
    const {
      purchaseOrderId,
      overallRating,
      qualityRating,
      deliveryRating,
      communicationRating,
      pricingRating,
      reviewTitle,
      reviewText,
      wouldRecommend
    } = req.body;

    // Verify supplier exists and belongs to user
    const supplierCheck = await client.query(
      "SELECT id FROM contacts WHERE id = $1 AND user_id = $2 AND type = 'Supplier'",
      [supplierId, req.user.userId]
    );

    if (supplierCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // If PO provided, verify it exists and belongs to user
    if (purchaseOrderId) {
      const poCheck = await client.query(
        'SELECT id, supplier_id FROM purchase_orders WHERE id = $1 AND user_id = $2',
        [purchaseOrderId, req.user.userId]
      );

      if (poCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      // Verify PO is for this supplier
      if (poCheck.rows[0].supplier_id !== supplierId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Purchase order is not for this supplier' });
      }

      // Check if rating already exists for this PO
      const existingRating = await client.query(
        'SELECT id FROM supplier_ratings WHERE purchase_order_id = $1',
        [purchaseOrderId]
      );

      if (existingRating.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Rating already exists for this purchase order' });
      }
    }

    // Create rating
    const result = await client.query(`
      INSERT INTO supplier_ratings (
        user_id, supplier_id, purchase_order_id,
        overall_rating, quality_rating, delivery_rating,
        communication_rating, pricing_rating,
        review_title, review_text, would_recommend
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.user.userId,
      supplierId,
      purchaseOrderId || null,
      overallRating,
      qualityRating || null,
      deliveryRating || null,
      communicationRating || null,
      pricingRating || null,
      reviewTitle || null,
      reviewText || null,
      wouldRecommend !== undefined ? wouldRecommend : null
    ]);

    await client.query('COMMIT');

    // Note: The trigger will automatically update the supplier's average rating

    res.status(201).json({
      message: 'Rating created successfully',
      rating: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create rating error:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Rating already exists for this purchase order' });
    }

    res.status(500).json({ error: 'Failed to create rating' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/supplier-ratings/:id
 * Update a rating
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid rating ID is required'),
  body('overallRating').optional().isInt({ min: 1, max: 5 }),
  body('qualityRating').optional().isInt({ min: 1, max: 5 }),
  body('deliveryRating').optional().isInt({ min: 1, max: 5 }),
  body('communicationRating').optional().isInt({ min: 1, max: 5 }),
  body('pricingRating').optional().isInt({ min: 1, max: 5 }),
  body('reviewTitle').optional().trim().isLength({ max: 200 }),
  body('reviewText').optional().trim(),
  body('wouldRecommend').optional().isBoolean(),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = {
      overallRating: 'overall_rating',
      qualityRating: 'quality_rating',
      deliveryRating: 'delivery_rating',
      communicationRating: 'communication_rating',
      pricingRating: 'pricing_rating',
      reviewTitle: 'review_title',
      reviewText: 'review_text',
      wouldRecommend: 'would_recommend'
    };

    Object.keys(req.body).forEach(key => {
      if (allowedFields[key]) {
        updates.push(`${allowedFields[key]} = $${paramIndex}`);
        values.push(req.body[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    values.push(req.user.userId);

    const result = await client.query(`
      UPDATE supplier_ratings
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rating not found' });
    }

    await client.query('COMMIT');

    res.json({
      message: 'Rating updated successfully',
      rating: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update rating error:', error);
    res.status(500).json({ error: 'Failed to update rating' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/supplier-ratings/:id
 * Delete a rating
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid rating ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM supplier_ratings WHERE id = $1 AND user_id = $2 RETURNING supplier_id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    // Note: The trigger will automatically update the supplier's average rating

    res.json({
      message: 'Rating deleted successfully',
      supplierId: result.rows[0].supplier_id
    });

  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/suppliers/:supplierId/rating-summary
 * Get rating statistics for a supplier
 */
router.get('/:supplierId/rating-summary', [
  param('supplierId').isUUID().withMessage('Valid supplier ID is required'),
  validate
], async (req, res) => {
  const client = await pool.connect();

  try {
    const { supplierId } = req.params;

    // Get supplier info
    const supplierResult = await client.query(
      "SELECT id, name, average_rating, total_ratings FROM contacts WHERE id = $1 AND user_id = $2 AND type = 'Supplier'",
      [supplierId, req.user.userId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = supplierResult.rows[0];

    // Get rating breakdown
    const breakdownResult = await client.query(`
      SELECT
        AVG(overall_rating)::DECIMAL(3,2) as "avgOverall",
        AVG(quality_rating)::DECIMAL(3,2) as "avgQuality",
        AVG(delivery_rating)::DECIMAL(3,2) as "avgDelivery",
        AVG(communication_rating)::DECIMAL(3,2) as "avgCommunication",
        AVG(pricing_rating)::DECIMAL(3,2) as "avgPricing",
        COUNT(*) FILTER (WHERE overall_rating = 5) as "fiveStars",
        COUNT(*) FILTER (WHERE overall_rating = 4) as "fourStars",
        COUNT(*) FILTER (WHERE overall_rating = 3) as "threeStars",
        COUNT(*) FILTER (WHERE overall_rating = 2) as "twoStars",
        COUNT(*) FILTER (WHERE overall_rating = 1) as "oneStar",
        COUNT(*) FILTER (WHERE would_recommend = true) as "wouldRecommend",
        COUNT(*) FILTER (WHERE would_recommend = false) as "wouldNotRecommend"
      FROM supplier_ratings
      WHERE supplier_id = $1 AND user_id = $2
    `, [supplierId, req.user.userId]);

    const breakdown = breakdownResult.rows[0];

    // Get recent ratings
    const recentResult = await client.query(`
      SELECT
        overall_rating as "overallRating",
        review_title as "reviewTitle",
        review_text as "reviewText",
        created_at as "createdAt"
      FROM supplier_ratings
      WHERE supplier_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 5
    `, [supplierId, req.user.userId]);

    res.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        averageRating: supplier.average_rating,
        totalRatings: supplier.total_ratings
      },
      breakdown: {
        averages: {
          overall: breakdown.avgOverall,
          quality: breakdown.avgQuality,
          delivery: breakdown.avgDelivery,
          communication: breakdown.avgCommunication,
          pricing: breakdown.avgPricing
        },
        distribution: {
          fiveStars: parseInt(breakdown.fiveStars),
          fourStars: parseInt(breakdown.fourStars),
          threeStars: parseInt(breakdown.threeStars),
          twoStars: parseInt(breakdown.twoStars),
          oneStar: parseInt(breakdown.oneStar)
        },
        recommendation: {
          wouldRecommend: parseInt(breakdown.wouldRecommend),
          wouldNotRecommend: parseInt(breakdown.wouldNotRecommend),
          recommendationRate: supplier.total_ratings > 0
            ? ((parseInt(breakdown.wouldRecommend) / supplier.total_ratings) * 100).toFixed(1)
            : null
        }
      },
      recentRatings: recentResult.rows
    });

  } catch (error) {
    console.error('Get rating summary error:', error);
    res.status(500).json({ error: 'Failed to fetch rating summary' });
  } finally {
    client.release();
  }
});

export default router;
