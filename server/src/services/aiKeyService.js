import crypto from 'crypto';
import pool from '../config/database.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  const secret = process.env.AI_KEYS_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AI_KEYS_ENCRYPTION_SECRET must be configured and at least 32 characters long');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptApiKey = (apiKey) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
};

const decryptApiKey = ({ encrypted_key, iv, auth_tag }) => {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(auth_tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_key, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
};

export const upsertProviderKey = async (userId, provider, apiKey) => {
  const { encryptedKey, iv, authTag } = encryptApiKey(apiKey);
  await pool.query(
    `
      INSERT INTO ai_provider_keys (user_id, provider, encrypted_key, iv, auth_tag)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, provider)
      DO UPDATE SET encrypted_key = $3, iv = $4, auth_tag = $5, updated_at = CURRENT_TIMESTAMP
    `,
    [userId, provider, encryptedKey, iv, authTag]
  );
};

export const getProviderKey = async (userId, provider) => {
  const { rows } = await pool.query(
    `
      SELECT encrypted_key, iv, auth_tag
      FROM ai_provider_keys
      WHERE user_id = $1 AND provider = $2
      LIMIT 1
    `,
    [userId, provider]
  );

  if (!rows.length) {
    return null;
  }

  return decryptApiKey(rows[0]);
};

export const getProviderKeyStatus = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT provider
      FROM ai_provider_keys
      WHERE user_id = $1
    `,
    [userId]
  );

  const providers = {
    gemini: { hasKey: false }
  };

  rows.forEach((row) => {
    providers[row.provider] = { hasKey: true };
  });

  return { providers };
};
