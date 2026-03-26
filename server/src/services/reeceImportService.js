// server/src/services/reeceImportService.js
import { createReadStream } from 'fs';
import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import { categoriseProduct, classifyOrderType, isDeliveryItem } from '../utils/categorise.js';

/** Parse dd/MM/yyyy → ISO date string YYYY-MM-DD */
function parseAusDate(str) {
  if (!str) return null;
  const parts = String(str).trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** First day of the month containing dateStr (YYYY-MM-DD) → YYYY-MM-01 */
function toMonthStart(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7) + '-01';
}

function toNum(v) {
  const n = parseFloat(String(v || '').replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

/** Parse the CSV file at filePath and return raw rows array */
export function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => resolve(parsed.data),
      error: reject,
    });
  });
}

/**
 * Import rows from a parsed Reece CSV into the DB.
 * Returns summary stats.
 */
export async function importReeceRows(client, userId, filename, rows) {
  const batchId = randomUUID();
  const now = new Date().toISOString();
  let invoiceCount = 0;
  let creditCount = 0;
  let skippedCount = 0;
  let unconfirmedCount = 0;

  // Price history accumulator: key = productCode:YYYY-MM-01
  const priceMap = new Map();

  for (const row of rows) {
    const type = (row['Type'] || '').trim();

    // Skip cash/personal invoices
    if (type === 'Invoice (Cash)') {
      skippedCount++;
      continue;
    }

    // Normalise invoice type
    let invoiceType;
    if (type.includes('CREDIT')) {
      invoiceType = 'CREDIT NOTE';
      creditCount++;
    } else {
      invoiceType = 'TAX INVOICE';
      invoiceCount++;
    }

    const description = (row['Product Description'] || '').trim();
    const category = categoriseProduct(description);
    const delivery = isDeliveryItem(description);
    const orderNo = (row['Order No'] || '').trim();
    const { type: orderType, confirmed: orderTypeConfirmed } = classifyOrderType(orderNo);
    if (!orderTypeConfirmed) unconfirmedCount++;
    const invoiceDateRaw = (row['Date'] || '').trim();
    const invoiceDate = parseAusDate(invoiceDateRaw);
    const unitPriceExGst = toNum(row['Unit Price GST Excl']);
    const unitPriceIncGst = toNum(row['Unit Price GST Incl']);
    const productCode = (row['Product Code'] || '').trim();

    const id = randomUUID();
    await client.query(
      `INSERT INTO supplier_invoices (
        id, user_id, import_batch_id, supplier, invoice_date, invoice_number,
        invoice_type, order_no, order_type, order_type_confirmed, job_name, receiver,
        product_code, product_description, category, quantity, unit,
        unit_price_ex_gst, unit_price_inc_gst, line_total_ex_gst, line_total_gst,
        line_total_inc_gst, discount_pct, is_delivery_item, delivery_absorbed,
        billable_delivery, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      )`,
      [
        id, userId, batchId,
        (row['Supplier'] || 'Reece').trim(),
        invoiceDate,
        (row['Number'] || '').trim(),
        invoiceType,
        orderNo || null,
        orderType,
        orderTypeConfirmed ? 1 : 0,
        (row['Job Name'] || null),
        (row['Receiver'] || null),
        productCode,
        description,
        category,
        toNum(row['Quantity']),
        (row['Unit'] || null),
        unitPriceExGst,
        unitPriceIncGst,
        toNum(row['GST Excl Total Price']),
        toNum(row['GST Amount']),
        toNum(row['GST Incl Total Price']),
        toNum(row['Set Disc%']),
        delivery ? 1 : 0,
        1, // delivery_absorbed default true
        0, // billable_delivery default false
        now,
      ]
    );

    // Accumulate price history (TAX INVOICE only, non-null price)
    if (invoiceType === 'TAX INVOICE' && productCode && invoiceDate && unitPriceExGst !== null) {
      const monthKey = toMonthStart(invoiceDate);
      const mapKey = `${productCode}:${monthKey}`;
      if (!priceMap.has(mapKey)) {
        priceMap.set(mapKey, {
          productCode,
          description,
          category,
          unit: (row['Unit'] || null),
          unitPriceExGst,
          unitPriceIncGst,
          recordedMonth: monthKey,
        });
      }
    }
  }

  // Upsert product price history
  for (const entry of priceMap.values()) {
    const phId = randomUUID();
    await client.query(
      `INSERT INTO product_price_history
        (id, user_id, product_code, product_description, category, unit, unit_price_ex_gst, unit_price_inc_gst, recorded_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [phId, userId, entry.productCode, entry.description, entry.category, entry.unit, entry.unitPriceExGst, entry.unitPriceIncGst, entry.recordedMonth]
    );
  }

  // Compute batch totals from what was inserted
  const totalsResult = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN invoice_type='TAX INVOICE' THEN line_total_ex_gst ELSE 0 END),0) AS gross,
       COALESCE(SUM(CASE WHEN invoice_type='CREDIT NOTE' THEN ABS(line_total_ex_gst) ELSE 0 END),0) AS credits
     FROM supplier_invoices WHERE import_batch_id=$1`,
    [batchId]
  );
  const grossTotal = parseFloat(totalsResult.rows[0].gross);
  const creditTotal = parseFloat(totalsResult.rows[0].credits);

  // Determine review status
  const reviewStatus = unconfirmedCount > 0 ? 'pending' : 'complete';

  // Insert batch record
  await client.query(
    `INSERT INTO import_batches
       (id,user_id,filename,imported_at,row_count,invoice_count,gross_total_ex_gst,credit_total_ex_gst,status,review_status,unconfirmed_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'complete',$9,$10)`,
    [batchId, userId, filename, now, rows.length, invoiceCount + creditCount, grossTotal, creditTotal, reviewStatus, unconfirmedCount]
  );

  return { batchId, rowCount: rows.length, invoiceCount, creditCount, skippedCount, grossTotal, creditTotal, unconfirmedCount };
}
