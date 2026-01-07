import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getProviderKeyStatus, upsertProviderKey } from '../services/aiKeyService.js';

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

export default router;
