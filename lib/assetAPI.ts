/**
 * Asset Management API
 * Manages vehicles, tools, equipment, and their maintenance
 */

import api from './api';
import type {
  Asset,
  MaintenanceRecord,
  AssetAllocation,
  ComplianceDocument,
  GeoLocation,
} from '../types';

export interface AssetsResponse {
  assets: Asset[];
  total: number;
}

export interface MaintenanceStats {
  totalAssets: number;
  overdueMaintenance: number;
  upcomingMaintenance: number;
  expiringCompliance: number;
}

class AssetAPI {
  private baseUrl = '/assets';

  // ==================== Asset CRUD ====================

  async getAssets(filters?: {
    type?: string;
    status?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AssetsResponse> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getAsset(id: string): Promise<Asset> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const response = await api.post(this.baseUrl, asset);
    return response.data;
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    const response = await api.put(`${this.baseUrl}/${id}`, updates);
    return response.data;
  }

  async deleteAsset(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // ==================== Maintenance ====================

  async getMaintenanceRecords(assetId?: string): Promise<MaintenanceRecord[]> {
    const params = assetId ? `?assetId=${assetId}` : '';
    const response = await api.get(`${this.baseUrl}/maintenance${params}`);
    return response.data;
  }

  async createMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaintenanceRecord> {
    const response = await api.post(`${this.baseUrl}/maintenance`, record);
    return response.data;
  }

  async updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    const response = await api.put(`${this.baseUrl}/maintenance/${id}`, updates);
    return response.data;
  }

  async completeMaintenance(
    recordId: string,
    data: {
      completedDate: string;
      workPerformed: string;
      cost?: number;
      odometerReading?: number;
      photos?: string[];
    }
  ): Promise<MaintenanceRecord> {
    const response = await api.post(`${this.baseUrl}/maintenance/${recordId}/complete`, data);
    return response.data;
  }

  // ==================== Asset Allocation & GPS Check-in/out ====================

  async allocateAsset(data: {
    assetId: string;
    userId?: string;
    jobId?: string;
    expectedReturnAt?: string;
    notes?: string;
  }): Promise<AssetAllocation> {
    const response = await api.post(`${this.baseUrl}/allocate`, data);
    return response.data;
  }

  async checkOutAsset(
    allocationId: string,
    location: GeoLocation,
    odometerReading?: number
  ): Promise<AssetAllocation> {
    const response = await api.post(`${this.baseUrl}/checkout/${allocationId}`, {
      location,
      odometerReading,
    });
    return response.data;
  }

  async checkInAsset(
    allocationId: string,
    location: GeoLocation,
    data: {
      condition: string;
      odometerReading?: number;
      notes?: string;
    }
  ): Promise<AssetAllocation> {
    const response = await api.post(`${this.baseUrl}/checkin/${allocationId}`, {
      location,
      ...data,
    });
    return response.data;
  }

  async getCurrentAllocations(userId?: string): Promise<AssetAllocation[]> {
    const params = userId ? `?userId=${userId}` : '';
    const response = await api.get(`${this.baseUrl}/allocations${params}`);
    return response.data;
  }

  // ==================== Compliance Documents ====================

  async addComplianceDocument(
    assetId: string,
    document: Omit<ComplianceDocument, 'id'>
  ): Promise<ComplianceDocument> {
    const response = await api.post(`${this.baseUrl}/${assetId}/documents`, document);
    return response.data;
  }

  async updateComplianceDocument(
    assetId: string,
    documentId: string,
    updates: Partial<ComplianceDocument>
  ): Promise<ComplianceDocument> {
    const response = await api.put(`${this.baseUrl}/${assetId}/documents/${documentId}`, updates);
    return response.data;
  }

  async deleteComplianceDocument(assetId: string, documentId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${assetId}/documents/${documentId}`);
  }

  // ==================== Dashboard & Stats ====================

  async getMaintenanceStats(): Promise<MaintenanceStats> {
    const response = await api.get(`${this.baseUrl}/stats/maintenance`);
    return response.data;
  }

  async getOverdueMaintenance(): Promise<MaintenanceRecord[]> {
    const response = await api.get(`${this.baseUrl}/maintenance/overdue`);
    return response.data;
  }

  async getUpcomingMaintenance(days: number = 30): Promise<MaintenanceRecord[]> {
    const response = await api.get(`${this.baseUrl}/maintenance/upcoming?days=${days}`);
    return response.data;
  }

  async getExpiringCompliance(days: number = 30): Promise<{ asset: Asset; document: ComplianceDocument }[]> {
    const response = await api.get(`${this.baseUrl}/compliance/expiring?days=${days}`);
    return response.data;
  }

  // ==================== GPS Location ====================

  async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  watchPosition(callback: (position: GeolocationPosition) => void): number {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported');
    }

    return navigator.geolocation.watchPosition(
      callback,
      (error) => console.error('GPS Error:', error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  clearWatch(watchId: number): void {
    navigator.geolocation.clearWatch(watchId);
  }
}

export const assetAPI = new AssetAPI();
export default assetAPI;
