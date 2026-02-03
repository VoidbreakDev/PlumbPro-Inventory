import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
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

// SECURITY: Use absolute path for uploads directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types mapped to extensions (whitelist approach)
const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-m4a': ['.m4a'],
  'audio/mp4': ['.m4a']
};

// Configure multer for file uploads with security improvements
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // SECURITY: Use absolute path
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // SECURITY: Use crypto for better randomization
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    // Sanitize extension - only allow known extensions
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = Object.values(ALLOWED_FILE_TYPES).flat().includes(ext) ? ext : '';
    cb(null, `${file.fieldname}-${Date.now()}-${uniqueSuffix}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file per request
  },
  fileFilter: (req, file, cb) => {
    // SECURITY: Validate both MIME type and extension match
    const mimetype = file.mimetype.toLowerCase();
    const ext = path.extname(file.originalname).toLowerCase();

    // Check if MIME type is allowed
    const allowedExtensions = ALLOWED_FILE_TYPES[mimetype];
    if (!allowedExtensions) {
      return cb(new Error(`Invalid file type: ${mimetype}`));
    }

    // Check if extension matches the MIME type
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`File extension ${ext} does not match MIME type ${mimetype}`));
    }

    cb(null, true);
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
