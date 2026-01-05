/**
 * Approvals API Client
 * Type-safe API client for approval workflow management
 */

import api from './api';

// Types
export interface ApprovalWorkflow {
  id: string;
  user_id: string;
  entity_type: 'job' | 'purchase_order' | 'stock_adjustment';
  entity_id: string;
  workflow_id?: string;
  current_stage: number;
  total_stages: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requested_by: string;
  requested_by_name?: string;
  requested_at: string;
  completed_at?: string;
  stages?: ApprovalStage[];
}

export interface ApprovalStage {
  id: string;
  approval_workflow_id: string;
  stage_number: number;
  approver_id: string;
  approver_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  responded_at?: string;
  created_at: string;
}

export interface ApprovalStats {
  total_approvals: number;
  pending_approvals: number;
  approved_approvals: number;
  rejected_approvals: number;
  pending_my_approvals: number;
  avg_approval_time?: number;
}

export interface CreateApprovalRequest {
  entity_type: 'job' | 'purchase_order' | 'stock_adjustment';
  entity_id: string;
  approvers: string[]; // Array of user IDs
}

export interface ApprovalActionRequest {
  comments?: string;
}

// API Methods
export const approvalsAPI = {
  /**
   * Get all approval workflows
   */
  getApprovals: async (filters?: {
    status?: string;
    entity_type?: string;
  }): Promise<ApprovalWorkflow[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.entity_type) params.append('entity_type', filters.entity_type);

    const response = await api.get(`/approvals?${params.toString()}`);
    return response.data;
  },

  /**
   * Get pending approvals for current user as approver
   */
  getPendingApprovals: async (): Promise<ApprovalWorkflow[]> => {
    const response = await api.get('/approvals/pending');
    return response.data;
  },

  /**
   * Get a specific approval workflow with stages
   */
  getApproval: async (id: string): Promise<ApprovalWorkflow> => {
    const response = await api.get(`/approvals/${id}`);
    return response.data;
  },

  /**
   * Create a new approval workflow
   */
  createApproval: async (data: CreateApprovalRequest): Promise<ApprovalWorkflow> => {
    const response = await api.post('/approvals', data);
    return response.data;
  },

  /**
   * Approve a stage
   */
  approve: async (id: string, comments?: string): Promise<ApprovalWorkflow> => {
    const response = await api.post(`/approvals/${id}/approve`, { comments });
    return response.data;
  },

  /**
   * Reject a stage
   */
  reject: async (id: string, comments: string): Promise<ApprovalWorkflow> => {
    const response = await api.post(`/approvals/${id}/reject`, { comments });
    return response.data;
  },

  /**
   * Cancel an approval workflow
   */
  cancel: async (id: string): Promise<ApprovalWorkflow> => {
    const response = await api.post(`/approvals/${id}/cancel`);
    return response.data;
  },

  /**
   * Get approval statistics
   */
  getStats: async (): Promise<ApprovalStats> => {
    const response = await api.get('/approvals/stats/summary');
    return response.data;
  }
};

export default approvalsAPI;
