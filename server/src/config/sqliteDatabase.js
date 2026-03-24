import path from 'path';
import { initSQLiteSchema } from './sqliteSchema.js';

/**
 * Translate a PostgreSQL query + params to SQLite-compatible equivalents.
 * Returns { sqliteText, orderedParams }.
 */
function translateQuery(text, params) {
  // Normalize input params: undefined → null, Date → ISO string, boolean → 0/1
  const normalizedInputParams = (params || []).map(p => {
    if (p === undefined) return null;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });

  // Step 1: Apply syntax translations (no param substitution yet)
  const translated = text
    .replace(/\bILIKE\b/g, 'LIKE')
    .replace(/jsonb_build_object\s*\(/gi, 'json_object(')
    .replace(/jsonb_agg\s*\(/gi, 'json_group_array(')
    .replace(/json_agg\s*\(\s*DISTINCT\s+/gi, 'json_group_array(')
    .replace(/json_agg\s*\(/gi, 'json_group_array(')
    .replace(/json_build_array\s*\(/gi, 'json_array(')
    .replace(/::\w+/g, '')
    .replace(/\bFOR\s+UPDATE\s+OF\s+\w+/gi, '')
    .replace(/\bFOR\s+UPDATE\b/gi, '')
    .replace(/\bFOR\s+SHARE\b/gi, '')
    .replace(/\bFOR\s+NO\s+KEY\s+UPDATE\b/gi, '')
    .replace(/\bGREATEST\s*\(/gi, 'MAX(')
    .replace(/\bLEAST\s*\(/gi, 'MIN(')
    .replace(/\bNOW\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s+hours?'/gi, "datetime('now', '-$1 hours')")
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s+days?'/gi, "datetime('now', '-$1 days')")
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s+minutes?'/gi, "datetime('now', '-$1 minutes')");

  // Step 2: Position-aware param replacement that handles = ANY($N) expansion
  // Collect all parameter references (= ANY($N) and plain $N) with positions
  const tokens = [];

  // Find = ANY($N) patterns (must come first so the $N inside isn't double-counted)
  const anyRe = /=\s*ANY\s*\(\s*\$(\d+)\s*\)/gi;
  for (const m of translated.matchAll(anyRe)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: 'any', idx: Number(m[1]) - 1 });
  }

  // Find plain $N patterns not already covered by an ANY token
  const paramRe = /\$(\d+)/g;
  for (const m of translated.matchAll(paramRe)) {
    const inside = tokens.some(t => t.type === 'any' && m.index >= t.start && m.index < t.end);
    if (!inside) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'param', idx: Number(m[1]) - 1 });
    }
  }

  tokens.sort((a, b) => a.start - b.start);

  let sqliteText = '';
  let lastEnd = 0;
  const orderedParams = [];

  for (const token of tokens) {
    sqliteText += translated.slice(lastEnd, token.start);
    lastEnd = token.end;

    if (token.type === 'any') {
      const val = normalizedInputParams[token.idx];
      if (Array.isArray(val) && val.length > 0) {
        sqliteText += `IN (${val.map(() => '?').join(',')})`;
        val.forEach(v => orderedParams.push(v ?? null));
      } else if (Array.isArray(val) && val.length === 0) {
        sqliteText += 'IN (NULL)'; // Empty array — matches nothing
      } else {
        sqliteText += '= ?';
        orderedParams.push(val ?? null);
      }
    } else {
      sqliteText += '?';
      orderedParams.push(normalizedInputParams[token.idx] ?? null);
    }
  }

  sqliteText += translated.slice(lastEnd);

  return { sqliteText, orderedParams };
}

export async function createSqliteDatabase() {
  try {
    const { default: Database } = await import('better-sqlite3');
    const fs = await import('fs');

    const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'plumbpro.db');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sqliteDb = new Database(dbPath);
    console.log('✅ SQLite database connected:', dbPath);

    sqliteDb.pragma('journal_mode = WAL');
    initSQLiteSchema(sqliteDb);

    // Pre-prepared statements for generate_quote_number — used directly in
    // pool.query() to avoid the better-sqlite3 reentrancy restriction that
    // prevents running nested statements from within stmt.all() callbacks.
    const _qnsInsert = sqliteDb.prepare(
      `INSERT INTO quote_number_sequence (user_id, current_number) VALUES (?, 0)
       ON CONFLICT(user_id) DO NOTHING`
    );
    const _qnsIncrement = sqliteDb.prepare(
      `UPDATE quote_number_sequence SET current_number = current_number + 1 WHERE user_id = ?`
    );
    const _qnsSelect = sqliteDb.prepare(
      'SELECT prefix, current_number FROM quote_number_sequence WHERE user_id = ?'
    );

    const pool = {
      query: async (text, params) => {
        try {
          // Intercept PostgreSQL stored-function calls that have no SQLite equivalent
          const trimmed = text.trim();
          if (/select\s+generate_quote_number\s*\(/i.test(trimmed)) {
            const userId = (params || [])[0] ?? null;
            const year = new Date().getFullYear();
            _qnsInsert.run(userId);
            _qnsIncrement.run(userId);
            const row = _qnsSelect.get(userId);
            const num = String(row.current_number).padStart(4, '0');
            return { rows: [{ quote_number: `${row.prefix}-${year}-${num}` }], rowCount: 1 };
          }

          const { sqliteText, orderedParams } = translateQuery(text, params);
          const stmt = sqliteDb.prepare(sqliteText);
          const normalized = text.trim().toLowerCase();
          const hasReturning = normalized.includes(' returning ');

          if (normalized.startsWith('select') || hasReturning) {
            const rawRows = stmt.all(...orderedParams);
            // Auto-parse JSON string columns (SQLite returns json_group_array/json_object as strings)
            const rows = rawRows.map(row => {
              const out = { ...row };
              for (const [k, v] of Object.entries(out)) {
                if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
                  try { out[k] = JSON.parse(v); } catch { /* leave as-is */ }
                }
              }
              return out;
            });
            return { rows, rowCount: rows.length };
          }

          const result = stmt.run(...orderedParams);
          return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
        } catch (err) {
          console.error('SQLite query error:', err);
          console.error('Query:', text);
          console.error('Params:', params);
          throw err;
        }
      },
      connect: async () => ({
        query: async (text, params) => pool.query(text, params),
        release: () => {}
      }),
      on: () => {},
      end: async () => {
        sqliteDb.close();
      }
    };

    return { pool, sqliteDb };
  } catch (error) {
    console.error('❌ SQLite connection failed:', error);
    throw error;
  }
}
