import db from '../config/database.js';
import { generateCompletion, getProviderForFeature } from './aiProviders.js';

/**
 * Job Check-in with GPS tracking
 */
export const checkInToJob = async (userId, jobId, location) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check if job exists and is assigned to user
    const jobResult = await client.query(
      `SELECT j.*, jw.worker_id
       FROM jobs j
       LEFT JOIN job_workers jw ON j.id = jw.job_id AND jw.worker_id = $1
       WHERE j.id = $2 AND j.user_id = $3`,
      [userId, jobId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error('Job not found or not assigned to you');
    }

    // Check if already checked in
    const existingCheckIn = await client.query(
      `SELECT id FROM job_check_ins
       WHERE job_id = $1 AND user_id = $2 AND check_out_time IS NULL`,
      [jobId, userId]
    );

    if (existingCheckIn.rows.length > 0) {
      throw new Error('Already checked in to this job');
    }

    // Create check-in record
    const checkInResult = await client.query(
      `INSERT INTO job_check_ins
       (job_id, user_id, check_in_latitude, check_in_longitude, check_in_accuracy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [jobId, userId, location.latitude, location.longitude, location.accuracy]
    );

    // Update job status to 'in_progress' if not already
    await client.query(
      `UPDATE jobs SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'`,
      [jobId]
    );

    await client.query('COMMIT');

    return checkInResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Job Check-out with GPS tracking
 */
export const checkOutFromJob = async (userId, checkInId, location, notes) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Get check-in record
    const checkInResult = await client.query(
      `SELECT * FROM job_check_ins
       WHERE id = $1 AND user_id = $2 AND check_out_time IS NULL`,
      [checkInId, userId]
    );

    if (checkInResult.rows.length === 0) {
      throw new Error('Check-in not found or already checked out');
    }

    // Update check-out information
    const updateResult = await client.query(
      `UPDATE job_check_ins
       SET check_out_time = CURRENT_TIMESTAMP,
           check_out_latitude = $1,
           check_out_longitude = $2,
           check_out_accuracy = $3,
           notes = $4
       WHERE id = $5
       RETURNING *`,
      [location.latitude, location.longitude, location.accuracy, notes, checkInId]
    );

    // Calculate duration
    const checkIn = updateResult.rows[0];
    const duration = Math.round(
      (new Date(checkIn.check_out_time) - new Date(checkIn.check_in_time)) / 1000 / 60
    ); // minutes

    await client.query('COMMIT');

    return {
      ...checkIn,
      duration_minutes: duration
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get active check-in for user
 */
export const getActiveCheckIn = async (userId) => {
  const result = await db.query(
    `SELECT ci.*, j.name as job_name, j.status as job_status, j.job_address
     FROM job_check_ins ci
     JOIN jobs j ON ci.job_id = j.id
     WHERE ci.user_id = $1 AND ci.check_out_time IS NULL
     ORDER BY ci.check_in_time DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

/**
 * Upload job photo
 */
export const uploadJobPhoto = async (userId, jobId, photoData) => {
  const { photoType, fileData, fileName, mimeType, caption, location, checkInId } = photoData;

  // In production, upload to S3/Cloud Storage
  // For now, we'll store the path and metadata
  const filePath = `/uploads/jobs/${jobId}/${Date.now()}_${fileName}`;

  const result = await db.query(
    `INSERT INTO job_photos
     (job_id, user_id, check_in_id, photo_type, file_path, file_name, mime_type,
      caption, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      jobId,
      userId,
      checkInId || null,
      photoType,
      filePath,
      fileName,
      mimeType,
      caption || null,
      location?.latitude || null,
      location?.longitude || null
    ]
  );

  return result.rows[0];
};

/**
 * Get job photos
 */
export const getJobPhotos = async (jobId, userId) => {
  const result = await db.query(
    `SELECT jp.*, u.name as uploader_name
     FROM job_photos jp
     JOIN users u ON jp.user_id = u.id
     WHERE jp.job_id = $1 AND jp.user_id = $2
     ORDER BY jp.taken_at DESC`,
    [jobId, userId]
  );

  return result.rows;
};

/**
 * Save digital signature
 */
export const saveSignature = async (userId, jobId, signatureData) => {
  const {
    signatureType,
    signatureDataUrl,
    signerName,
    signerEmail,
    signerPhone,
    checkInId,
    ipAddress,
    userAgent
  } = signatureData;

  const result = await db.query(
    `INSERT INTO job_signatures
     (job_id, user_id, check_in_id, signature_type, signature_data, signer_name,
      signer_email, signer_phone, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      jobId,
      userId,
      checkInId || null,
      signatureType,
      signatureDataUrl,
      signerName,
      signerEmail || null,
      signerPhone || null,
      ipAddress || null,
      userAgent || null
    ]
  );

  // If customer signature, mark job as completed
  if (signatureType === 'customer') {
    await db.query(
      `UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );
  }

  return result.rows[0];
};

/**
 * Get job signatures
 */
export const getJobSignatures = async (jobId, userId) => {
  const result = await db.query(
    `SELECT * FROM job_signatures
     WHERE job_id = $1 AND user_id = $2
     ORDER BY signed_at DESC`,
    [jobId, userId]
  );

  return result.rows;
};

/**
 * Add field note
 */
export const addFieldNote = async (userId, jobId, noteData) => {
  const { noteType, content, audioFilePath, audioDuration, isImportant, location, checkInId } =
    noteData;

  const result = await db.query(
    `INSERT INTO job_field_notes
     (job_id, user_id, check_in_id, note_type, content, audio_file_path,
      audio_duration, is_important, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      jobId,
      userId,
      checkInId || null,
      noteType,
      content,
      audioFilePath || null,
      audioDuration || null,
      isImportant || false,
      location?.latitude || null,
      location?.longitude || null
    ]
  );

  return result.rows[0];
};

/**
 * Get field notes
 */
export const getFieldNotes = async (jobId, userId) => {
  const result = await db.query(
    `SELECT jfn.*, u.name as author_name
     FROM job_field_notes jfn
     JOIN users u ON jfn.user_id = u.id
     WHERE jfn.job_id = $1 AND jfn.user_id = $2
     ORDER BY jfn.created_at DESC`,
    [jobId, userId]
  );

  return result.rows;
};

/**
 * Process barcode scan
 */
export const processBarcodeS can = async (userId, scanData) => {
  const { barcodeValue, barcodeType, scanType, quantity, location, jobId } = scanData;

  // Look up item by barcode
  const itemResult = await db.query(
    `SELECT * FROM inventory_items WHERE barcode = $1 AND user_id = $2`,
    [barcodeValue, userId]
  );

  const item = itemResult.rows[0] || null;

  // Record scan
  const scanResult = await db.query(
    `INSERT INTO barcode_scans
     (user_id, item_id, job_id, barcode_value, barcode_type, scan_type, quantity,
      latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      item?.id || null,
      jobId || null,
      barcodeValue,
      barcodeType || 'unknown',
      scanType,
      quantity || 1,
      location?.latitude || null,
      location?.longitude || null
    ]
  );

  return {
    scan: scanResult.rows[0],
    item: item,
    found: !!item
  };
};

/**
 * Quick stock check (mobile optimized)
 */
export const quickStockCheck = async (userId, searchTerm) => {
  const result = await db.query(
    `SELECT id, name, category, quantity, reorder_level, price, location, barcode
     FROM inventory_items
     WHERE user_id = $1
     AND (
       name ILIKE $2 OR
       category ILIKE $2 OR
       barcode = $3 OR
       description ILIKE $2
     )
     ORDER BY name
     LIMIT 20`,
    [userId, `%${searchTerm}%`, searchTerm]
  );

  return result.rows;
};

/**
 * Get nearby jobs (for field workers)
 */
export const getNearbyJobs = async (userId, location, radiusKm = 50) => {
  // Using Haversine formula to find nearby jobs
  const result = await db.query(
    `SELECT
       j.*,
       (
         6371 * acos(
           cos(radians($2)) * cos(radians(j.job_latitude)) *
           cos(radians(j.job_longitude) - radians($3)) +
           sin(radians($2)) * sin(radians(j.job_latitude))
         )
       ) AS distance_km
     FROM jobs j
     LEFT JOIN job_workers jw ON j.id = jw.job_id
     WHERE j.user_id = $1
     AND j.job_latitude IS NOT NULL
     AND j.job_longitude IS NOT NULL
     AND (jw.worker_id = $1 OR j.user_id = $1)
     AND j.status IN ('pending', 'in_progress')
     HAVING distance_km <= $4
     ORDER BY distance_km
     LIMIT 20`,
    [userId, location.latitude, location.longitude, radiusKm]
  );

  return result.rows;
};

/**
 * Record GPS breadcrumb
 */
export const recordGPSBreadcrumb = async (userId, locationData) => {
  const { latitude, longitude, accuracy, altitude, speed, heading, batteryLevel, jobId, checkInId } =
    locationData;

  await db.query(
    `INSERT INTO gps_breadcrumbs
     (user_id, job_id, check_in_id, latitude, longitude, accuracy, altitude,
      speed, heading, battery_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      userId,
      jobId || null,
      checkInId || null,
      latitude,
      longitude,
      accuracy || null,
      altitude || null,
      speed || null,
      heading || null,
      batteryLevel || null
    ]
  );

  return { success: true };
};

/**
 * Get job route/breadcrumbs
 */
export const getJobRoute = async (checkInId, userId) => {
  const result = await db.query(
    `SELECT latitude, longitude, accuracy, speed, heading, recorded_at
     FROM gps_breadcrumbs
     WHERE check_in_id = $1 AND user_id = $2
     ORDER BY recorded_at ASC`,
    [checkInId, userId]
  );

  return result.rows;
};

/**
 * Voice-to-text transcription with AI
 */
export const transcribeVoiceNote = async (audioFilePath) => {
  // In production, use speech-to-text API (Google Speech-to-Text, Whisper, etc.)
  // For now, return placeholder
  return {
    transcription: '[Voice note transcription would appear here]',
    confidence: 0.95,
    duration: 30
  };
};

/**
 * AI-powered job completion check
 */
export const checkJobCompletion = async (jobId, userId) => {
  try {
    // Get job details
    const jobResult = await db.query(
      `SELECT j.*,
       (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id AND photo_type = 'before') as before_photos,
       (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id AND photo_type = 'after') as after_photos,
       (SELECT COUNT(*) FROM job_signatures WHERE job_id = j.id AND signature_type = 'customer') as customer_signatures,
       (SELECT COUNT(*) FROM job_field_notes WHERE job_id = j.id) as field_notes
       FROM jobs j
       WHERE j.id = $1 AND j.user_id = $2`,
      [jobId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobResult.rows[0];

    // Get allocated vs picked items
    const itemsResult = await db.query(
      `SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE picked = TRUE) as picked_items
       FROM job_allocated_items
       WHERE job_id = $1`,
      [jobId]
    );

    const items = itemsResult.rows[0];

    const prompt = `You are a job completion verification assistant. Analyze this job and determine if it's ready for completion:

Job Details:
- Name: ${job.name}
- Status: ${job.status}
- Before Photos: ${job.before_photos}
- After Photos: ${job.after_photos}
- Customer Signatures: ${job.customer_signatures}
- Field Notes: ${job.field_notes}
- Items Allocated: ${items.total_items}
- Items Picked: ${items.picked_items}

Standard Requirements:
1. At least 1 before photo
2. At least 1 after photo
3. Customer signature
4. All allocated items picked
5. At least 1 field note or completion comment

Respond in JSON format:
{
  "isComplete": true/false,
  "completionPercentage": number (0-100),
  "missingItems": [
    "Missing requirement 1",
    "Missing requirement 2"
  ],
  "recommendations": [
    "Action to take 1",
    "Action to take 2"
  ],
  "canSubmit": true/false,
  "summary": "Overall status summary"
}`;

    // Use configured provider for job completion check
    const provider = getProviderForFeature('job_completion');
    const analysis = await generateCompletion(prompt, provider, { format: 'json' });

    return analysis;
  } catch (error) {
    console.error('Job completion check error:', error);
    // Fallback to simple checks
    return {
      isComplete: false,
      completionPercentage: 50,
      missingItems: ['Unable to perform AI analysis'],
      recommendations: ['Ensure all requirements are met'],
      canSubmit: false,
      summary: 'Manual verification required'
    };
  }
};

/**
 * Register mobile device for push notifications
 */
export const registerDevice = async (userId, deviceData) => {
  const { deviceToken, deviceType, deviceName, osVersion, appVersion } = deviceData;

  const result = await db.query(
    `INSERT INTO mobile_devices
     (user_id, device_token, device_type, device_name, os_version, app_version)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, device_token)
     DO UPDATE SET
       device_type = EXCLUDED.device_type,
       device_name = EXCLUDED.device_name,
       os_version = EXCLUDED.os_version,
       app_version = EXCLUDED.app_version,
       is_active = TRUE,
       last_active = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, deviceToken, deviceType, deviceName || null, osVersion || null, appVersion || null]
  );

  return result.rows[0];
};

