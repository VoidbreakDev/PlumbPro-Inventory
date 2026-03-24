import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getProviderKeyStatus, upsertProviderKey } from '../services/aiKeyService.js';
import pool from '../config/database.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/ai-keys', async (req, res) => {
  try {
    const status = await getProviderKeyStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    console.error('Failed to load AI key status:', error);
    res.status(500).json({ error: 'Failed to load AI key status' });
  }
});

router.put('/ai-keys/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body;

    if (provider !== 'gemini') {
      return res.status(400).json({ error: 'Unsupported AI provider' });
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }

    await upsertProviderKey(req.user.userId, provider, apiKey.trim());

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save AI key:', error);
    res.status(500).json({ error: 'Failed to save AI key' });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT currency_code, locale FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    // If column doesn't exist yet (migration not run), return defaults
    res.json({ currency_code: 'AUD', locale: 'en-AU' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const { currency_code, locale } = req.body;
    const allowed_currencies = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD'];
    if (currency_code && !allowed_currencies.includes(currency_code.toUpperCase())) {
      return res.status(400).json({ error: 'Unsupported currency code' });
    }
    await pool.query(
      `UPDATE users SET
        currency_code = COALESCE($1, currency_code),
        locale = COALESCE($2, locale),
        updated_at = NOW()
       WHERE id = $3`,
      [currency_code?.toUpperCase() ?? null, locale ?? null, req.user.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.post('/backup', authorizeRole('admin', 'owner'), async (req, res) => {
  try {
    const [inventory, contacts, jobs, quotes, invoices] = await Promise.all([
      pool.query('SELECT * FROM inventory_items ORDER BY created_at'),
      pool.query('SELECT id, name, type, email, phone, company, created_at FROM contacts ORDER BY created_at'),
      pool.query('SELECT * FROM jobs ORDER BY created_at'),
      pool.query('SELECT * FROM quotes ORDER BY created_at'),
      pool.query('SELECT * FROM invoices ORDER BY created_at')
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.5',
      data: {
        inventory_items: inventory.rows,
        contacts: contacts.rows,
        jobs: jobs.rows,
        quotes: quotes.rows,
        invoices: invoices.rows
      }
    };

    const filename = `plumbpro-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (error) {
    console.error('Failed to create backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

export default router;
