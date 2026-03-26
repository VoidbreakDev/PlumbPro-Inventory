import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbQueryMock, generateCompletionMock, getProviderForFeatureMock } = vi.hoisted(() => ({
  dbQueryMock: vi.fn(),
  generateCompletionMock: vi.fn(),
  getProviderForFeatureMock: vi.fn()
}));

vi.mock('../../server/src/config/database.js', () => ({
  default: {
    query: dbQueryMock
  }
}));

vi.mock('../../server/src/services/aiProviders.js', () => ({
  generateCompletion: generateCompletionMock,
  getProviderForFeature: getProviderForFeatureMock
}));

import {
  forecastStockDemand,
  normalizeMovementTimestamp
} from '../../server/src/services/aiService.js';

describe('forecastStockDemand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes epoch-millis timestamps returned as strings', () => {
    const normalized = normalizeMovementTimestamp('1768177140348');

    expect(normalized).toBeInstanceOf(Date);
    expect(normalized.toISOString()).toBe('2026-01-12T00:19:00.348Z');
  });

  it('builds a fallback forecast without throwing on string timestamps', async () => {
    dbQueryMock.mockResolvedValue({
      rows: [
        {
          item_id: 'item-1',
          name: 'Copper Pipe',
          category: 'Pipes',
          current_stock: 12,
          reorder_level: 5,
          type: 'Out',
          quantity: -6,
          notes: 'Used on job',
          timestamp: '1768177140348'
        }
      ]
    });
    getProviderForFeatureMock.mockReturnValue('gemini');
    generateCompletionMock.mockRejectedValue(new Error('provider unavailable'));

    const result = await forecastStockDemand('user-1', null, 30);

    expect(dbQueryMock).toHaveBeenCalledTimes(1);
    expect(result.forecasts).toHaveLength(1);
    expect(result.forecasts[0]).toMatchObject({
      itemId: 'item-1',
      itemName: 'Copper Pipe',
      confidence: 'low'
    });
  });
});
