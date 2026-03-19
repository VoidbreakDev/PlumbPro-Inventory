import crypto from 'crypto';
import { dbType } from '../config/database.js';

const isSqlite = dbType === 'sqlite';

export const nowIso = () => new Date().toISOString();

export const generateEntityId = (prefix = 'entity') => `${prefix}_${crypto.randomUUID()}`;

export const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
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

export async function tableExists(pool, tableName) {
  if (isSqlite) {
    const result = await pool.query(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = $1`,
      [tableName]
    );

    return result.rows.length > 0;
  }

  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    )`,
    [tableName]
  );

  return result.rows[0]?.exists === true;
}

export async function ensureJsonTable(pool, tableName, extraColumns = {}) {
  const columnEntries = Object.entries(extraColumns);
  const columnSql = columnEntries.length
    ? `, ${columnEntries.map(([name, type]) => `${name} ${type}`).join(', ')}`
    : '';

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL${columnSql}
    )`
  );

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id ON ${tableName}(user_id)`);

  for (const [columnName] of columnEntries) {
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON ${tableName}(${columnName})`
    );
  }
}

export function hydrateEntityRow(row) {
  const payload = parseJsonField(row.payload, {});

  return {
    ...payload,
    id: payload.id ?? String(row.id),
    createdAt: payload.createdAt ?? row.created_at ?? nowIso(),
    updatedAt: payload.updatedAt ?? row.updated_at ?? nowIso(),
  };
}

export async function listEntityRows(pool, tableName, userId, options = {}) {
  const {
    where = [],
    params = [],
    orderBy = 'updated_at DESC',
  } = options;

  const values = [String(userId), ...params];
  const extraWhere = where.length > 0 ? ` AND ${where.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT *
     FROM ${tableName}
     WHERE user_id = $1${extraWhere}
     ORDER BY ${orderBy}`,
    values
  );

  return result.rows;
}

export async function getEntityRow(pool, tableName, id, userId) {
  const result = await pool.query(
    `SELECT *
     FROM ${tableName}
     WHERE id = $1 AND user_id = $2`,
    [String(id), String(userId)]
  );

  return result.rows[0] || null;
}

export async function insertEntityRow(pool, tableName, { id, userId, payload, extra = {} }) {
  const timestamp = nowIso();
  const persistedPayload = {
    ...payload,
    id,
    createdAt: payload.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const extraEntries = Object.entries(extra);
  const columns = ['id', 'user_id', 'payload', 'created_at', 'updated_at', ...extraEntries.map(([name]) => name)];
  const values = [
    String(id),
    String(userId),
    JSON.stringify(persistedPayload),
    persistedPayload.createdAt,
    persistedPayload.updatedAt,
    ...extraEntries.map(([, value]) => value),
  ];
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  await pool.query(
    `INSERT INTO ${tableName} (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})`,
    values
  );

  return persistedPayload;
}

export async function updateEntityRow(pool, tableName, { id, userId, payload, extra = {} }) {
  const existing = await getEntityRow(pool, tableName, id, userId);
  if (!existing) {
    return null;
  }

  const existingPayload = hydrateEntityRow(existing);
  const persistedPayload = {
    ...existingPayload,
    ...payload,
    id: existingPayload.id,
    createdAt: existingPayload.createdAt,
    updatedAt: nowIso(),
  };

  const extraEntries = Object.entries(extra);
  const updates = ['payload = $1', 'updated_at = $2', ...extraEntries.map(([name], index) => `${name} = $${index + 3}`)];
  const values = [
    JSON.stringify(persistedPayload),
    persistedPayload.updatedAt,
    ...extraEntries.map(([, value]) => value),
    String(id),
    String(userId),
  ];

  await pool.query(
    `UPDATE ${tableName}
     SET ${updates.join(', ')}
     WHERE id = $${extraEntries.length + 3} AND user_id = $${extraEntries.length + 4}`,
    values
  );

  return persistedPayload;
}

export async function deleteEntityRow(pool, tableName, id, userId) {
  const result = await pool.query(
    `DELETE FROM ${tableName}
     WHERE id = $1 AND user_id = $2`,
    [String(id), String(userId)]
  );

  return result.rowCount > 0;
}

export const normaliseStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};
