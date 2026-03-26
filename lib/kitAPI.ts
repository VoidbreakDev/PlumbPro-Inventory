/**
 * Kit/BOM Management API
 * Handles all operations for kit creation, management, and application
 */

import api from './api/client';
import type {
  Kit,
  KitCategory,
  KitApplication,
  KitAvailability,
  KitAnalytics,
  KitRecommendation,
  CreateKitInput,
  ApplyKitToJobInput,
  KitFilterOptions,
  KitComparison,
} from '../types';

export interface KitsResponse {
  kits: Kit[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KitFiltersResponse {
  categories: KitCategory[];
  jobTypes: string[];
  tags: string[];
}

class KitAPI {
  private baseUrl = '/kits';

  // ==================== Kit CRUD Operations ====================

  async getKits(options: KitFilterOptions & { page?: number; pageSize?: number } = {}): Promise<KitsResponse> {
    const params = new URLSearchParams();
    
    if (options.search) params.append('search', options.search);
    if (options.kitType) params.append('kitType', options.kitType);
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);
    if (options.jobType) params.append('jobType', options.jobType);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortDirection) params.append('sortDirection', options.sortDirection);
    if (options.page) params.append('page', options.page.toString());
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.tags?.length) {
      options.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getKit(id: string): Promise<Kit> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createKit(input: CreateKitInput): Promise<Kit> {
    const response = await api.post(this.baseUrl, input);
    return response.data;
  }

  async updateKit(id: string, input: Partial<CreateKitInput>): Promise<Kit> {
    const response = await api.put(`${this.baseUrl}/${id}`, input);
    return response.data;
  }

  async deleteKit(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async duplicateKit(id: string, newName?: string): Promise<Kit> {
    const response = await api.post(`${this.baseUrl}/${id}/duplicate`, { newName });
    return response.data;
  }

  async archiveKit(id: string): Promise<Kit> {
    const response = await api.put(`${this.baseUrl}/${id}/archive`);
    return response.data;
  }

  // ==================== Kit Categories ====================

  async getCategories(): Promise<KitCategory[]> {
    const response = await api.get(`${this.baseUrl}/categories`);
    return response.data;
  }

  async createCategory(name: string, color: string, description?: string): Promise<KitCategory> {
    const response = await api.post(`${this.baseUrl}/categories`, { name, color, description });
    return response.data;
  }

  async updateCategory(id: string, updates: Partial<KitCategory>): Promise<KitCategory> {
    const response = await api.put(`${this.baseUrl}/categories/${id}`, updates);
    return response.data;
  }

  async deleteCategory(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/categories/${id}`);
  }

  // ==================== Kit Application ====================

  async applyKitToJob(input: ApplyKitToJobInput): Promise<KitApplication> {
    const response = await api.post(`${this.baseUrl}/apply`, input);
    return response.data;
  }

  async getKitApplications(jobId?: string, kitId?: string): Promise<KitApplication[]> {
    const params = new URLSearchParams();
    if (jobId) params.append('jobId', jobId);
    if (kitId) params.append('kitId', kitId);
    
    const response = await api.get(`${this.baseUrl}/applications?${params.toString()}`);
    return response.data;
  }

  async updateKitApplication(applicationId: string, updates: Partial<KitApplication>): Promise<KitApplication> {
    const response = await api.put(`${this.baseUrl}/applications/${applicationId}`, updates);
    return response.data;
  }

  async removeKitFromJob(applicationId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/applications/${applicationId}`);
  }

  async pickKitItems(applicationId: string, pickedItemIds: string[]): Promise<KitApplication> {
    const response = await api.post(`${this.baseUrl}/applications/${applicationId}/pick`, { pickedItemIds });
    return response.data;
  }

  // ==================== Stock & Availability ====================

  async checkAvailability(kitId: string, variationId?: string): Promise<KitAvailability> {
    const params = new URLSearchParams();
    if (variationId) params.append('variationId', variationId);
    
    const response = await api.get(`${this.baseUrl}/${kitId}/availability?${params.toString()}`);
    return response.data;
  }

  async checkMultipleAvailability(kitIds: string[]): Promise<KitAvailability[]> {
    const response = await api.post(`${this.baseUrl}/availability`, { kitIds });
    return response.data;
  }

  async reserveStock(kitId: string, jobId: string, variationId?: string): Promise<{ reservationId: string }> {
    const response = await api.post(`${this.baseUrl}/${kitId}/reserve`, { jobId, variationId });
    return response.data;
  }

  async releaseReservation(reservationId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/reservations/${reservationId}`);
  }

  // ==================== Analytics & Reporting ====================

  async getKitAnalytics(kitId: string): Promise<KitAnalytics> {
    const response = await api.get(`${this.baseUrl}/${kitId}/analytics`);
    return response.data;
  }

  async getPopularKits(limit: number = 10): Promise<Kit[]> {
    const response = await api.get(`${this.baseUrl}/popular?limit=${limit}`);
    return response.data;
  }

  async getMostProfitableKits(limit: number = 10): Promise<Kit[]> {
    const response = await api.get(`${this.baseUrl}/profitable?limit=${limit}`);
    return response.data;
  }

  async compareKits(kitIds: string[]): Promise<KitComparison> {
    const response = await api.post(`${this.baseUrl}/compare`, { kitIds });
    return response.data;
  }

  // ==================== AI Recommendations ====================

  async getRecommendations(jobDescription: string, jobType?: string): Promise<KitRecommendation[]> {
    const response = await api.post(`${this.baseUrl}/recommendations`, { jobDescription, jobType });
    return response.data;
  }

  async getSmartSuggestions(inventoryItemId: string): Promise<Kit[]> {
    const response = await api.get(`${this.baseUrl}/suggestions?itemId=${inventoryItemId}`);
    return response.data;
  }

  // ==================== Import/Export ====================

  async exportKit(kitId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/${kitId}/export?format=${format}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async importKits(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`${this.baseUrl}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getImportTemplate(format: 'csv' | 'xlsx' = 'csv'): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/import-template?format=${format}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // ==================== Filter Options ====================

  async getFilterOptions(): Promise<KitFiltersResponse> {
    const response = await api.get(`${this.baseUrl}/filters`);
    return response.data;
  }
}

export const kitAPI = new KitAPI();
export default kitAPI;