/**
 * Sync offline queue
 */
export const syncOfflineQueue = async (userId, queueItems) => {
  const results = [];

  for (const item of queueItems) {
    try {
      // Process each queued action
      let result;

      switch (item.entityType) {
        case 'stock_movement':
          // Process stock movement
          result = await processOfflineStockMovement(userId, item.data);
          break;
        case 'field_note':
          // Process field note
          result = await addFieldNote(userId, item.data.jobId, item.data);
          break;
        case 'photo':
          // Process photo upload
          result = await uploadJobPhoto(userId, item.data.jobId, item.data);
          break;
        default:
          throw new Error(`Unknown entity type: ${item.entityType}`);
      }

      results.push({
        localId: item.localId,
        success: true,
        serverId: result.id
      });
    } catch (error) {
      results.push({
        localId: item.localId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
};

const processOfflineStockMovement = async (userId, data) => {
  // Implement offline stock movement processing
  const { itemId, quantity, type, notes, jobId } = data;

  const result = await db.query(
    `INSERT INTO stock_movements (user_id, item_id, quantity, type, notes, job_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     RETURNING *`,
    [userId, itemId, quantity, type, notes || null, jobId || null]
  );

  // Update inventory quantity
  const multiplier = type === 'In' ? 1 : -1;
  await db.query(
    `UPDATE inventory_items
     SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3`,
    [quantity * multiplier, itemId, userId]
  );

  return result.rows[0];
};
