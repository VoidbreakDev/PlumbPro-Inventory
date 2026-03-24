// @vitest-environment node

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: () => void) => {
    req.user = {
      userId: 'test-user',
      id: 'test-user',
      fullName: 'Test User',
      email: 'test@example.com'
    };
    next();
  },
  authorizeRole: (..._roles: string[]) => (_req: any, _res: any, next: () => void) => next()
}));

describe('live domain backend smoke flows', () => {
  let tempDir = '';
  let baseUrl = '';
  let server: import('http').Server;
  let pool: { end?: () => Promise<void> | void };

  const request = async (pathname: string, init: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, init);
    const text = await response.text();

    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return { response, data };
  };

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbpro-live-domains-'));
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = path.join(tempDir, 'plumbpro-test.db');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-padded-32-chars';

    vi.resetModules();

    const { createServer } = await import('../../server/src/server.js');
    const created = createServer({ nodeEnv: 'test' });
    pool = created.pool;
    server = created.app.listen(0);

    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });

    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await pool?.end?.();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates and lists assets through the mounted assets domain', async () => {
    const createResult = await request('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Drain Camera',
        assetCode: 'ASSET-001',
        assetType: 'equipment',
        status: 'active',
        condition: 'good'
      })
    });

    expect(createResult.response.status).toBe(201);
    expect((createResult.data as any).name).toBe('Drain Camera');

    const listResult = await request('/api/assets');

    expect(listResult.response.status).toBe(200);
    expect((listResult.data as any).assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetCode: 'ASSET-001',
          name: 'Drain Camera'
        })
      ])
    );
  });

  it('creates a lead and supports live status updates', async () => {
    const createResult = await request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Morgan Homeowner',
        phone: '0400000000',
        email: 'morgan@example.com',
        source: 'website',
        status: 'new',
        priority: 'warm',
        estimatedValue: 4200,
        receivedAt: new Date().toISOString(),
        tags: ['hot-water']
      })
    });

    expect(createResult.response.status).toBe(201);

    const leadId = (createResult.data as any).id;

    const statusResult = await request(`/api/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'qualified' })
    });

    expect(statusResult.response.status).toBe(200);
    expect((statusResult.data as any).status).toBe('qualified');
  });

  it('rates subcontractor jobs using the external jobId path the frontend sends', async () => {
    const subcontractorResult = await request('/api/subcontractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Coastal Plumbing Co',
        email: 'coastal@example.com',
        phone: '0411000000',
        abn: '12345678901',
        tradeType: ['Gas Fitting'],
        availabilityStatus: 'available'
      })
    });

    expect(subcontractorResult.response.status).toBe(201);
    const subcontractorId = (subcontractorResult.data as any).id;

    const assignResult = await request(`/api/subcontractors/${subcontractorId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'JOB-1001',
        jobTitle: 'Gas Line Upgrade',
        scopeOfWork: 'Install new gas line',
        hourlyRate: 140,
        totalValue: 900,
        status: 'quoted'
      })
    });

    expect(assignResult.response.status).toBe(201);
    expect((assignResult.data as any).jobId).toBe('JOB-1001');

    const rateResult = await request(`/api/subcontractors/${subcontractorId}/jobs/JOB-1001/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        review: 'Excellent workmanship',
        wouldRecommend: true
      })
    });

    expect(rateResult.response.status).toBe(200);
    expect((rateResult.data as any).rating).toBe(5);
    expect((rateResult.data as any).review).toBe('Excellent workmanship');
  });

  it('creates and duplicates kits through the server-backed kits domain', async () => {
    const createResult = await request('/api/kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hot Water Install Kit',
        category: 'Hot Water',
        kitType: 'installation',
        status: 'active',
        color: '#2563EB',
        applicableJobTypes: ['Hot Water Install'],
        tags: ['common'],
        items: [
          {
            itemType: 'inventory',
            itemName: 'Relief Valve',
            quantity: 1,
            unit: 'EA',
            unitCost: 25,
            unitSellPrice: 65
          }
        ]
      })
    });

    expect(createResult.response.status).toBe(201);
    const kitId = (createResult.data as any).id;

    const duplicateResult = await request(`/api/kits/${kitId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'Hot Water Install Kit Copy' })
    });

    expect(duplicateResult.response.status).toBe(201);
    expect((duplicateResult.data as any).name).toBe('Hot Water Install Kit Copy');
  });

  it('stores audio-only voice notes in a pending state that matches the live UI', async () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['audio-bytes'], { type: 'audio/webm' }), 'note.webm');
    formData.append('audioDuration', '12');
    formData.append('jobId', 'JOB-VOICE-1');
    formData.append('language', 'en-AU');

    const createResult = await request('/api/voice-notes', {
      method: 'POST',
      body: formData
    });

    expect(createResult.response.status).toBe(201);
    expect((createResult.data as any).transcriptionStatus).toBe('pending');

    const noteId = (createResult.data as any).id;
    const deleteResult = await request(`/api/voice-notes/${noteId}`, {
      method: 'DELETE'
    });

    expect(deleteResult.response.status).toBe(204);
  });
});
