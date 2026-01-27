// Advanced Analytics API Client
import api from './api';

// Types
export interface AnalyticsDashboard {
  period: number;
  summary: {
    revenue: {
      total: number;
      paid: number;
      outstanding: number;
      invoiceCount: number;
    };
    jobs: {
      total: number;
      completed: number;
      inProgress: number;
      avgCompletionDays: string;
    };
    customers: {
      total: number;
      new: number;
    };
    inventory: {
      totalItems: number;
      totalValue: number;
      lowStockItems: number;
    };
    profitMargin: string | number;
  };
  topItems: Array<{
    id: string;
    name: string;
    category: string;
    totalSold: number;
    totalRevenue: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    type: string;
    totalRevenue: number;
    jobCount: number;
  }>;
  trends: Array<{
    date: string;
    revenue: number;
    jobsCompleted: number;
  }>;
  paymentAging: Record<string, { count: number; amount: number }>;
}

export interface JobProfitability {
  period: number;
  summary: {
    totalJobs: number;
    totalRevenue: number;
    totalProfit: number;
    avgMargin: string | number;
    avgJobValue: string | number;
  };
  byJobType: Array<{
    jobType: string;
    count: number;
    revenue: number;
    profit: number;
    avgMargin: string | number;
  }>;
  byCustomerType: Array<{
    customerType: string;
    count: number;
    revenue: number;
    profit: number;
    avgMargin: string | number;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    jobType: string;
    customerName: string;
    customerType: string;
    completedAt: string;
    revenue: number;
    materialCost: number;
    laborCost: number;
    profit: number;
    marginPercent: string;
  }>;
}

export interface InventoryAnalytics {
  period: number;
  summary: {
    totalItems: number;
    totalUnits: number;
    totalValue: number;
    potentialRevenue: number;
    lowStockItems: number;
    outOfStockItems: number;
    slowMovingValue: number;
    slowMovingPercent: string | number;
  };
  byCategory: Array<{
    category: string;
    itemCount: number;
    currentStock: number;
    stockValue: number;
    unitsSold: number;
    turnoverRate: string | number;
  }>;
  slowMovingItems: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    value: number;
    lastMovement: string | null;
  }>;
  wastage: {
    totalUnits: number;
    totalValue: number;
    items: Array<{
      name: string;
      category: string;
      unitsWasted: number;
      valueWasted: number;
      reason: string;
    }>;
  };
}

export interface CustomerAnalytics {
  summary: {
    totalCustomers: number;
    newLast30Days: number;
    activeLast90Days: number;
    avgLifetimeValue: number;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    type: string;
    customerType: string;
    customerSince: string;
    totalJobs: number;
    lifetimeValue: number;
    lastJobDate: string;
    avgJobValue: number;
  }>;
  bySegment: Array<{
    customerType: string;
    customerCount: number;
    totalJobs: number;
    totalRevenue: number;
    avgJobValue: number;
  }>;
  retention: {
    neverBooked: number;
    oneTime: number;
    occasional: number;
    frequent: number;
    churned: number;
  };
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  config: Record<string, unknown>;
  chartType: string;
  isFavorite: boolean;
  isShared: boolean;
  lastRunAt: string | null;
  schedule: {
    frequency: string;
    isActive: boolean;
    nextRunAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  name: string;
  description?: string;
  reportType: string;
  config?: Record<string, unknown>;
  chartType?: string;
}

export interface ScheduleReportInput {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  recipients?: string[];
  exportFormat?: 'pdf' | 'csv' | 'xlsx';
}

// API
export const advancedAnalyticsAPI = {
  // Dashboard
  getDashboard: async (period: number = 30): Promise<AnalyticsDashboard> => {
    const { data } = await api.get('/advanced-analytics/dashboard', { params: { period } });
    return data;
  },

  // Job Profitability
  getJobProfitability: async (period: number = 90, groupBy: string = 'month'): Promise<JobProfitability> => {
    const { data } = await api.get('/advanced-analytics/job-profitability', { params: { period, groupBy } });
    return data;
  },

  // Inventory Analytics
  getInventoryAnalytics: async (period: number = 90): Promise<InventoryAnalytics> => {
    const { data } = await api.get('/advanced-analytics/inventory', { params: { period } });
    return data;
  },

  // Customer Analytics
  getCustomerAnalytics: async (): Promise<CustomerAnalytics> => {
    const { data } = await api.get('/advanced-analytics/customers');
    return data;
  },

  // Saved Reports
  getReports: async (options?: { type?: string; favorite?: boolean }): Promise<{ reports: SavedReport[] }> => {
    const { data } = await api.get('/advanced-analytics/reports', { params: options });
    return data;
  },

  createReport: async (input: CreateReportInput): Promise<SavedReport> => {
    const { data } = await api.post('/advanced-analytics/reports', input);
    return data;
  },

  updateReport: async (id: string, updates: Partial<CreateReportInput> & { isFavorite?: boolean }): Promise<SavedReport> => {
    const { data } = await api.put(`/advanced-analytics/reports/${id}`, updates);
    return data;
  },

  deleteReport: async (id: string): Promise<void> => {
    await api.delete(`/advanced-analytics/reports/${id}`);
  },

  // Report Scheduling
  scheduleReport: async (reportId: string, schedule: ScheduleReportInput): Promise<unknown> => {
    const { data } = await api.post(`/advanced-analytics/reports/${reportId}/schedule`, schedule);
    return data;
  },

  removeSchedule: async (reportId: string): Promise<void> => {
    await api.delete(`/advanced-analytics/reports/${reportId}/schedule`);
  },

  // Export
  exportData: async (reportType: string, format: string, config?: Record<string, unknown>): Promise<{ downloadUrl: string | null }> => {
    const { data } = await api.post('/advanced-analytics/export', { reportType, format, config });
    return data;
  }
};

export default advancedAnalyticsAPI;
