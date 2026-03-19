import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  createId,
  ensureDomainTables,
  normalizeLikePattern,
  nowIso,
  safeJsonParse,
  toJson,
  toNullableNumber
} from './domainUtils.js';

const router = express.Router();

router.use(authenticateToken);

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads/voice-notes');

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      callback(null, uploadsDir);
    } catch (error) {
      callback(error, uploadsDir);
    }
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '') || '.webm';
    callback(null, `${createId()}${extension}`);
  }
});

const upload = multer({ storage });

const voiceNoteTableStatements = [
  `CREATE TABLE IF NOT EXISTS voice_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    job_id TEXT,
    contact_id TEXT,
    audio_url TEXT NOT NULL,
    audio_duration REAL NOT NULL,
    file_size REAL,
    mime_type TEXT NOT NULL,
    transcription TEXT,
    transcription_status TEXT NOT NULL,
    transcription_error TEXT,
    language TEXT,
    confidence REAL,
    extracted_items TEXT,
    summary TEXT,
    action_items TEXT,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`
];

async function ensureVoiceNoteTables() {
  await ensureDomainTables(pool, 'voice-notes', voiceNoteTableStatements);
}

function mapVoiceNote(row) {
  return {
    id: row.id,
    jobId: row.job_id || undefined,
    contactId: row.contact_id || undefined,
    userId: row.user_id,
    userName: row.user_name || undefined,
    audioUrl: row.audio_url,
    audioDuration: Number(row.audio_duration || 0),
    fileSize: row.file_size === null || row.file_size === undefined ? undefined : Number(row.file_size),
    mimeType: row.mime_type,
    transcription: row.transcription || undefined,
    transcriptionStatus: row.transcription_status,
    transcriptionError: row.transcription_error || undefined,
    language: row.language || undefined,
    confidence: row.confidence === null || row.confidence === undefined ? undefined : Number(row.confidence),
    extractedItems: safeJsonParse(row.extracted_items, undefined),
    summary: row.summary || undefined,
    actionItems: safeJsonParse(row.action_items, undefined),
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getVoiceNoteOr404(userId, noteId, res) {
  const result = await pool.query(
    `SELECT vn.*, COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email) AS user_name
     FROM voice_notes vn
     LEFT JOIN users u ON u.id = vn.user_id
     WHERE vn.id = $1 AND vn.user_id = $2
     LIMIT 1`,
    [noteId, userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Voice note not found' });
    return null;
  }

  return result.rows[0];
}

router.get('/stats', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const result = await pool.query(
      `SELECT *
       FROM voice_notes
       WHERE user_id = $1`,
      [req.user.userId]
    );

    const notes = result.rows.map(mapVoiceNote);
    res.json({
      totalNotes: notes.length,
      totalMinutes: Number((notes.reduce((sum, note) => sum + note.audioDuration, 0) / 60).toFixed(1)),
      transcribedCount: notes.filter((note) => note.transcriptionStatus === 'transcribed').length,
      pendingCount: notes.filter((note) => note.transcriptionStatus !== 'transcribed').length
    });
  } catch (error) {
    console.error('Failed to fetch voice note stats:', error);
    res.status(500).json({ error: 'Failed to fetch voice note stats' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const params = [req.user.userId];
    let query = `
      SELECT vn.*, COALESCE(u.full_name, u.email) AS user_name
      FROM voice_notes vn
      LEFT JOIN users u ON u.id = vn.user_id
      WHERE vn.user_id = $1
    `;

    if (req.query.jobId) {
      params.push(req.query.jobId);
      query += ` AND vn.job_id = $${params.length}`;
    }

    if (req.query.contactId) {
      params.push(req.query.contactId);
      query += ` AND vn.contact_id = $${params.length}`;
    }

    if (req.query.userId) {
      params.push(req.query.userId);
      query += ` AND vn.user_id = $${params.length}`;
    }

    if (req.query.transcriptionStatus) {
      params.push(req.query.transcriptionStatus);
      query += ` AND vn.transcription_status = $${params.length}`;
    }

    if (req.query.dateFrom) {
      params.push(req.query.dateFrom);
      query += ` AND vn.recorded_at >= $${params.length}`;
    }

    if (req.query.dateTo) {
      params.push(req.query.dateTo);
      query += ` AND vn.recorded_at <= $${params.length}`;
    }

    if (req.query.search) {
      params.push(normalizeLikePattern(req.query.search));
      query += ` AND LOWER(COALESCE(vn.transcription, '')) LIKE $${params.length}`;
    }

    query += ' ORDER BY vn.recorded_at DESC, vn.created_at DESC';

    const result = await pool.query(query, params);
    const notes = result.rows.map(mapVoiceNote);
    res.json({ notes, total: notes.length });
  } catch (error) {
    console.error('Failed to fetch voice notes:', error);
    res.status(500).json({ error: 'Failed to fetch voice notes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    if (!row) {
      return;
    }

    res.json(mapVoiceNote(row));
  } catch (error) {
    console.error('Failed to fetch voice note:', error);
    res.status(500).json({ error: 'Failed to fetch voice note' });
  }
});

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const timestamp = nowIso();
    const transcription = req.body.transcription || null;
    const transcriptionStatus = transcription ? 'transcribed' : 'pending';
    const audioUrl = `/uploads/voice-notes/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO voice_notes (
         id, user_id, job_id, contact_id, audio_url, audio_duration, file_size, mime_type,
         transcription, transcription_status, transcription_error, language, confidence,
         extracted_items, summary, action_items, recorded_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $19
       )
       RETURNING *`,
      [
        createId(),
        req.user.userId,
        req.body.jobId || null,
        req.body.contactId || null,
        audioUrl,
        toNullableNumber(req.body.audioDuration) ?? 0,
        req.file.size,
        req.file.mimetype || 'audio/webm',
        transcription,
        transcriptionStatus,
        null,
        req.body.language || null,
        transcription ? 1 : null,
        null,
        null,
        null,
        timestamp,
        timestamp,
        timestamp
      ]
    );

    const row = await getVoiceNoteOr404(req.user.userId, result.rows[0].id, res);
    res.status(201).json(mapVoiceNote(row));
  } catch (error) {
    console.error('Failed to upload voice note:', error);
    res.status(500).json({ error: 'Failed to upload voice note' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    if (!row) {
      return;
    }

    const result = await pool.query(
      `DELETE FROM voice_notes
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    const localPath = path.join(uploadsDir, path.basename(row.audio_url));
    await fs.unlink(localPath).catch(() => {});

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete voice note:', error);
    res.status(500).json({ error: 'Failed to delete voice note' });
  }
});

router.post('/:id/transcribe', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const result = await pool.query(
      `UPDATE voice_notes
       SET language = COALESCE($1, language),
           transcription_status = CASE
             WHEN transcription IS NOT NULL AND transcription <> '' THEN 'transcribed'
             ELSE 'pending'
           END,
           transcription_error = NULL,
           updated_at = $2
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        req.body.language || null,
        nowIso(),
        req.params.id,
        req.user.userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    res.json(mapVoiceNote(row));
  } catch (error) {
    console.error('Failed to request transcription:', error);
    res.status(500).json({ error: 'Failed to request transcription' });
  }
});

router.put('/:id/transcription', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const result = await pool.query(
      `UPDATE voice_notes
       SET transcription = $1,
           transcription_status = 'transcribed',
           transcription_error = NULL,
           confidence = COALESCE($2, confidence),
           updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        req.body.transcription,
        1,
        nowIso(),
        req.params.id,
        req.user.userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voice note not found' });
    }

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    res.json(mapVoiceNote(row));
  } catch (error) {
    console.error('Failed to update transcription:', error);
    res.status(500).json({ error: 'Failed to update transcription' });
  }
});

router.post('/:id/extract', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    if (!row) {
      return;
    }

    const transcription = String(row.transcription || '').trim();
    const extractedItems = transcription
      ? transcription
          .split(/[,.]/)
          .map((chunk) => chunk.trim())
          .filter((chunk) => chunk.length > 0)
          .slice(0, 5)
          .map((chunk) => ({
            type: 'other',
            text: chunk,
            confidence: 0.6
          }))
      : [];

    const updated = await pool.query(
      `UPDATE voice_notes
       SET extracted_items = $1,
           summary = $2,
           action_items = $3,
           updated_at = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [
        toJson(extractedItems, []),
        transcription ? transcription.split(/[.!?]/)[0] : null,
        toJson(extractedItems.map((item) => item.text), []),
        nowIso(),
        req.params.id,
        req.user.userId
      ]
    );

    res.json(mapVoiceNote(updated.rows[0]));
  } catch (error) {
    console.error('Failed to extract voice note items:', error);
    res.status(500).json({ error: 'Failed to extract voice note items' });
  }
});

router.post('/:id/convert-to-note', async (req, res) => {
  try {
    await ensureVoiceNoteTables();

    const row = await getVoiceNoteOr404(req.user.userId, req.params.id, res);
    if (!row) {
      return;
    }

    res.json({ jobNoteId: `voice-note-${row.id}` });
  } catch (error) {
    console.error('Failed to convert voice note to note:', error);
    res.status(500).json({ error: 'Failed to convert voice note to note' });
  }
});

export default router;
