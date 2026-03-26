// @vitest-environment node

/**
 * Inventory CRUD Integration Tests
 * Tests create, read, update, delete, and stock adjustments with movement tracking.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: () => void) => {
    req.user = { userId: 'test-user-inv', id: 'test-user-inv', email: 'inv@test.com', role: 'admin' };
    next();
  },
  authorizeRole: (..._roles: string[]) => (_req: any, _res: any, next: () => void) => next()
}));

describe('Inventory CRUD', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbpro-inv-'));
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = path.join(tempDir, 'inv-test.db');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'inv-test-secret-padded-to-32-characters!!';

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

  let createdItemId: string;

  it('creates an inventory item', async () => {
    const { response, data } = await request('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Copper Pipe 15mm',
        category: 'Pipes',
        quantity: 100,
        price: 4.50,
        reorderLevel: 20,
        unit: 'metre'
      })
    });

    expect(response.status).toBe(201);
    expect((data as any).name).toBe('Copper Pipe 15mm');
    expect((data as any).quantity).toBe(100);
    createdItemId = (data as any).id;
  });

  it('reads the created item by ID', async () => {
    const { response, data } = await request(`/api/inventory/${createdItemId}`);
    expect(response.status).toBe(200);
    expect((data as any).id).toBe(createdItemId);
    expect((data as any).name).toBe('Copper Pipe 15mm');
  });

  it('lists all inventory items and includes the created item', async () => {
    const { response, data } = await request('/api/inventory');
    expect(response.status).toBe(200);
    const items = Array.isArray(data) ? data : (data as any).items ?? [];
    expect(items.some((i: any) => i.id === createdItemId)).toBe(true);
  });

  it('updates the item quantity and price', async () => {
    const { response, data } = await request(`/api/inventory/${createdItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: 150, price: 5.00 })
    });
    expect(response.status).toBe(200);
    expect((data as any).quantity).toBe(150);
    expect(parseFloat((data as any).price)).toBe(5.00);
  });

  it('records a stock adjustment movement', async () => {
    const { response, data } = await request(`/api/inventory/${createdItemId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ quantity: -10, reason: 'Used on site' })
    });

    // Stock adjustment should succeed (200 or 201)
    expect([200, 201]).toContain(response.status);
  });

  it('verifies stock movement was recorded for the adjustment', async () => {
    const { response, data } = await request('/api/movements');
    expect(response.status).toBe(200);
    const movements = Array.isArray(data) ? data : (data as any).movements ?? [];
    const itemMovements = movements.filter((m: any) => m.itemId === createdItemId || m.item_id === createdItemId);
    expect(itemMovements.length).toBeGreaterThan(0);
  });

  it('deletes the inventory item', async () => {
    const { response } = await request(`/api/inventory/${createdItemId}`, {
      method: 'DELETE'
    });
    expect([200, 204]).toContain(response.status);
  });

  it('returns 404 for the deleted item', async () => {
    const { response } = await request(`/api/inventory/${createdItemId}`);
    expect(response.status).toBe(404);
  });
});
