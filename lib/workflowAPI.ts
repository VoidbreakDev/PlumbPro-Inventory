/**
 * Workflow Automation API Client
 * Type-safe API client for workflow management
 */

import api from './api';

// Types
export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  trigger_type: 'stock_level' | 'job_status' | 'time_schedule' | 'manual' | 'webhook';
  trigger_config: Record<string, any>;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  actions?: WorkflowAction[];
}

export interface WorkflowAction {
  id?: string;
  workflow_id?: string;
  action_order: number;
  action_type: 'send_notification' | 'send_email' | 'create_job' | 'update_stock' |
                'assign_worker' | 'create_purchase_order' | 'webhook' | 'update_job_status' |
                'delay' | 'conditional';
  action_config: Record<string, any>;
  retry_on_failure: boolean;
  max_retries: number;
  created_at?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  trigger_data?: Record<string, any>;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  execution_time_ms?: number;
}

export interface WorkflowActionLog {
  id: string;
  execution_id: string;
  action_id: string;
  action_type: string;
  action_order: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'inventory' | 'jobs' | 'notifications' | 'reporting';
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: WorkflowAction[];
  is_public: boolean;
  created_at: string;
}

export interface WorkflowStats {
  workflows: {
    total_workflows: number;
    active_workflows: number;
    trigger_types: number;
  };
  executions: {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    avg_execution_time: number;
  };
  topWorkflows: Array<{
    id: string;
    name: string;
    execution_count: number;
  }>;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  is_active?: boolean;
  priority?: number;
  actions?: WorkflowAction[];
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  trigger_type?: string;
  trigger_config?: Record<string, any>;
  is_active?: boolean;
  priority?: number;
}

// API Methods
export const workflowAPI = {
  /**
   * Get all workflows
   */
  getWorkflows: async (filters?: {
    trigger_type?: string;
    is_active?: boolean;
  }): Promise<Workflow[]> => {
    const params = new URLSearchParams();
    if (filters?.trigger_type) params.append('trigger_type', filters.trigger_type);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));

    const response = await api.get(`/workflows?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a specific workflow with actions
   */
  getWorkflow: async (id: string): Promise<Workflow> => {
    const response = await api.get(`/workflows/${id}`);
    return response.data;
  },

  /**
   * Create a new workflow
   */
  createWorkflow: async (data: CreateWorkflowRequest): Promise<Workflow> => {
    const response = await api.post('/workflows', data);
    return response.data;
  },

  /**
   * Update a workflow
   */
  updateWorkflow: async (id: string, data: UpdateWorkflowRequest): Promise<Workflow> => {
    const response = await api.put(`/workflows/${id}`, data);
    return response.data;
  },

  /**
   * Delete a workflow
   */
  deleteWorkflow: async (id: string): Promise<void> => {
    await api.delete(`/workflows/${id}`);
  },

  /**
   * Execute a workflow manually
   */
  executeWorkflow: async (id: string, triggerData?: Record<string, any>): Promise<{ success: boolean; executionId: string }> => {
    const response = await api.post(`/workflows/${id}/execute`, { trigger_data: triggerData });
    return response.data;
  },

  /**
   * Toggle workflow active status
   */
  toggleWorkflow: async (id: string): Promise<Workflow> => {
    const response = await api.post(`/workflows/${id}/toggle`);
    return response.data;
  },

  /**
   * Get execution history for a workflow
   */
  getExecutions: async (workflowId: string, limit = 50, offset = 0): Promise<WorkflowExecution[]> => {
    const response = await api.get(`/workflows/${workflowId}/executions?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  /**
   * Get action logs for an execution
   */
  getExecutionLogs: async (executionId: string): Promise<WorkflowActionLog[]> => {
    const response = await api.get(`/workflows/executions/${executionId}/logs`);
    return response.data;
  },

  /**
   * Get workflow templates
   */
  getTemplates: async (category?: string): Promise<WorkflowTemplate[]> => {
    const params = category ? `?category=${category}` : '';
    const response = await api.get(`/workflows/templates/list${params}`);
    return response.data;
  },

  /**
   * Create workflow from template
   */
  createFromTemplate: async (
    templateId: string,
    name?: string,
    customConfig?: Record<string, any>
  ): Promise<Workflow> => {
    const response = await api.post(`/workflows/from-template/${templateId}`, {
      name,
      customConfig
    });
    return response.data;
  },

  /**
   * Trigger workflows manually
   */
  triggerWorkflows: async (triggerType: string, triggerData?: Record<string, any>): Promise<void> => {
    await api.post('/workflows/trigger', { trigger_type: triggerType, trigger_data: triggerData });
  },

  /**
   * Get workflow statistics
   */
  getStats: async (): Promise<WorkflowStats> => {
    const response = await api.get('/workflows/stats/summary');
    return response.data;
  }
};

export default workflowAPI;
