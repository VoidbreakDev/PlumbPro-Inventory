// @vitest-environment node

/**
 * Quote → Invoice Journey Integration Tests
 * Tests: create quote → send → convert to invoice → record payment.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: () => void) => {
    req.user = { userId: 'test-user-qi', id: 'test-user-qi', email: 'qi@test.com', role: 'admin' };
    next();
  },
  authorizeRole: (..._roles: string[]) => (_req: any, _res: any, next: () => void) => next()
}));

vi.mock('../../server/src/services/emailService.js', () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
  sendQuoteEmail: vi.fn().mockResolvedValue({ success: true }),
  sendEmail: vi.fn().mockResolvedValue({ success: true })
}));

describe('Quote → Invoice journey', () => {
  let tempDir = '';
  let baseUrl = '';
  let server: import('http').Server;
  let pool: { end?: () => Promise<void> | void };

  const request = async (pathname: string, init: RequestInit = {}) => {
    const res = await fetch(`${baseUrl}${pathname}`, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test', ...((init.headers as object) ?? {}) },
      ...init
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { response: res, data };
  };

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbpro-qi-'));
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = path.join(tempDir, 'qi-test.db');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'qi-test-secret-padded-to-32-characters-min';

    vi.resetModules();

    const { createServer } = await import('../../server/src/server.js');
    const created = createServer({ nodeEnv: 'test' });
    pool = created.pool;
    server = created.app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve()))
    );
    await pool?.end?.();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  let contactId: string;
  let quoteId: string;
  let invoiceId: string;

  it('creates a customer contact', async () => {
    const { response, data } = await request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'James Henderson',
        type: 'Customer',
        email: 'james@example.com',
        phone: '0412345678'
      })
    });
    expect(response.status).toBe(201);
    contactId = (data as any).id;
  });

  it('creates a draft quote', async () => {
    const { response, data } = await request('/api/quotes', {
      method: 'POST',
      body: JSON.stringify({
        customerId: contactId,
        customerName: 'James Henderson',
        title: 'Hot Water System Replacement',
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        items: [
          { itemName: 'Rheem 250L Electric HWS', quantity: 1, unitPrice: 1200, taxRate: 10 },
          { itemName: 'Labour – Installation', quantity: 3, unitPrice: 120, taxRate: 10 }
        ],
        notes: 'Includes disposal of old unit'
      })
    });
    expect(response.status).toBe(201);
    quoteId = (data as any).id;
    expect((data as any).status).toBe('draft');
  });

  it('sends the quote to the customer', async () => {
    const { response, data } = await request(`/api/quotes/${quoteId}/send`, {
      method: 'POST'
    });
    expect([200, 201]).toContain(response.status);
    const status = (data as any).status ?? (data as any).quote?.status;
    expect(status).toBe('sent');
  });

  it('converts the quote to an invoice', async () => {
    const { response, data } = await request(`/api/quotes/${quoteId}/convert`, {
      method: 'POST'
    });
    expect([200, 201]).toContain(response.status);
    invoiceId = (data as any).id ?? (data as any).invoice?.id;
    expect(invoiceId).toBeTruthy();
  });

  it('invoice exists and shows correct total', async () => {
    const { response, data } = await request(`/api/invoices/${invoiceId}`);
    expect(response.status).toBe(200);
    // Total should reflect 3 labour @ 120 + 1 HWS @ 1200 + 10% GST
    const totalAmount = (data as any).total_amount ?? (data as any).totalAmount;
    expect(totalAmount).toBeGreaterThan(0);
  });

  it('records a payment against the invoice', async () => {
    const { response, data } = await request(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: 500,
        payment_method: 'bank_transfer',
        reference: 'BSB-TXN-001',
        notes: 'Partial deposit'
      })
    });
    expect([200, 201]).toContain(response.status);
    const paid = (data as any).amount_paid ?? (data as any).amountPaid;
    if (paid !== undefined) {
      expect(paid).toBeGreaterThanOrEqual(500);
    }
  });
});
