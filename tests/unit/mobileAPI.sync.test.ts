import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiMock,
  offlineQueueMock
} = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  },
  offlineQueueMock: {
    getOfflineQueueItems: vi.fn(),
    replaceOfflineQueueItems: vi.fn(),
    clearOfflineQueueItems: vi.fn()
  }
}));

vi.mock('../../lib/api', () => ({
  default: apiMock,
  API_ROOT_URL: 'http://localhost:5001',
  DEFAULT_BACKEND_PORT: 5001
}));

vi.mock('../../lib/offlineQueue', () => ({
  getOfflineQueueItems: offlineQueueMock.getOfflineQueueItems,
  replaceOfflineQueueItems: offlineQueueMock.replaceOfflineQueueItems,
  clearOfflineQueueItems: offlineQueueMock.clearOfflineQueueItems
}));

import { mobileAPI } from '../../lib/mobileAPI';

describe('mobileAPI sync queue helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes offline queue records into dashboard-friendly sync items', async () => {
    offlineQueueMock.getOfflineQueueItems.mockResolvedValue([
      {
        id: 1,
        entityType: 'field_note',
        action: 'create',
        data: { jobId: 'JOB-100', content: 'Pressure tested line' },
        status: 'error',
        retryCount: 2,
        timestamp: 1760000000000
      }
    ]);

    const result = await mobileAPI.getSyncQueue();

    expect(result).toEqual([
      expect.objectContaining({
        id: '1',
        localId: 1,
        entity_type: 'field_note',
        action: 'create',
        status: 'error',
        retry_count: 2,
        created_at: new Date(1760000000000).toISOString(),
        updated_at: new Date(1760000000000).toISOString()
      })
    ]);
  });

  it('syncs queued items through /mobile/sync-offline and keeps failed items locally', async () => {
    offlineQueueMock.getOfflineQueueItems.mockResolvedValue([
      {
        id: 1,
        entityType: 'field_note',
        action: 'create',
        data: { jobId: 'JOB-100', content: 'Pressure tested line' },
        status: 'pending',
        retryCount: 0,
        timestamp: 1760000000000
      },
      {
        id: 2,
        entity_type: 'photo',
        action: 'create',
        data: { jobId: 'JOB-100', fileName: 'repair.jpg' },
        status: 'pending',
        retry_count: 0,
        created_at: '2026-03-13T08:00:00.000Z',
        updated_at: '2026-03-13T08:00:00.000Z'
      }
    ]);

    apiMock.post.mockResolvedValue({
      data: {
        results: [
          { localId: 1, success: true, serverId: 'note-1' },
          { localId: 2, success: false, error: 'Photo upload failed' }
        ]
      }
    });

    await mobileAPI.processSyncQueue();

    expect(apiMock.post).toHaveBeenCalledWith('/mobile/sync-offline', {
      queueItems: [
        {
          localId: 1,
          entityType: 'field_note',
          action: 'create',
          data: { jobId: 'JOB-100', content: 'Pressure tested line' }
        },
        {
          localId: 2,
          entityType: 'photo',
          action: 'create',
          data: { jobId: 'JOB-100', fileName: 'repair.jpg' }
        }
      ]
    });

    expect(offlineQueueMock.replaceOfflineQueueItems).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '2',
        localId: 2,
        entity_type: 'photo',
        status: 'failed',
        error: 'Photo upload failed',
        retry_count: 1
      })
    ]);
  });

  it('clears the offline queue locally', async () => {
    await mobileAPI.clearSyncQueue();

    expect(offlineQueueMock.clearOfflineQueueItems).toHaveBeenCalledTimes(1);
  });
});
