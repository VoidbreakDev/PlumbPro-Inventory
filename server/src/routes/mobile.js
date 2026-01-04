import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import {
  checkInToJob,
  checkOutFromJob,
  getActiveCheckIn,
  uploadJobPhoto,
  getJobPhotos,
  saveSignature,
  getJobSignatures,
  addFieldNote,
  getFieldNotes,
  processBarcodeScan,
  quickStockCheck,
  getNearbyJobs,
  recordGPSBreadcrumb,
  getJobRoute,
  checkJobCompletion,
  registerDevice,
  syncOfflineQueue
} from '../services/mobileFieldService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp3|wav|m4a/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

/**
 * POST /api/mobile/check-in
 * Check in to a job with GPS location
 */
router.post('/check-in', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId, location } = req.body;

    if (!jobId || !location) {
      return res.status(400).json({ error: 'Job ID and location are required' });
    }

    const checkIn = await checkInToJob(userId, jobId, location);

    res.json(checkIn);
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/check-out
 * Check out from a job
 */
router.post('/check-out', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { checkInId, location, notes } = req.body;

    if (!checkInId || !location) {
      return res.status(400).json({ error: 'Check-in ID and location are required' });
    }

    const checkOut = await checkOutFromJob(userId, checkInId, location, notes);

    res.json(checkOut);
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/active-check-in
 * Get current active check-in for user
 */
router.get('/active-check-in', async (req, res) => {
  try {
    const userId = req.user.userId;
    const activeCheckIn = await getActiveCheckIn(userId);

    res.json(activeCheckIn || { active: false });
  } catch (error) {
    console.error('Active check-in error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/photos
 * Upload job photo
 */
router.post('/photos', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId, photoType, caption, latitude, longitude, checkInId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    const photoData = {
      photoType: photoType || 'during',
      fileData: req.file.path,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      caption,
      location: latitude && longitude ? { latitude, longitude } : null,
      checkInId
    };

    const photo = await uploadJobPhoto(userId, jobId, photoData);

    res.json(photo);
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/photos/:jobId
 * Get all photos for a job
 */
router.get('/photos/:jobId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId } = req.params;

    const photos = await getJobPhotos(jobId, userId);

    res.json(photos);
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/signatures
 * Save digital signature
 */
router.post('/signatures', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId, ...signatureData } = req.body;

    if (!jobId || !signatureData.signatureDataUrl || !signatureData.signerName) {
      return res.status(400).json({
        error: 'Job ID, signature data, and signer name are required'
      });
    }

    const signature = await saveSignature(userId, jobId, signatureData);

    res.json(signature);
  } catch (error) {
    console.error('Signature save error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/signatures/:jobId
 * Get signatures for a job
 */
router.get('/signatures/:jobId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId } = req.params;

    const signatures = await getJobSignatures(jobId, userId);

    res.json(signatures);
  } catch (error) {
    console.error('Get signatures error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/field-notes
 * Add field note
 */
router.post('/field-notes', upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId, noteType, content, isImportant, latitude, longitude, checkInId } = req.body;

    const noteData = {
      noteType: noteType || 'text',
      content,
      audioFilePath: req.file?.path || null,
      audioDuration: req.body.audioDuration || null,
      isImportant: isImportant === 'true' || isImportant === true,
      location: latitude && longitude ? { latitude, longitude } : null,
      checkInId
    };

    const note = await addFieldNote(userId, jobId, noteData);

    res.json(note);
  } catch (error) {
    console.error('Field note error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/field-notes/:jobId
 * Get field notes for a job
 */
router.get('/field-notes/:jobId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId } = req.params;

    const notes = await getFieldNotes(jobId, userId);

    res.json(notes);
  } catch (error) {
    console.error('Get field notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/barcode-scan
 * Process barcode scan
 */
router.post('/barcode-scan', async (req, res) => {
  try {
    const userId = req.user.userId;
    const scanData = req.body;

    const result = await processBarcodeScan(userId, scanData);

    res.json(result);
  } catch (error) {
    console.error('Barcode scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/quick-stock-check
 * Quick stock lookup (mobile optimized)
 */
router.get('/quick-stock-check', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const items = await quickStockCheck(userId, search);

    res.json(items);
  } catch (error) {
    console.error('Quick stock check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/nearby-jobs
 * Get nearby jobs based on location
 */
router.post('/nearby-jobs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { location, radiusKm } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const jobs = await getNearbyJobs(userId, location, radiusKm);

    res.json(jobs);
  } catch (error) {
    console.error('Nearby jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/gps-breadcrumb
 * Record GPS location breadcrumb
 */
router.post('/gps-breadcrumb', async (req, res) => {
  try {
    const userId = req.user.userId;
    const locationData = req.body;

    const result = await recordGPSBreadcrumb(userId, locationData);

    res.json(result);
  } catch (error) {
    console.error('GPS breadcrumb error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/job-route/:checkInId
 * Get GPS route/breadcrumbs for a check-in
 */
router.get('/job-route/:checkInId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { checkInId } = req.params;

    const route = await getJobRoute(checkInId, userId);

    res.json(route);
  } catch (error) {
    console.error('Job route error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mobile/job-completion-check/:jobId
 * Check if job is ready for completion (AI-powered)
 */
router.get('/job-completion-check/:jobId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jobId } = req.params;

    const analysis = await checkJobCompletion(jobId, userId);

    res.json(analysis);
  } catch (error) {
    console.error('Job completion check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/register-device
 * Register mobile device for push notifications
 */
router.post('/register-device', async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceData = req.body;

    const device = await registerDevice(userId, deviceData);

    res.json(device);
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mobile/sync-offline
 * Sync offline queue
 */
router.post('/sync-offline', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { queueItems } = req.body;

    if (!Array.isArray(queueItems)) {
      return res.status(400).json({ error: 'Queue items must be an array' });
    }

    const results = await syncOfflineQueue(userId, queueItems);

    res.json({ results });
  } catch (error) {
    console.error('Offline sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
