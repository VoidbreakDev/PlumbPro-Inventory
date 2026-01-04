import api from './api';

export interface StockForecast {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  avgDailyConsumption: number;
  predictedDemand: number;
  confidence: 'high' | 'medium' | 'low';
  confidencePercentage: number;
  expectedStockoutDate: string | null;
  recommendedReorderQty: number;
  seasonalTrends: string;
  riskFactors: string[];
  forecastByWeek: Array<{
    week: number;
    estimatedConsumption: number;
  }>;
}

export interface ForecastResponse {
  forecasts: StockForecast[];
  message?: string;
}

export interface SearchResult {
  interpretation: string;
  results: any[];
  filters: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    quantityMin?: number;
    quantityMax?: number;
  };
  suggestions: string[];
}

export interface JobTemplate {
  templateName: string;
  estimatedDuration: number;
  requiredItems: Array<{
    itemId: string | null;
    itemName: string;
    quantity: number;
    notes: string;
  }>;
  instructions: string[];
  estimatedLaborCost: number;
  safetyConsiderations: string[];
  additionalNotes: string;
}

export interface Anomaly {
  itemId: string;
  itemName: string;
  type: 'spike' | 'erratic' | 'suspicious' | 'drop';
  severity: 'high' | 'medium' | 'low';
  description: string;
  detectedPattern: string;
  recommendation: string;
}

export interface AnomalyResponse {
  anomalies: Anomaly[];
  summary: string;
  message?: string;
}

export interface PurchaseOrder {
  itemId: string;
  itemName: string;
  currentStock: number;
  reorderLevel: number;
  recommendedOrderQty: number;
  priority: 'urgent' | 'high' | 'normal';
  estimatedCost: number;
  supplier: string;
  reasoning: string;
  daysUntilStockout: number;
}

export interface PurchaseOrderResponse {
  purchaseOrders: PurchaseOrder[];
  totalEstimatedCost: number;
  summary: string;
  message?: string;
}

export interface Insight {
  category: 'inventory' | 'jobs' | 'efficiency' | 'financial';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  trend: 'positive' | 'negative' | 'neutral';
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedBenefit: string;
  effort: 'low' | 'medium' | 'high';
}

export interface SmartInsights {
  insights: Insight[];
  recommendations: Recommendation[];
  risks: string[];
  opportunities: string[];
  overallHealthScore: number;
}

export const aiAPI = {
  /**
   * Get stock demand forecasts
   */
  getForecast: async (itemId?: string, daysAhead: number = 30): Promise<ForecastResponse> => {
    const params: any = { daysAhead };
    if (itemId) params.itemId = itemId;

    const response = await api.get('/ai/forecast', { params });
    return response.data;
  },

  /**
   * Natural language search
   */
  search: async (query: string): Promise<SearchResult> => {
    const response = await api.post('/ai/search', { query });
    return response.data;
  },

  /**
   * Generate job template from description
   */
  generateTemplate: async (description: string): Promise<JobTemplate> => {
    const response = await api.post('/ai/generate-template', { description });
    return response.data;
  },

  /**
   * Detect anomalies in stock patterns
   */
  getAnomalies: async (): Promise<AnomalyResponse> => {
    const response = await api.get('/ai/anomalies');
    return response.data;
  },

  /**
   * Get purchase order recommendations
   */
  getPurchaseOrders: async (): Promise<PurchaseOrderResponse> => {
    const response = await api.get('/ai/purchase-orders');
    return response.data;
  },

  /**
   * Get smart business insights
   */
  getInsights: async (): Promise<SmartInsights> => {
    const response = await api.get('/ai/insights');
    return response.data;
  }
};
