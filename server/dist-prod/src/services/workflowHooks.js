/**
 * Workflow Hooks Service
 * Provides middleware and utilities to automatically trigger workflows
 */

import { triggerStockWorkflows, triggerJobWorkflows, autoAssignJob } from './automationIntegration.js';
import db from '../config/database.js';

/**
 * Middleware to intercept inventory item updates and trigger stock workflows
 */
export const stockUpdateHook = async (req, res, next) => {
  // Store original send function
  const originalSend = res.send;

  // Override send to intercept successful responses
  res.send = function (data) {
    // Restore original send
    res.send = originalSend;

    // If this was a successful update, trigger workflows
    if (res.statusCode === 200 || res.statusCode === 201) {
      // Parse the response data
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;

      // Trigger workflows asynchronously (don't block response)
      if (responseData && responseData.id) {
        const itemId = responseData.id;
        const userId = req.user?.userId;

        if (userId && itemId) {
          // Get old and new quantities to trigger workflows
          getItemQuantities(itemId, req.body.quantity)
            .then(({ oldQuantity, newQuantity }) => {
              if (oldQuantity !== newQuantity) {
                triggerStockWorkflows(userId, itemId, newQuantity, oldQuantity);
              }
            })
            .catch(err => console.error('Stock workflow trigger error:', err));
        }
      }
    }

    // Send the response
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to intercept job status updates and trigger job workflows
 */
export const jobUpdateHook = async (req, res, next) => {
  // Store original job data before update
  if (req.params.id && req.body.status) {
    try {
      const result = await db.query(
        'SELECT status FROM jobs WHERE id = $1',
        [req.params.id]
      );

      if (result.rows.length > 0) {
        req._oldJobStatus = result.rows[0].status;
      }
    } catch (error) {
      console.error('Failed to get old job status:', error);
    }
  }

  // Store original send function
  const originalSend = res.send;

  // Override send to intercept successful responses
  res.send = function (data) {
    // Restore original send
    res.send = originalSend;

    // If this was a successful update and status changed, trigger workflows
    if ((res.statusCode === 200 || res.statusCode === 201) && req.body.status) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;

      if (responseData && responseData.id) {
        const jobId = responseData.id;
        const userId = req.user?.userId;
        const newStatus = req.body.status;
        const oldStatus = req._oldJobStatus;

        if (userId && jobId && oldStatus !== newStatus) {
          // Trigger job workflows asynchronously
          triggerJobWorkflows(userId, jobId, newStatus, oldStatus)
            .catch(err => console.error('Job workflow trigger error:', err));
        }
      }
    }

    // Send the response
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to auto-assign jobs when they're created or reach pending status
 */
export const jobAutoAssignHook = async (req, res, next) => {
  // Store original send function
  const originalSend = res.send;

  // Override send to intercept successful responses
  res.send = function (data) {
    // Restore original send
    res.send = originalSend;

    // If this was a successful job creation, check for auto-assignment
    if (res.statusCode === 201 || res.statusCode === 200) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;

      if (responseData && responseData.id && responseData.status === 'pending') {
        const jobId = responseData.id;
        const userId = req.user?.userId;

        if (userId && jobId) {
          // Try auto-assignment asynchronously
          autoAssignJob(userId, jobId)
            .catch(err => console.error('Job auto-assign error:', err));
        }
      }
    }

    // Send the response
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Helper function to get item quantities
 */
async function getItemQuantities(itemId, newQuantity) {
  try {
    const result = await db.query(
      'SELECT quantity FROM inventory_items WHERE id = $1',
      [itemId]
    );

    const oldQuantity = result.rows[0]?.quantity || 0;
    const actualNewQuantity = newQuantity !== undefined ? newQuantity : oldQuantity;

    return { oldQuantity, newQuantity: actualNewQuantity };
  } catch (error) {
    console.error('Failed to get item quantities:', error);
    return { oldQuantity: 0, newQuantity: 0 };
  }
}

export default {
  stockUpdateHook,
  jobUpdateHook,
  jobAutoAssignHook
};
