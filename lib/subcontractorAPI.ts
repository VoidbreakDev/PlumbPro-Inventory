/**
 * Subcontractor Management API
 * Manages subcontractors, their compliance documents, and job assignments
 */

import api from './api';
import type {
  Subcontractor,
  InsuranceDocument,
  LicenseDocument,
  SubcontractorJob,
} from '../types';

export interface SubcontractorsResponse {
  subcontractors: Subcontractor[];
  total: number;
}

export interface ComplianceSummary {
  totalSubcontractors: number;
  compliant: number;
  pending: number;
  nonCompliant: number;
  expiringInsurance: number;
  expiringLicenses: number;
}

class SubcontractorAPI {
  private baseUrl = '/subcontractors';

  // ==================== Subcontractor CRUD ====================

  async getSubcontractors(filters?: {
    tradeType?: string;
    complianceStatus?: string;
    availability?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<SubcontractorsResponse> {
    const params = new URLSearchParams();
    if (filters?.tradeType) params.append('tradeType', filters.tradeType);
    if (filters?.complianceStatus) params.append('complianceStatus', filters.complianceStatus);
    if (filters?.availability) params.append('availability', filters.availability);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getSubcontractor(id: string): Promise<Subcontractor> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createSubcontractor(
    subcontractor: Omit<Subcontractor, 'id' | 'createdAt' | 'updatedAt' | 'type'>
  ): Promise<Subcontractor> {
    const response = await api.post(this.baseUrl, { ...subcontractor, type: 'Subcontractor' });
    return response.data;
  }

  async updateSubcontractor(id: string, updates: Partial<Subcontractor>): Promise<Subcontractor> {
    const response = await api.put(`${this.baseUrl}/${id}`, updates);
    return response.data;
  }

  async deleteSubcontractor(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // ==================== Insurance Documents ====================

  async addInsuranceDocument(
    subcontractorId: string,
    document: Omit<InsuranceDocument, 'id'>
  ): Promise<InsuranceDocument> {
    const response = await api.post(`${this.baseUrl}/${subcontractorId}/insurance`, document);
    return response.data;
  }

  async updateInsuranceDocument(
    subcontractorId: string,
    documentId: string,
    updates: Partial<InsuranceDocument>
  ): Promise<InsuranceDocument> {
    const response = await api.put(`${this.baseUrl}/${subcontractorId}/insurance/${documentId}`, updates);
    return response.data;
  }

  async deleteInsuranceDocument(subcontractorId: string, documentId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${subcontractorId}/insurance/${documentId}`);
  }

  async verifyInsuranceDocument(
    subcontractorId: string,
    documentId: string,
    verifiedBy: string
  ): Promise<InsuranceDocument> {
    const response = await api.post(`${this.baseUrl}/${subcontractorId}/insurance/${documentId}/verify`, {
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
    return response.data;
  }

  // ==================== License Documents ====================

  async addLicenseDocument(
    subcontractorId: string,
    document: Omit<LicenseDocument, 'id'>
  ): Promise<LicenseDocument> {
    const response = await api.post(`${this.baseUrl}/${subcontractorId}/licenses`, document);
    return response.data;
  }

  async updateLicenseDocument(
    subcontractorId: string,
    documentId: string,
    updates: Partial<LicenseDocument>
  ): Promise<LicenseDocument> {
    const response = await api.put(`${this.baseUrl}/${subcontractorId}/licenses/${documentId}`, updates);
    return response.data;
  }

  async deleteLicenseDocument(subcontractorId: string, documentId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${subcontractorId}/licenses/${documentId}`);
  }

  async verifyLicenseDocument(
    subcontractorId: string,
    documentId: string,
    verifiedBy: string
  ): Promise<LicenseDocument> {
    const response = await api.post(`${this.baseUrl}/${subcontractorId}/licenses/${documentId}/verify`, {
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
    return response.data;
  }

  // ==================== Subcontractor Jobs ====================

  async getSubcontractorJobs(subcontractorId: string): Promise<SubcontractorJob[]> {
    const response = await api.get(`${this.baseUrl}/${subcontractorId}/jobs`);
    return response.data;
  }

  async assignJob(data: Omit<SubcontractorJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubcontractorJob> {
    const response = await api.post(`${this.baseUrl}/${data.subcontractorId}/jobs`, data);
    return response.data;
  }

  async updateJobStatus(
    subcontractorId: string,
    jobId: string,
    status: SubcontractorJob['status'],
    notes?: string
  ): Promise<SubcontractorJob> {
    const response = await api.put(`${this.baseUrl}/${subcontractorId}/jobs/${jobId}`, { status, notes });
    return response.data;
  }

  async rateSubcontractor(
    subcontractorId: string,
    jobId: string,
    rating: {
      rating: number;
      review?: string;
      wouldRecommend: boolean;
    }
  ): Promise<SubcontractorJob> {
    const response = await api.post(`${this.baseUrl}/${subcontractorId}/jobs/${jobId}/rate`, rating);
    return response.data;
  }

  // ==================== Compliance & Stats ====================

  async getComplianceSummary(): Promise<ComplianceSummary> {
    const response = await api.get(`${this.baseUrl}/compliance/summary`);
    return response.data;
  }

  async getExpiringDocuments(days: number = 30): Promise<{
    insurance: { subcontractor: Subcontractor; document: InsuranceDocument }[];
    licenses: { subcontractor: Subcontractor; document: LicenseDocument }[];
  }> {
    const response = await api.get(`${this.baseUrl}/compliance/expiring?days=${days}`);
    return response.data;
  }

  async getTradeTypes(): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/trade-types`);
    return response.data;
  }

  // ==================== ABN Verification ====================

  async verifyABN(abn: string): Promise<{
    valid: boolean;
    businessName?: string;
    tradingName?: string;
    status?: string;
    message?: string;
  }> {
    const response = await api.post(`${this.baseUrl}/verify-abn`, { abn });
    return response.data;
  }
}

export const subcontractorAPI = new SubcontractorAPI();
export default subcontractorAPI;
