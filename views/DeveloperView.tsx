/**
 * Developer View
 * API key management, webhooks, and developer documentation
 */

import React, { useState, useEffect } from 'react';
import {
  Key,
  Webhook,
  Book,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Play,
  Clock,
  Activity,
  Shield,
  ExternalLink,
  Code,
  Zap,
  Send
} from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { MODULE_CATALOG, MODULE_STATUS_LABELS, MODULE_SURFACE_LABELS } from '../app/moduleCatalog';
import {
  apiAccessAPI,
  ApiKey,
  Webhook as WebhookType,
  ApiScope,
  WebhookEvent,
  WebhookDelivery
} from '../lib/apiAccessAPI';

type ActiveTab = 'keys' | 'webhooks' | 'docs';
type ConfirmationState = {
  title: string;
  description: string;
  confirmLabel: string;
  processingLabel?: string;
  variant?: 'default' | 'danger';
  errorMessage: string;
  action: () => Promise<void>;
};

export function DeveloperView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('keys');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; name: string } | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [showCreateWebhookModal, setShowCreateWebhookModal] = useState(false);
  const [newWebhookResult, setNewWebhookResult] = useState<{ secret: string; name: string } | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  // Docs state
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'keys') {
        const { keys } = await apiAccessAPI.getApiKeys();
        setApiKeys(keys);
      } else if (activeTab === 'webhooks') {
        const { webhooks: wh } = await apiAccessAPI.getWebhooks();
        setWebhooks(wh);
      } else if (activeTab === 'docs') {
        const [scopesRes, eventsRes] = await Promise.all([
          apiAccessAPI.getScopes(),
          apiAccessAPI.getEvents()
        ]);
        setScopes(scopesRes.scopes);
        setEvents(eventsRes.events);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const closeConfirmation = () => {
    if (!isConfirmingAction) {
      setConfirmation(null);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmation) {
      return;
    }

    setIsConfirmingAction(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (err) {
      setError(getErrorMessage(err, confirmation.errorMessage));
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const requestRevokeKey = (key: ApiKey) => {
    setConfirmation({
      title: `Revoke ${key.name}?`,
      description: `This permanently revokes ${key.name}. Integrations using ${key.keyPrefix}... will stop working immediately.`,
      confirmLabel: 'Revoke Key',
      processingLabel: 'Revoking...',
      variant: 'danger',
      errorMessage: 'Failed to revoke API key',
      action: async () => {
        await apiAccessAPI.revokeApiKey(key.id);
        setSuccess('API key revoked');
        await loadData();
      }
    });
  };

  const requestRegenerateKey = (key: ApiKey) => {
    setConfirmation({
      title: `Regenerate ${key.name}?`,
      description: `This creates a new secret for ${key.name}. The current key ${key.keyPrefix}... will stop working immediately.`,
      confirmLabel: 'Regenerate Key',
      processingLabel: 'Regenerating...',
      variant: 'default',
      errorMessage: 'Failed to regenerate API key',
      action: async () => {
        const result = await apiAccessAPI.regenerateApiKey(key.id);
        setNewKeyResult({ key: result.key!, name: result.name });
        setSuccess('API key regenerated');
        await loadData();
      }
    });
  };

  const handleToggleKey = async (key: ApiKey) => {
    try {
      await apiAccessAPI.updateApiKey(key.id, { isActive: !key.isActive });
      setSuccess(`API key ${key.isActive ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update API key'));
    }
  };

  const requestDeleteWebhook = (webhook: WebhookType) => {
    setConfirmation({
      title: `Delete ${webhook.name}?`,
      description: `This removes the webhook endpoint ${webhook.url}. PlumbPro will stop sending ${webhook.events.length} subscribed event${webhook.events.length === 1 ? '' : 's'}.`,
      confirmLabel: 'Delete Webhook',
      processingLabel: 'Deleting...',
      variant: 'danger',
      errorMessage: 'Failed to delete webhook',
      action: async () => {
        await apiAccessAPI.deleteWebhook(webhook.id);
        setSuccess('Webhook deleted');
        await loadData();
      }
    });
  };

  const handleToggleWebhook = async (webhook: WebhookType) => {
    try {
      await apiAccessAPI.updateWebhook(webhook.id, { isActive: !webhook.isActive });
      setSuccess(`Webhook ${webhook.isActive ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update webhook'));
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await apiAccessAPI.testWebhook(webhookId);
      setSuccess('Test webhook sent successfully');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to test webhook'));
    }
  };

  const loadWebhookDeliveries = async (webhookId: string) => {
    try {
      const { deliveries } = await apiAccessAPI.getWebhookDeliveries(webhookId);
      setWebhookDeliveries(deliveries);
      setSelectedWebhook(webhookId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load deliveries'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="space-y-6 p-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Developer</h1>
          <p className="text-slate-600 mt-1">Manage API keys, webhooks, and integrations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {activeTab === 'keys' && (
            <button
              onClick={() => setShowCreateKeyModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create API Key
            </button>
          )}
          {activeTab === 'webhooks' && (
            <button
              onClick={() => setShowCreateWebhookModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Webhook
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'webhooks', label: 'Webhooks', icon: Webhook },
          { id: 'docs', label: 'Documentation', icon: Book },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      )}

      {/* API Keys Tab */}
      {!loading && activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">API Key Security</h4>
                <p className="text-sm text-blue-700 mt-1">
                  API keys grant access to your PlumbPro data. Keep them secure and never share them publicly.
                  Rotate keys periodically and revoke any compromised keys immediately.
                </p>
              </div>
            </div>
          </div>

          {/* API Keys List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your API Keys</h2>
            </div>
            {apiKeys.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{key.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            key.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {key.isActive ? 'Active' : 'Disabled'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            key.environment === 'production' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {key.environment}
                          </span>
                        </div>
                        {key.description && (
                          <p className="text-sm text-gray-500 mt-1">{key.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">
                            {key.keyPrefix}...
                          </code>
                          <span className="text-xs text-gray-500">
                            Created {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                          {key.lastUsedAt && (
                            <span className="text-xs text-gray-500">
                              Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {key.scopes.slice(0, 3).map((scope) => (
                            <span key={scope} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {scope}
                            </span>
                          ))}
                          {key.scopes.length > 3 && (
                            <span className="text-xs text-gray-500">+{key.scopes.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleKey(key)}
                          className={`p-2 rounded-lg transition-colors ${
                            key.isActive
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={key.isActive ? 'Disable' : 'Enable'}
                        >
                          {key.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => requestRegenerateKey(key)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                          title="Regenerate"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => requestRevokeKey(key)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                          title="Revoke"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Key className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No API keys created yet</p>
                <button
                  onClick={() => setShowCreateKeyModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Create your first API key
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {!loading && activeTab === 'webhooks' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-900">Real-time Notifications</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Webhooks send real-time HTTP notifications to your server when events occur in PlumbPro.
                  Use them to keep external systems synchronized.
                </p>
              </div>
            </div>
          </div>

          {/* Webhooks List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Webhooks</h2>
            </div>
            {webhooks.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            webhook.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {webhook.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        {webhook.description && (
                          <p className="text-sm text-gray-500 mt-1">{webhook.description}</p>
                        )}
                        <div className="mt-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700 break-all">
                            {webhook.url}
                          </code>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {webhook.events.slice(0, 3).map((event) => (
                            <span key={event} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                              {event}
                            </span>
                          ))}
                          {webhook.events.length > 3 && (
                            <span className="text-xs text-gray-500">+{webhook.events.length - 3} more</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {webhook.successCount} delivered
                          </span>
                          <span className="flex items-center gap-1">
                            <X className="w-3 h-3 text-red-500" />
                            {webhook.failureCount} failed
                          </span>
                          {webhook.lastTriggeredAt && (
                            <span>Last triggered {new Date(webhook.lastTriggeredAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestWebhook(webhook.id)}
                          className="text-purple-600 hover:text-purple-800 p-2 rounded-lg hover:bg-purple-50"
                          title="Test webhook"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadWebhookDeliveries(webhook.id)}
                          className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-50"
                          title="View deliveries"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleWebhook(webhook)}
                          className={`p-2 rounded-lg transition-colors ${
                            webhook.isActive
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={webhook.isActive ? 'Disable' : 'Enable'}
                        >
                          {webhook.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => requestDeleteWebhook(webhook)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Webhook className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No webhooks configured yet</p>
                <button
                  onClick={() => setShowCreateWebhookModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Create your first webhook
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {!loading && activeTab === 'docs' && (
        <div className="space-y-6">
          {/* Quick Start */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Authentication</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Include your API key in the Authorization header:
                </p>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-green-400 text-sm">
                    Authorization: Bearer pp_live_your_api_key_here
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Base URL</h4>
                <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <code className="text-sm font-mono">https://api.plumbpro.app/v1</code>
                  <button
                    onClick={() => copyToClipboard('https://api.plumbpro.app/v1')}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Example Request</h4>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm">
                    <code className="text-blue-400">curl</code>
                    <code className="text-white"> -X GET \{'\n'}</code>
                    <code className="text-white">  </code>
                    <code className="text-yellow-400">"https://api.plumbpro.app/v1/inventory"</code>
                    <code className="text-white"> \{'\n'}</code>
                    <code className="text-white">  -H </code>
                    <code className="text-green-400">"Authorization: Bearer pp_live_..."</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Available Scopes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Scopes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scopes.map((scope) => (
                <div key={scope.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <code className="text-sm font-medium text-gray-900">{scope.name}</code>
                    <p className="text-xs text-gray-500 mt-1">{scope.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module Surface Area */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Module Surface Area</h2>
            <div className="space-y-3">
              {MODULE_CATALOG.map((module) => (
                <div key={module.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-gray-900">{module.label}</h3>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {MODULE_SURFACE_LABELS[module.surface]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          module.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : module.status === 'beta'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-200 text-gray-700'
                        }`}>
                          {MODULE_STATUS_LABELS[module.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{module.notes}</p>
                    </div>
                    <div className="space-y-1 text-sm text-gray-500 md:text-right">
                      {module.route && (
                        <div>
                          <span className="font-medium text-gray-700">Route:</span>{' '}
                          <code className="rounded bg-white px-1.5 py-0.5 text-xs">{module.route}</code>
                        </div>
                      )}
                      {module.roles && (
                        <div>
                          <span className="font-medium text-gray-700">Roles:</span> {module.roles.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Events */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Webhook Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {events.map((event) => (
                <div key={event.name} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Zap className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <code className="text-sm font-medium text-gray-900">{event.name}</code>
                    <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Per Minute</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">60</p>
                <p className="text-sm text-gray-500">requests / minute</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Per Day</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">10,000</p>
                <p className="text-sm text-gray-500">requests / day</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Rate limit headers are included in every response: <code className="bg-gray-100 px-1 rounded">X-RateLimit-Remaining</code> and <code className="bg-gray-100 px-1 rounded">X-RateLimit-Reset</code>
            </p>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateKeyModal && (
        <CreateApiKeyModal
          scopes={scopes}
          onClose={() => setShowCreateKeyModal(false)}
          onSuccess={(result) => {
            setShowCreateKeyModal(false);
            setNewKeyResult({ key: result.key!, name: result.name });
            loadData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Create Webhook Modal */}
      {showCreateWebhookModal && (
        <CreateWebhookModal
          events={events}
          onClose={() => setShowCreateWebhookModal(false)}
          onSuccess={(result) => {
            setShowCreateWebhookModal(false);
            setNewWebhookResult({ secret: result.secret!, name: result.name });
            loadData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* New Key Result Modal */}
      {newKeyResult && (
        <NewKeyModal
          keyValue={newKeyResult.key}
          name={newKeyResult.name}
          onClose={() => setNewKeyResult(null)}
          onCopy={copyToClipboard}
        />
      )}

      {/* New Webhook Secret Modal */}
      {newWebhookResult && (
        <NewSecretModal
          secret={newWebhookResult.secret}
          name={newWebhookResult.name}
          onClose={() => setNewWebhookResult(null)}
          onCopy={copyToClipboard}
        />
      )}

      {/* Webhook Deliveries Modal */}
      {selectedWebhook && (
        <WebhookDeliveriesModal
          deliveries={webhookDeliveries}
          onClose={() => {
            setSelectedWebhook(null);
            setWebhookDeliveries([]);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={confirmation !== null}
        title={confirmation?.title || ''}
        description={confirmation?.description || ''}
        confirmLabel={confirmation?.confirmLabel || 'Confirm'}
        processingLabel={confirmation?.processingLabel}
        variant={confirmation?.variant}
        isProcessing={isConfirmingAction}
        onConfirm={handleConfirmedAction}
        onClose={closeConfirmation}
      />
    </div>
  );
}

// Create API Key Modal
function CreateApiKeyModal({
  scopes,
  onClose,
  onSuccess,
  onError
}: {
  scopes: ApiScope[];
  onClose: () => void;
  onSuccess: (result: ApiKey) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'test'>('production');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['inventory:read', 'jobs:read']);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await apiAccessAPI.createApiKey({
        name,
        description: description || undefined,
        scopes: selectedScopes,
        environment
      });
      onSuccess(result);
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create API key'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create API Key</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="My Integration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What this key will be used for..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="production"
                  checked={environment === 'production'}
                  onChange={() => setEnvironment('production')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Production</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="test"
                  checked={environment === 'test'}
                  onChange={() => setEnvironment('test')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Test</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
            <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {scopes.map((scope) => (
                <label key={scope.name} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.name)}
                    onChange={() => toggleScope(scope.name)}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5"
                  />
                  <div>
                    <code className="text-sm font-medium text-gray-900">{scope.name}</code>
                    <p className="text-xs text-gray-500">{scope.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || selectedScopes.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Webhook Modal
function CreateWebhookModal({
  events,
  onClose,
  onSuccess,
  onError
}: {
  events: WebhookEvent[];
  onClose: () => void;
  onSuccess: (result: WebhookType) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await apiAccessAPI.createWebhook({
        name,
        description: description || undefined,
        url,
        events: selectedEvents
      });
      onSuccess(result);
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create webhook'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Webhook</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="My Webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://your-server.com/webhooks/plumbpro"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What this webhook will be used for..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
            <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {events.map((event) => (
                <label key={event.name} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.name)}
                    onChange={() => toggleEvent(event.name)}
                    className="w-4 h-4 text-purple-600 rounded mt-0.5"
                  />
                  <div>
                    <code className="text-sm font-medium text-gray-900">{event.name}</code>
                    <p className="text-xs text-gray-500">{event.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !url.trim() || selectedEvents.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Key Modal (shows the key only once)
function NewKeyModal({
  keyValue,
  name,
  onClose,
  onCopy
}: {
  keyValue: string;
  name: string;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">API Key Created</h2>
              <p className="text-sm text-gray-500">{name}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Save this key now</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  This is the only time you'll see this API key. Copy it and store it securely.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between gap-3">
            <code className="text-sm font-mono text-gray-900 break-all">{keyValue}</code>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                copied ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 text-gray-600'
              }`}
            >
              {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// New Secret Modal (shows the webhook secret only once)
function NewSecretModal({
  secret,
  name,
  onClose,
  onCopy
}: {
  secret: string;
  name: string;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Webhook Created</h2>
              <p className="text-sm text-gray-500">{name}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Save this secret now</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Use this secret to verify webhook signatures. This is the only time you'll see it.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between gap-3">
            <code className="text-sm font-mono text-gray-900 break-all">{secret}</code>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                copied ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 text-gray-600'
              }`}
            >
              {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Webhook Deliveries Modal
function WebhookDeliveriesModal({
  deliveries,
  onClose
}: {
  deliveries: WebhookDelivery[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Delivery History</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {deliveries.length > 0 ? (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-medium text-purple-700">{delivery.eventType}</code>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      delivery.status === 'success' ? 'bg-green-100 text-green-700' :
                      delivery.status === 'failed' ? 'bg-red-100 text-red-700' :
                      delivery.status === 'retrying' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {delivery.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{new Date(delivery.createdAt).toLocaleString()}</span>
                    {delivery.responseStatusCode && (
                      <span>HTTP {delivery.responseStatusCode}</span>
                    )}
                    {delivery.responseTimeMs && (
                      <span>{delivery.responseTimeMs}ms</span>
                    )}
                    <span>Attempts: {delivery.attemptCount}</span>
                  </div>
                  {delivery.errorMessage && (
                    <p className="text-sm text-red-600 mt-2">{delivery.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No deliveries yet</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
