/**
 * Workflow Automation View
 * Manage automated workflows for inventory, jobs, and notifications
 */

import React, { useState, useEffect } from 'react';
import workflowAPI, { Workflow, WorkflowTemplate, WorkflowStats } from '../lib/workflowAPI';

const WorkflowAutomationView: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates' | 'executions'>('workflows');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

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
      console.error('Failed to load workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWorkflow = async (id: string) => {
    try {
      const updated = await workflowAPI.toggleWorkflow(id);
      setWorkflows(workflows.map(w => w.id === id ? updated : w));
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  const handleExecuteWorkflow = async (id: string) => {
    try {
      await workflowAPI.executeWorkflow(id);
      alert('Workflow executed successfully');
      loadData();
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('Failed to execute workflow');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await workflowAPI.deleteWorkflow(id);
      setWorkflows(workflows.filter(w => w.id !== id));
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      const name = prompt('Enter workflow name:', template?.name);
      if (!name) return;

      await workflowAPI.createFromTemplate(templateId, name);
      loadData();
      alert('Workflow created successfully');
    } catch (error) {
      console.error('Failed to create from template:', error);
      alert('Failed to create workflow');
    }
  };

  const getTriggerTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      stock_level: 'Stock Level',
      job_status: 'Job Status',
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
                      onClick={() => handleDeleteWorkflow(workflow.id)}
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
    </div>
  );
};

export default WorkflowAutomationView;
