import { randomUUID } from 'crypto';

const ensureRegistry = new Map();

export function createPrefixedId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

export function stringifyJson(value, fallback = null) {
  return JSON.stringify(value ?? fallback);
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toInteger(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampRating(value) {
  return Math.max(0, Math.min(5, toNumber(value, 0)));
}

export function computeDocumentStatus(expiryDate) {
  if (!expiryDate) {
    return 'valid';
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(diffDays)) {
    return 'valid';
  }

  if (diffDays < 0) {
    return 'expired';
  }

  if (diffDays <= 30) {
    return 'expiring';
  }

  return 'valid';
}

export function sortByDateDesc(items, getDate) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(getDate(left) || 0).getTime();
    const rightDate = new Date(getDate(right) || 0).getTime();
    return rightDate - leftDate;
  });
}

export async function ensureTables(db, key, statements) {
  if (!ensureRegistry.has(key)) {
    ensureRegistry.set(
      key,
      (async () => {
        for (const statement of statements) {
          await db.query(statement);
        }
      })().catch((error) => {
        ensureRegistry.delete(key);
        throw error;
      })
    );
  }

  return ensureRegistry.get(key);
}

export function buildContainsPattern(value) {
  return `%${String(value || '').trim().toLowerCase()}%`;
}

export function matchesSearch(value, search) {
  if (!search) {
    return true;
  }

  return String(value || '').toLowerCase().includes(String(search).trim().toLowerCase());
}
