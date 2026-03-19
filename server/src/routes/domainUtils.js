import { randomUUID } from 'crypto';

const ensuredDomains = new Set();

export const createId = () => randomUUID();

export const nowIso = () => new Date().toISOString();

export const safeJsonParse = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const toJson = (value, fallback = null) => {
  if (value === undefined) {
    return fallback;
  }

  return JSON.stringify(value ?? fallback);
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeTextArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export const normalizeLikePattern = (value) => `%${String(value).trim().toLowerCase()}%`;

export function buildInClause(values, startIndex = 1) {
  const placeholders = values.map((_, index) => `$${startIndex + index}`).join(', ');
  return `(${placeholders || 'NULL'})`;
}

export async function ensureDomainTables(pool, domainName, statements) {
  if (ensuredDomains.has(domainName)) {
    return;
  }

  for (const statement of statements) {
    await pool.query(statement);
  }

  ensuredDomains.add(domainName);
}

export async function fetchUserDisplayName(pool, userId, fallback = 'Team Member') {
  if (!userId) {
    return fallback;
  }

  try {
    const result = await pool.query(
      `SELECT
         COALESCE(full_name, trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
       FROM users
       WHERE id = $1`,
      [userId]
    );

    return result.rows[0]?.display_name || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchJobSummary(pool, userId, jobId) {
  if (!jobId) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       id,
       COALESCE(title, description, job_number, id) AS job_title,
       COALESCE(description, title, job_number, '') AS job_description,
       COALESCE(customer_name, '') AS customer_name
     FROM jobs
     WHERE id = $1
       AND (
         user_id = $2
         OR assigned_to = $2
         OR customer_id IN (SELECT id FROM contacts WHERE user_id = $2)
       )
     LIMIT 1`,
    [jobId, userId]
  );

  return result.rows[0] || null;
}

export async function fetchInventorySummary(pool, inventoryItemId) {
  if (!inventoryItemId) {
    return null;
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         COALESCE(name, sku, barcode, id) AS name,
         COALESCE(sku, barcode, '') AS item_code,
         COALESCE(category, '') AS category,
         COALESCE(quantity, 0) AS quantity,
         COALESCE(cost_price, price, 0) AS unit_cost,
         COALESCE(sale_price, cost_price, price, 0) AS unit_sell_price
       FROM inventory_items
       WHERE id = $1
       LIMIT 1`,
      [inventoryItemId]
    );

    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export async function ensureUploadsDirectory(fsModule, pathModule, uploadsDir) {
  await fsModule.mkdir(uploadsDir, { recursive: true });
  return pathModule.resolve(uploadsDir);
}
