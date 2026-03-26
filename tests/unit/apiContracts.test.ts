import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiGetMock,
  apiPostMock,
  apiPutMock,
  apiDeleteMock
} = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  apiPutMock: vi.fn(),
  apiDeleteMock: vi.fn()
}));

vi.mock('../../lib/api/client', () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock
  }
}));

vi.mock('../../lib/api', () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock
  }
}));

import { smartOrderingAPI } from '../../lib/api/operations';
import { kitAPI } from '../../lib/kitAPI';
import { subcontractorAPI } from '../../lib/subcontractorAPI';

describe('API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests kits without duplicating the /api prefix', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        kits: [],
        total: 0,
        page: 1,
        pageSize: 500
      }
    });

    await kitAPI.getKits({ pageSize: 500 });

    expect(apiGetMock).toHaveBeenCalledWith('/kits?pageSize=500');
  });

  it('requests subcontractors without duplicating the /api prefix', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        subcontractors: [],
        total: 0
      }
    });

    await subcontractorAPI.getSubcontractors({ pageSize: 300 });

    expect(apiGetMock).toHaveBeenCalledWith('/subcontractors?pageSize=300');
  });

  it('maps smart-ordering alerts into the frontend shape', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        alerts: [
          {
            id: 'alert-1',
            itemId: 'item-1',
            itemName: 'Copper Pipe',
            itemCategory: 'Pipes',
            alertType: 'low_stock',
            priority: 'normal',
            currentQuantity: 2,
            reorderPoint: 5,
            suggestedQuantity: 12,
            status: 'pending',
            suggestedSupplierName: 'TradeBase',
            createdAt: '2026-03-25T00:00:00.000Z'
          }
        ],
        summary: {
          critical: 0,
          high: 0,
          normal: 1,
          total: 1
        }
      }
    });

    const response = await smartOrderingAPI.getAlerts({ status: 'pending' });

    expect(apiGetMock).toHaveBeenCalledWith('/smart-ordering/alerts', {
      params: {
        status: 'pending',
        item_id: undefined
      }
    });
    expect(response.summary.total).toBe(1);
    expect(response.alerts[0]).toMatchObject({
      itemId: 'item-1',
      currentStock: 2,
      reorderPoint: 5,
      suggestedQuantity: 12,
      priority: 'normal',
      reason: 'Current stock is at or below the reorder point.'
    });
  });

  it('maps the smart-ordering dashboard into the frontend dashboard shape', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        alerts: {
          critical_alerts: 1,
          high_alerts: 2,
          total_pending_alerts: 3
        },
        lowStockItems: [
          {
            id: 'item-1',
            name: 'Valve',
            currentQuantity: 4,
            reorderPoint: 10,
            supplierName: 'Main Supplier'
          }
        ],
        upcomingShortages: [
          {
            id: 'item-2',
            name: 'Pump',
            currentQuantity: 1,
            allocatedQuantity: 3,
            availableAfter: -2,
            jobCount: 1,
            earliestJobDate: '2026-03-27'
          }
        ],
        recentOrders: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            status: 'draft',
            createdAt: '2026-03-24T00:00:00.000Z',
            total: 199.5,
            supplierName: 'Main Supplier',
            itemCount: 2
          }
        ]
      }
    });

    const dashboard = await smartOrderingAPI.getDashboard();

    expect(dashboard.summary).toMatchObject({
      pendingAlerts: 3,
      criticalAlerts: 1,
      highAlerts: 2,
      lowStockItems: 1,
      itemsToReorder: 3
    });
    expect(dashboard.lowStockItems[0]).toMatchObject({
      id: 'item-1',
      currentStock: 4,
      reorderLevel: 10,
      preferredSupplier: 'Main Supplier'
    });
    expect(dashboard.recentOrders[0]).toMatchObject({
      id: 'po-1',
      totalItems: 2,
      totalValue: 199.5
    });
  });
});
