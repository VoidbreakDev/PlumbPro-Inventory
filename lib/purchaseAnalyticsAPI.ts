// lib/purchaseAnalyticsAPI.ts
import api from './api';

export interface PASummary {
  totalGrossExGST: number;
  totalNetExGST: number;
  totalIncGST: number;
  totalInvoices: number;
  totalUniqueProducts: number;
  totalDeliveryExGST: number;
  avgMonthlyGross: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface PAMonthlySpend {
  month: string;
  grossExGST: number;
  netExGST: number;
  grossIncGST: number;
  credits: number;
  invoiceCount: number;
  lineItems: number;
}

export interface PAAnnualSpend {
  year: string;
  grossExGST: number;
  netExGST: number;
  grossIncGST: number;
  credits: number;
  invoiceCount: number;
}

export interface PACategory {
  category: string;
  totalExGST: number;
  lineItems: number;
  uniqueProducts: number;
  percentOfTotal: number;
}

export interface PAProduct {
  productCode: string;
  productDescription: string;
  category: string;
  unit: string;
  timesOrdered: number;
  totalQty: number;
  totalSpendExGST: number;
  latestUnitPriceExGST: number | null;
  latestUnitPriceIncGST: number | null;
  firstSeen: string;
  lastSeen: string;
}

export interface PAPriceTrend {
  productCode: string;
  productDescription: string;
  points: Array<{ month: string; avgPriceExGST: number; avgPriceIncGST: number }>;
}

export interface PAPriceAlert {
  productCode: string;
  productDescription: string;
  category: string;
  firstMonth: string;
  lastMonth: string;
  firstPrice: number;
  lastPrice: number;
  changePercent: number;
  changeAbs: number;
  flag: 'high' | 'medium' | 'low';
}

export interface PADeliveryMonth {
  month: string;
  deliveryCount: number;
  totalExGST: number;
  totalIncGST: number;
  absorbedExGST: number;
  billableExGST: number;
}

export interface PADeliverySummary {
  totalExGST: number;
  totalIncGST: number;
  avgMonthlyExGST: number;
  totalCharges: number;
  absorbedPct: number;
  billablePct: number;
}

export interface ImportBatch {
  id: string;
  filename: string;
  imported_at: string;
  row_count: number;
  invoice_count: number;
  gross_total_ex_gst: number;
  credit_total_ex_gst: number;
  status: string;
}

export interface ImportSummary {
  batchId: string;
  rowCount: number;
  invoiceCount: number;
  creditCount: number;
  skippedCount: number;
  grossTotal: number;
  creditTotal: number;
}

function fmt(p: Record<string, string | number | undefined>) {
  const q = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

export const purchaseAnalyticsAPI = {
  getSummary: async (): Promise<PASummary> => {
    const { data } = await api.get('/purchase-analytics/summary');
    return data;
  },

  getMonthlySpend: async (params?: { year?: number; from?: string; to?: string }): Promise<{ months: PAMonthlySpend[] }> => {
    const { data } = await api.get(`/purchase-analytics/spend/monthly${fmt(params || {})}`);
    return data;
  },

  getAnnualSpend: async (): Promise<{ years: PAAnnualSpend[] }> => {
    const { data } = await api.get('/purchase-analytics/spend/annual');
    return data;
  },

  getCategories: async (params?: { from?: string; to?: string }): Promise<{ categories: PACategory[] }> => {
    const { data } = await api.get(`/purchase-analytics/categories${fmt(params || {})}`);
    return data;
  },

  getTopProducts: async (params?: { limit?: number; sortBy?: string; from?: string; to?: string }): Promise<{ products: PAProduct[] }> => {
    const { data } = await api.get(`/purchase-analytics/products/top${fmt(params || {})}`);
    return data;
  },

  getPriceTrends: async (code: string): Promise<PAPriceTrend> => {
    const { data } = await api.get(`/purchase-analytics/prices/trends?code=${encodeURIComponent(code)}`);
    return data;
  },

  getPriceAlerts: async (threshold = 10): Promise<{ alerts: PAPriceAlert[] }> => {
    const { data } = await api.get(`/purchase-analytics/prices/alerts?threshold=${threshold}`);
    return data;
  },

  getDeliveryMonthly: async (): Promise<{ months: PADeliveryMonth[] }> => {
    const { data } = await api.get('/purchase-analytics/delivery/monthly');
    return data;
  },

  getDeliverySummary: async (): Promise<PADeliverySummary> => {
    const { data } = await api.get('/purchase-analytics/delivery/summary');
    return data;
  },

  importReece: async (file: File): Promise<ImportSummary> => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post('/import/reece', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getBatches: async (): Promise<{ batches: ImportBatch[] }> => {
    const { data } = await api.get('/import/batches');
    return data;
  },

  deleteBatch: async (id: string): Promise<void> => {
    await api.delete(`/import/batches/${id}`);
  },
};

export default purchaseAnalyticsAPI;
