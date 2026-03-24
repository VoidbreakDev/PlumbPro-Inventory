#!/usr/bin/env node
/**
 * Translation Coverage Checker
 * Compares all locale files against the reference (en.json) and reports
 * missing or extra keys in each translation.
 *
 * Usage:
 *   node scripts/check-translations.js
 *   node scripts/check-translations.js --strict   # exit 1 if any keys missing
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'locales');
const REFERENCE_LOCALE = 'en';

const strict = process.argv.includes('--strict');

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function loadLocale(file) {
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8');
  return JSON.parse(raw);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
const referenceFile = `${REFERENCE_LOCALE}.json`;

if (!files.includes(referenceFile)) {
  console.error(`Reference locale file not found: ${referenceFile}`);
  process.exit(1);
}

const referenceData = loadLocale(referenceFile);
const referenceKeys = new Set(flattenKeys(referenceData));

let totalMissing = 0;
let totalExtra = 0;
let hasErrors = false;

console.log(`\nTranslation coverage report (reference: ${referenceFile})\n`);
console.log('='.repeat(60));

for (const file of files) {
  if (file === referenceFile) continue;

  const locale = file.replace('.json', '');
  const data = loadLocale(file);
  const keys = new Set(flattenKeys(data));

  const missing = [...referenceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !referenceKeys.has(k));

  const coverage = Math.round(((referenceKeys.size - missing.length) / referenceKeys.size) * 100);

  console.log(`\n${locale.toUpperCase()} — ${coverage}% coverage`);
  console.log('-'.repeat(40));

  if (missing.length === 0 && extra.length === 0) {
    console.log('  ✓ All keys present, no extras');
  }

  if (missing.length > 0) {
    hasErrors = true;
    totalMissing += missing.length;
    console.log(`  Missing (${missing.length}):`);
    missing.forEach((k) => console.log(`    - ${k}`));
  }

  if (extra.length > 0) {
    totalExtra += extra.length;
    console.log(`  Extra (${extra.length}) — safe to remove:`);
    extra.forEach((k) => console.log(`    + ${k}`));
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Summary: ${totalMissing} missing keys, ${totalExtra} extra keys across all locales`);

if (strict && hasErrors) {
  console.error('\nExiting with error (--strict mode, missing keys found)');
  process.exit(1);
}

if (!hasErrors) {
  console.log('\nAll translations are complete.');
}
