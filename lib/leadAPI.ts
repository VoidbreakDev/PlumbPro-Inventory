/**
 * Lead Pipeline API
 * Manages sales leads from inquiry to conversion
 */

import api from './api';
import type {
  Lead,
  LeadCommunication,
  LeadPipelineStats,
  CreateCustomerNoteInput,
} from '../types';

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeadFilters {
  status?: string;
  source?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

class LeadAPI {
  private baseUrl = '/api/leads';

  // ==================== Lead CRUD ====================

  async getLeads(filters: LeadFilters = {}): Promise<LeadsResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.source) params.append('source', filters.source);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.search) params.append('search', filters.search);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getLead(id: string): Promise<Lead> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createLead(lead: Omit<Lead, 'id' | 'leadNumber' | 'communications' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const response = await api.post(this.baseUrl, lead);
    return response.data;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const response = await api.put(`${this.baseUrl}/${id}`, updates);
    return response.data;
  }

  async deleteLead(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // ==================== Status Management ====================

  async updateStatus(id: string, status: Lead['status'], notes?: string): Promise<Lead> {
    const response = await api.patch(`${this.baseUrl}/${id}/status`, { status, notes });
    return response.data;
  }

  async convertToQuote(leadId: string, quoteData: any): Promise<{ lead: Lead; quote: any }> {
    const response = await api.post(`${this.baseUrl}/${leadId}/convert-to-quote`, quoteData);
    return response.data;
  }

  async markAsWon(leadId: string, data: { jobId?: string; customerId?: string; notes?: string }): Promise<Lead> {
    const response = await api.post(`${this.baseUrl}/${leadId}/won`, data);
    return response.data;
  }

  async markAsLost(leadId: string, reason: string, reasonDetail?: string): Promise<Lead> {
    const response = await api.post(`${this.baseUrl}/${leadId}/lost`, { reason, reasonDetail });
    return response.data;
  }

  // ==================== Communications ====================

  async addCommunication(leadId: string, communication: Omit<LeadCommunication, 'id' | 'leadId'>): Promise<LeadCommunication> {
    const response = await api.post(`${this.baseUrl}/${leadId}/communications`, communication);
    return response.data;
  }

  async getCommunications(leadId: string): Promise<LeadCommunication[]> {
    const response = await api.get(`${this.baseUrl}/${leadId}/communications`);
    return response.data;
  }

  // ==================== Follow-ups ====================

  async scheduleFollowUp(leadId: string, data: {
    date: string;
    type: LeadCommunication['method'];
    notes?: string;
  }): Promise<Lead> {
    const response = await api.post(`${this.baseUrl}/${leadId}/follow-up`, data);
    return response.data;
  }

  // ==================== Stats & Analytics ====================

  async getPipelineStats(period?: string): Promise<LeadPipelineStats> {
    const params = period ? `?period=${period}` : '';
    const response = await api.get(`${this.baseUrl}/stats${params}`);
    return response.data;
  }

  async getUpcomingFollowUps(days: number = 7): Promise<Lead[]> {
    const response = await api.get(`${this.baseUrl}/follow-ups/upcoming?days=${days}`);
    return response.data;
  }

  async getSources(): Promise<string[]> {
    const response = await api.get(`${this.baseUrl}/sources`);
    return response.data;
  }

  // ==================== Assignment ====================

  async assignLead(leadId: string, userId: string, userName: string): Promise<Lead> {
    const response = await api.patch(`${this.baseUrl}/${leadId}/assign`, { userId, userName });
    return response.data;
  }
}

export const leadAPI = new LeadAPI();
export default leadAPI;
