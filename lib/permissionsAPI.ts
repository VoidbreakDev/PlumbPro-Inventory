// Permissions API Client
import api from './api';

// Types
export interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve?: boolean;
  export?: boolean;
}

export interface PermissionsConfig {
  inventory: Permission & { adjust_stock: boolean; transfer: boolean };
  jobs: Permission & { assign: boolean; complete: boolean };
  quotes: Permission & { send: boolean; convert: boolean };
  invoices: Permission & { send: boolean; record_payment: boolean };
  contacts: Permission;
  purchase_orders: Permission & { send: boolean; receive: boolean };
  reports: { view: boolean; export: boolean; create_custom: boolean };
  settings: { view: boolean; edit: boolean; manage_users: boolean; manage_integrations: boolean };
  team: { view: boolean; manage: boolean; view_wages: boolean };
}

export interface RoleTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  level: number;
  permissions: PermissionsConfig;
  quoteApprovalThreshold: number | null;
  poApprovalThreshold: number | null;
  isSystem: boolean;
  createdAt: string;
}

export interface CustomRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  baseTemplateId: string | null;
  baseTemplateName?: string;
  permissions: PermissionsConfig;
  quoteApprovalThreshold: number | null;
  poApprovalThreshold: number | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRole {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  roleName: string | null;
  roleDisplayName: string | null;
  roleType: 'template' | 'custom' | null;
  roleLevel: number;
  assignedAt: string | null;
  assignedBy: string | null;
}

export interface ApprovalWorkflow {
  id: string;
  entityType: 'quote' | 'purchase_order' | 'invoice' | 'stock_adjustment' | 'expense';
  name: string;
  description: string | null;
  thresholdMin: number | null;
  thresholdMax: number | null;
  requiredRoleLevel: number;
  requiredRoleName: string | null;
  requireMultipleApprovers: boolean;
  minApprovers: number;
  isActive: boolean;
  createdAt: string;
}

export interface PendingApproval {
  id: string;
  workflowId: string;
  workflowName: string;
  entityType: string;
  entityId: string;
  entityReference: string | null;
  amount: number | null;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  notes: string | null;
  expiresAt: string | null;
  approvalCount: number;
  requiredApprovals: number;
}

export interface ApprovalHistoryItem {
  id: string;
  pendingApprovalId: string;
  entityType: string;
  entityReference: string | null;
  amount: number | null;
  action: 'approved' | 'rejected';
  approverId: string;
  approverName: string;
  comments: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetUserId: string | null;
  targetUserName: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface CreateCustomRoleInput {
  name: string;
  displayName: string;
  description?: string;
  baseTemplateId?: string;
  permissions: Partial<PermissionsConfig>;
  quoteApprovalThreshold?: number;
  poApprovalThreshold?: number;
}

export interface CreateWorkflowInput {
  entityType: 'quote' | 'purchase_order' | 'invoice' | 'stock_adjustment' | 'expense';
  name: string;
  description?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  requiredRoleLevel: number;
  requireMultipleApprovers?: boolean;
  minApprovers?: number;
}

// API
export const permissionsAPI = {
  // Role Templates
  getRoleTemplates: async (): Promise<{ roles: RoleTemplate[] }> => {
    const { data } = await api.get('/permissions/roles');
    return data;
  },

  // Custom Roles
  getCustomRoles: async (): Promise<{ roles: CustomRole[] }> => {
    const { data } = await api.get('/permissions/custom-roles');
    return data;
  },

  createCustomRole: async (input: CreateCustomRoleInput): Promise<CustomRole> => {
    const { data } = await api.post('/permissions/custom-roles', input);
    return data;
  },

  updateCustomRole: async (id: string, updates: Partial<CreateCustomRoleInput>): Promise<CustomRole> => {
    const { data } = await api.put(`/permissions/custom-roles/${id}`, updates);
    return data;
  },

  deleteCustomRole: async (id: string): Promise<void> => {
    await api.delete(`/permissions/custom-roles/${id}`);
  },

  // User Role Assignments
  getUsersWithRoles: async (): Promise<{ users: UserWithRole[] }> => {
    const { data } = await api.get('/permissions/users');
    return data;
  },

  assignRoleToUser: async (
    userId: string,
    roleId: string,
    roleType: 'template' | 'custom'
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post(`/permissions/users/${userId}/role`, { roleId, roleType });
    return data;
  },

  removeRoleFromUser: async (userId: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/permissions/users/${userId}/role`);
    return data;
  },

  // Permission Checking
  checkPermission: async (permission: string): Promise<{ allowed: boolean; roleLevel: number }> => {
    const { data } = await api.get('/permissions/check', { params: { permission } });
    return data;
  },

  getMyPermissions: async (): Promise<{
    role: { name: string; displayName: string; level: number } | null;
    permissions: PermissionsConfig;
    approvalThresholds: { quote: number | null; po: number | null };
  }> => {
    const { data } = await api.get('/permissions/my-permissions');
    return data;
  },

  // Approval Workflows
  getWorkflows: async (entityType?: string): Promise<{ workflows: ApprovalWorkflow[] }> => {
    const { data } = await api.get('/permissions/workflows', { params: { entityType } });
    return data;
  },

  createWorkflow: async (input: CreateWorkflowInput): Promise<ApprovalWorkflow> => {
    const { data } = await api.post('/permissions/workflows', input);
    return data;
  },

  updateWorkflow: async (id: string, updates: Partial<CreateWorkflowInput> & { isActive?: boolean }): Promise<ApprovalWorkflow> => {
    const { data } = await api.put(`/permissions/workflows/${id}`, updates);
    return data;
  },

  deleteWorkflow: async (id: string): Promise<void> => {
    await api.delete(`/permissions/workflows/${id}`);
  },

  // Pending Approvals
  getPendingApprovals: async (options?: {
    entityType?: string;
    status?: string;
  }): Promise<{ approvals: PendingApproval[] }> => {
    const { data } = await api.get('/permissions/pending-approvals', { params: options });
    return data;
  },

  getMyPendingApprovals: async (): Promise<{ approvals: PendingApproval[] }> => {
    const { data } = await api.get('/permissions/my-pending-approvals');
    return data;
  },

  approveItem: async (id: string, comments?: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post(`/permissions/pending-approvals/${id}/approve`, { comments });
    return data;
  },

  rejectItem: async (id: string, comments?: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post(`/permissions/pending-approvals/${id}/reject`, { comments });
    return data;
  },

  // Approval History
  getApprovalHistory: async (options?: {
    entityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ history: ApprovalHistoryItem[]; total: number }> => {
    const { data } = await api.get('/permissions/approval-history', { params: options });
    return data;
  },

  // Audit Log
  getAuditLog: async (options?: {
    action?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> => {
    const { data } = await api.get('/permissions/audit-log', { params: options });
    return data;
  },
};

export default permissionsAPI;
