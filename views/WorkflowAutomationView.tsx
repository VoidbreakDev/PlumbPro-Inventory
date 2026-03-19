/**
 * Workflow Automation View
 * Manage automated workflows for inventory, jobs, and notifications
 */

import React, { useState, useEffect } from 'react';
import workflowAPI, { Workflow, WorkflowTemplate, WorkflowStats } from '../lib/workflowAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { useToast } from '../components/ToastNotification';

const WorkflowAutomationView: React.FC = () => {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates' | 'executions'>('workflows');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [templateToCreate, setTemplateToCreate] = useState<WorkflowTemplate | null>(null);
  const [templateWorkflowName, setTemplateWorkflowName] = useState('');
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger_type: 'manual' as Workflow['trigger_type'],
    priority: 5,
    is_active: true
  });
  const setError = useStore((state) => state.setError);

  useEffect(() => {
    loadData();
  }, [filterActive]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workflowsData, templatesData, statsData] = await Promise.all([
        workflowAPI.getWorkflows({ is_active: filterActive }),
        workflowAPI.getTemplates(),
        workflowAPI.getStats()
      ]);

      setWorkflows(workflowsData);
      setTemplates(templatesData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load workflow data'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWorkflow = async (id: string) => {
    try {
      const updated = await workflowAPI.toggleWorkflow(id);
      setWorkflows(workflows.map(w => w.id === id ? updated : w));
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to toggle workflow'));
    }
  };

  const handleExecuteWorkflow = async (id: string) => {
    try {
      await workflowAPI.executeWorkflow(id);
      toast.success('Workflow executed successfully');
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to execute workflow'));
      toast.error('Failed to execute workflow');
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return;
    try {
      await workflowAPI.deleteWorkflow(workflowToDelete.id);
      setWorkflows(workflows.filter(w => w.id !== workflowToDelete.id));
      toast.success(`Deleted workflow "${workflowToDelete.name}"`);
      setWorkflowToDelete(null);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete workflow'));
      toast.error('Failed to delete workflow');
    }
  };

  const handleCreateFromTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setTemplateToCreate(template);
    setTemplateWorkflowName(template.name);
  };

  const handleConfirmCreateFromTemplate = async () => {
    if (!templateToCreate || !templateWorkflowName.trim()) {
      toast.warning('Workflow name is required');
      return;
    }

    try {
      await workflowAPI.createFromTemplate(templateToCreate.id, templateWorkflowName.trim());
      loadData();
      toast.success('Workflow created successfully');
      setTemplateToCreate(null);
      setTemplateWorkflowName('');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create workflow from template'));
      toast.error('Failed to create workflow');
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) {
      toast.warning('Workflow name is required');
      return;
    }

    try {
      await workflowAPI.createWorkflow({
        name: newWorkflow.name.trim(),
        description: newWorkflow.description.trim() || undefined,
        trigger_type: newWorkflow.trigger_type,
        trigger_config: {},
        priority: newWorkflow.priority,
        is_active: newWorkflow.is_active,
        actions: []
      });
      toast.success('Workflow created successfully');
      setShowCreateModal(false);
      setNewWorkflow({
        name: '',
        description: '',
        trigger_type: 'manual',
        priority: 5,
        is_active: true
      });
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create workflow'));
      toast.error('Failed to create workflow');
    }
  };

  const getTriggerTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      stock_level: 'Stock Level',
      job_status: 'Job Status',
      project_stage: 'Project Stage',
      time_schedule: 'Scheduled',
      manual: 'Manual',
      webhook: 'Webhook'
    };
    return labels[type] || type;
  };

  const getTriggerTypeBadge = (type: string): string => {
    const colors: Record<string, string> = {
      stock_level: 'bg-blue-100 text-blue-800',
      job_status: 'bg-green-100 text-green-800',
      project_stage: 'bg-indigo-100 text-indigo-800',
      time_schedule: 'bg-purple-100 text-purple-800',
      manual: 'bg-gray-100 text-gray-800',
      webhook: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading workflow data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
          <p className="text-gray-600 mt-1">Automate your inventory and job management tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Workflow
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Total Workflows</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {stats.workflows.total_workflows}
            </div>
            <div className="text-green-600 text-sm mt-1">
              {stats.workflows.active_workflows} active
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Executions (30d)</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {stats.executions.total_executions}
            </div>
            <div className="text-green-600 text-sm mt-1">
              {stats.executions.successful_executions} successful
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Success Rate</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {stats.executions.total_executions > 0
                ? Math.round((stats.executions.successful_executions / stats.executions.total_executions) * 100)
                : 0}%
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Avg Execution Time</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {Math.round(stats.executions.avg_execution_time || 0)}ms
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'workflows'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Workflows ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('executions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'executions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Execution History
          </button>
        </nav>
      </div>

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterActive(undefined)}
              className={`px-3 py-1 rounded ${
                filterActive === undefined ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterActive(true)}
              className={`px-3 py-1 rounded ${
                filterActive === true ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterActive(false)}
              className={`px-3 py-1 rounded ${
                filterActive === false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Workflow List */}
          <div className="grid grid-cols-1 gap-4">
            {workflows.map(workflow => (
              <div key={workflow.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTriggerTypeBadge(workflow.trigger_type)}`}>
                        {getTriggerTypeLabel(workflow.trigger_type)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-gray-600 mt-2">{workflow.description}</p>
                    )}
                    <div className="text-sm text-gray-500 mt-2">
                      Priority: {workflow.priority} | Created: {new Date(workflow.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleWorkflow(workflow.id)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      {workflow.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleExecuteWorkflow(workflow.id)}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={() => setSelectedWorkflow(workflow)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setWorkflowToDelete(workflow)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {workflows.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No workflows found. Create one to get started!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2">{template.description}</p>
                  <div className="text-sm text-gray-500 mt-2">
                    {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleCreateFromTemplate(template.id)}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Execution History Tab */}
      {activeTab === 'executions' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Select a workflow from the Workflows tab to view its execution history
          </p>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create Workflow</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow((current) => ({ ...current, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Low stock notification"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow((current) => ({ ...current, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Trigger</label>
                  <select
                    value={newWorkflow.trigger_type}
                    onChange={(e) => setNewWorkflow((current) => ({ ...current, trigger_type: e.target.value as Workflow['trigger_type'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="stock_level">Stock Level</option>
                    <option value="job_status">Job Status</option>
                    <option value="project_stage">Project Stage</option>
                    <option value="time_schedule">Scheduled</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newWorkflow.priority}
                    onChange={(e) => setNewWorkflow((current) => ({ ...current, priority: Number(e.target.value) || 5 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newWorkflow.is_active}
                  onChange={(e) => setNewWorkflow((current) => ({ ...current, is_active: e.target.checked }))}
                />
                Activate immediately
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {workflowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete workflow?</h2>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove <strong>{workflowToDelete.name}</strong>.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setWorkflowToDelete(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkflow}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {templateToCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Create from template</h2>
            <p className="mt-2 text-sm text-gray-600">
              Create a workflow from <strong>{templateToCreate.name}</strong>.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Workflow name</label>
              <input
                type="text"
                value={templateWorkflowName}
                onChange={(e) => setTemplateWorkflowName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setTemplateToCreate(null);
                  setTemplateWorkflowName('');
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateFromTemplate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowAutomationView;
