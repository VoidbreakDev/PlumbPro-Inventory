import api from './api';

export interface DashboardAnalytics {
  inventoryValue: number;
  lowStockCount: number;
  jobStats: Record<string, number>;
  recentMovements: Array<{
    type: string;
    count: number;
    totalQuantity: number;
  }>;
  topUsedItems: Array<{
    id: string;
    name: string;
    category: string;
    totalUsed: number;
  }>;
}

export interface InventoryAnalytics {
  turnover: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    currentStock: number;
    reorderLevel: number;
    totalUsed: number;
    avgUsage: number;
    usageCount: number;
    turnoverRate: number;
  }>;
  categoryValue: Array<{
    category: string;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
  }>;
  stockAging: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    lastMovement: number | null;
    daysIdle: number | null;
  }>;
}

export interface JobProfitability {
  jobs: Array<{
    id: string;
    title: string;
    jobType: string;
    builder: string;
    status: string;
    date: string;
    materialCost: number;
    workerCount: number;
    itemCount: number;
  }>;
  jobTypeStats: Array<{
    jobType: string;
    jobCount: number;
    avgMaterialCost: number;
    totalMaterialCost: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    jobCount: number;
    completedCount: number;
    totalMaterialCost: number;
  }>;
}

export interface WorkerPerformance {
  workers: Array<{
    id: string;
    name: string;
    totalJobs: number;
    completedJobs: number;
    inProgressJobs: number;
    totalMaterialsHandled: number;
    completionRate: number;
  }>;
}

export interface SupplierPerformance {
  suppliers: Array<{
    id: string;
    name: string;
    company: string;
    totalItems: number;
    totalStock: number;
    totalValue: number;
    lowStockItems: number;
  }>;
}

export interface MovementTrends {
  trends: Array<{
    period: string;
    type: string;
    movementCount: number;
    totalQuantity: number;
  }>;
}

export const analyticsAPI = {
  async getDashboard(): Promise<DashboardAnalytics> {
    const { data } = await api.get('/analytics/dashboard');
    return data;
  },

  async getInventoryAnalytics(startDate?: string, endDate?: string): Promise<InventoryAnalytics> {
    const { data } = await api.get('/analytics/inventory', {
      params: { startDate, endDate }
    });
    return data;
  },

  async getJobProfitability(startDate?: string, endDate?: string): Promise<JobProfitability> {
    const { data } = await api.get('/analytics/jobs/profitability', {
      params: { startDate, endDate }
    });
    return data;
  },

  async getWorkerPerformance(startDate?: string, endDate?: string): Promise<WorkerPerformance> {
    const { data } = await api.get('/analytics/workers/performance', {
      params: { startDate, endDate }
    });
    return data;
  },

  async getSupplierPerformance(): Promise<SupplierPerformance> {
    const { data } = await api.get('/analytics/suppliers/performance');
    return data;
  },

  async getMovementTrends(
    startDate?: string,
    endDate?: string,
    groupBy?: 'day' | 'month'
  ): Promise<MovementTrends> {
    const { data } = await api.get('/analytics/movements/trends', {
      params: { startDate, endDate, groupBy }
    });
    return data;
  }
};

export default analyticsAPI;
