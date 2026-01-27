
import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  ChevronRight,
  Truck,
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  Settings,
  BarChart3,
  Package,
  Clock,
  RefreshCw,
  X,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Calendar,
  TrendingDown,
  Activity
} from 'lucide-react';
import {
  InventoryItem,
  Job,
  SmartOrderSuggestion,
  ReorderAlert,
  ReorderRule,
  SmartOrderingDashboard,
  UsageAnalytics,
  CreateReorderRuleInput,
  ForecastResponse,
  ItemForecast
} from '../types';
import { Badge } from '../components/Shared';
import { smartOrderingAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import purchaseOrdersAPI from '../lib/purchaseOrdersAPI';

interface OrderingViewProps {
  inventory: InventoryItem[];
  jobs: Job[];
}

type TabType = 'dashboard' | 'alerts' | 'rules' | 'forecasts' | 'suggestions';

export const OrderingView: React.FC<OrderingViewProps> = ({ inventory, jobs }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [suggestions, setSuggestions] = useState<SmartOrderSuggestion[]>([]);
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [rules, setRules] = useState<ReorderRule[]>([]);
  const [dashboard, setDashboard] = useState<SmartOrderingDashboard | null>(null);
  const [forecasts, setForecasts] = useState<ForecastResponse | null>(null);
  const [selectedItemUsage, setSelectedItemUsage] = useState<UsageAnalytics | null>(null);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCreatingPOs, setIsCreatingPOs] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [forecastDays, setForecastDays] = useState(30);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ReorderRule | null>(null);

  const setError = useStore((state) => state.setError);
  const contacts = useStore((state) => state.contacts);

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'alerts') {
      loadAlerts();
    } else if (activeTab === 'rules') {
      loadRules();
    } else if (activeTab === 'forecasts') {
      loadForecasts();
    }
  }, [activeTab, forecastDays]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await smartOrderingAPI.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await smartOrderingAPI.getAlerts();
      setAlerts(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load alerts'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const data = await smartOrderingAPI.getRules();
      setRules(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load rules'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadForecasts = async () => {
    setIsLoading(true);
    try {
      const data = await smartOrderingAPI.getForecasts(forecastDays);
      setForecasts(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load forecasts'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const result = await smartOrderingAPI.getSuggestions();
      setSuggestions(result.suggestions || []);
    } catch (err) {
      const message = getErrorMessage(
        err,
        'Failed to generate suggestions. Please check your Gemini API key in Settings.'
      );
      setError(message);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCheckAllStock = async () => {
    setIsCheckingStock(true);
    try {
      const result = await smartOrderingAPI.checkAllStock();
      alert(`Stock check complete!\n\nItems checked: ${result.itemsChecked}\nNew alerts created: ${result.alertsCreated}`);
      loadAlerts();
      loadDashboard();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to check stock levels'));
    } finally {
      setIsCheckingStock(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await smartOrderingAPI.acknowledgeAlert(alertId);
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged' } : a
      ));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to acknowledge alert'));
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    const reason = prompt('Reason for dismissing this alert (optional):');
    try {
      await smartOrderingAPI.dismissAlert(alertId, reason || undefined);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to dismiss alert'));
    }
  };

  const handleCreatePOFromAlert = async (alertId: string) => {
    try {
      const result = await smartOrderingAPI.createPOFromAlert(alertId);
      alert(`Purchase Order ${result.purchaseOrder.po_number} created successfully!`);
      loadAlerts();
      loadDashboard();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create purchase order'));
    }
  };

  const handleViewUsage = async (itemId: string) => {
    try {
      const usage = await smartOrderingAPI.getUsageAnalytics(itemId);
      setSelectedItemUsage(usage);
      setShowUsageModal(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load usage analytics'));
    }
  };

  const handleSaveRule = async (ruleData: CreateReorderRuleInput) => {
    try {
      await smartOrderingAPI.createOrUpdateRule(ruleData);
      setShowRuleModal(false);
      setEditingRule(null);
      loadRules();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save rule'));
    }
  };

  const handleDeleteRule = async (itemId: string) => {
    if (!confirm('Delete this reorder rule?')) return;
    try {
      await smartOrderingAPI.deleteRule(itemId);
      loadRules();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete rule'));
    }
  };

  const createPOsFromSuggestions = async () => {
    if (!confirm(`Create purchase orders for ${suggestions.length} suggested items?`)) {
      return;
    }

    setIsCreatingPOs(true);
    try {
      const itemsBySupplier = new Map<string, typeof suggestions>();

      suggestions.forEach(suggestion => {
        const invItem = inventory.find(i => i.name === suggestion.itemName);
        const supplierId = invItem?.supplierId || 'no-supplier';

        if (!itemsBySupplier.has(supplierId)) {
          itemsBySupplier.set(supplierId, []);
        }
        itemsBySupplier.get(supplierId)!.push(suggestion);
      });

      const createdPOs = [];
      for (const [supplierId, items] of itemsBySupplier.entries()) {
        const poItems = items.map(suggestion => {
          const invItem = inventory.find(i => i.name === suggestion.itemName);
          return {
            inventory_item_id: invItem?.id,
            item_name: suggestion.itemName,
            quantity_ordered: suggestion.suggestedQuantity,
            unit_price: invItem?.price || 0
          };
        });

        const poData = {
          supplier_id: supplierId !== 'no-supplier' ? supplierId : undefined,
          items: poItems,
          notes: 'Created from Smart Ordering suggestions'
        };

        const newPO = await purchaseOrdersAPI.create(poData);
        createdPOs.push(newPO);
      }

      alert(`Successfully created ${createdPOs.length} purchase order(s)!\n\nPO Numbers:\n${createdPOs.map(po => po.po_number).join('\n')}`);
      setSuggestions([]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create purchase orders from suggestions'));
    } finally {
      setIsCreatingPOs(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'acknowledged': return 'bg-blue-100 text-blue-800';
      case 'ordered': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'alerts' as TabType, label: 'Reorder Alerts', icon: Bell },
    { id: 'forecasts' as TabType, label: 'Forecasts', icon: Activity },
    { id: 'rules' as TabType, label: 'Reorder Rules', icon: Settings },
    { id: 'suggestions' as TabType, label: 'AI Suggestions', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-2">Smart Ordering System</h3>
          <p className="opacity-90 max-w-xl">
            Intelligent inventory management with automated reorder alerts, usage analytics, and AI-powered suggestions.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10">
          <ShoppingCart className="w-48 h-48 -mb-12 -mr-12" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.id === 'alerts' && alerts.filter(a => a.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {alerts.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex justify-end">
            <button
              onClick={handleCheckAllStock}
              disabled={isCheckingStock}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isCheckingStock ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking Stock...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check All Stock Levels
                </>
              )}
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-slate-600">Loading dashboard...</p>
            </div>
          ) : dashboard ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Pending Alerts</span>
                    <Bell className="w-5 h-5 text-yellow-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dashboard.summary.pendingAlerts}</p>
                  {dashboard.summary.criticalAlerts > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      {dashboard.summary.criticalAlerts} critical
                    </p>
                  )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Low Stock Items</span>
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dashboard.summary.lowStockItems}</p>
                  <p className="text-sm text-slate-500 mt-1">Below reorder level</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Items to Reorder</span>
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{dashboard.summary.itemsToReorder}</p>
                  <p className="text-sm text-slate-500 mt-1">Suggested for ordering</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Est. Order Value</span>
                    <FileText className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">
                    ${dashboard.summary.estimatedOrderValue?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Total pending orders</p>
                </div>
              </div>

              {/* Low Stock Items */}
              {dashboard.lowStockItems.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 flex items-center">
                      <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
                      Low Stock Items
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboard.lowStockItems.slice(0, 5).map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-sm text-slate-500">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{item.currentStock} in stock</p>
                          <p className="text-sm text-slate-500">
                            Reorder at {item.reorderLevel}
                            {item.daysRemaining !== undefined && ` • ${item.daysRemaining} days left`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Shortages */}
              {dashboard.upcomingShortages.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 flex items-center">
                      <Clock className="w-5 h-5 text-red-500 mr-2" />
                      Upcoming Shortages
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboard.upcomingShortages.slice(0, 5).map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-sm text-slate-500">
                            {item.currentStock} in stock • {item.avgDailyUsage.toFixed(1)}/day avg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            {item.daysUntilStockout} days until stockout
                          </p>
                          <p className="text-sm text-slate-500">
                            {new Date(item.projectedStockoutDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              {dashboard.recentOrders.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h4 className="font-bold text-slate-800 flex items-center">
                      <Truck className="w-5 h-5 text-blue-500 mr-2" />
                      Recent Orders
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dashboard.recentOrders.slice(0, 5).map(order => (
                      <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-800">{order.poNumber}</p>
                          <p className="text-sm text-slate-500">{order.supplierName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">${order.totalValue.toLocaleString()}</p>
                          <p className="text-sm text-slate-500">
                            {order.totalItems} items • {order.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              No dashboard data available. Click "Check All Stock Levels" to generate alerts.
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="ordered">Ordered</option>
              </select>
              <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button
              onClick={handleCheckAllStock}
              disabled={isCheckingStock}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingStock ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-slate-600">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No reorder alerts at this time.</p>
              <p className="text-sm text-slate-500 mt-1">All inventory levels are healthy.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {alerts.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-bold text-slate-800">{alert.itemName}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                            {alert.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-slate-600 mb-2">{alert.reason}</p>
                        <div className="flex items-center space-x-6 text-sm text-slate-500">
                          <span className="flex items-center">
                            <Package className="w-4 h-4 mr-1" />
                            Current: {alert.currentStock}
                          </span>
                          <span className="flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Reorder at: {alert.reorderPoint}
                          </span>
                          <span className="flex items-center">
                            <ShoppingCart className="w-4 h-4 mr-1" />
                            Suggested qty: {alert.suggestedQuantity}
                          </span>
                          {alert.daysOfStockRemaining !== undefined && (
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {alert.daysOfStockRemaining} days remaining
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {alert.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleViewUsage(alert.itemId)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                              title="View Usage"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Acknowledge"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleCreatePOFromAlert(alert.id)}
                              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                            >
                              Create PO
                            </button>
                            <button
                              onClick={() => handleDismissAlert(alert.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Dismiss"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            onClick={() => handleCreatePOFromAlert(alert.id)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                          >
                            Create PO
                          </button>
                        )}
                        {alert.status === 'ordered' && alert.poNumber && (
                          <span className="text-sm text-green-600 font-medium">
                            PO: {alert.poNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-600">Configure automatic reorder rules for inventory items.</p>
            <button
              onClick={() => {
                setEditingRule(null);
                setShowRuleModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-slate-600">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
              <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No reorder rules configured.</p>
              <p className="text-sm text-slate-500 mt-1">
                Add rules to enable automatic reorder alerts.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reorder Point</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reorder Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Lead Time</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map(rule => (
                    <tr key={rule.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{rule.itemName}</p>
                        <p className="text-sm text-slate-500">{rule.itemCategory}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-800">{rule.reorderPoint}</td>
                      <td className="px-6 py-4 text-slate-800">{rule.reorderQuantity}</td>
                      <td className="px-6 py-4 text-slate-800">{rule.leadTimeDays} days</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.itemId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Forecasts Tab */}
      {activeTab === 'forecasts' && (
        <div className="space-y-6">
          {/* Forecast Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-slate-700">Forecast Period:</label>
              <select
                value={forecastDays}
                onChange={(e) => setForecastDays(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <button
              onClick={loadForecasts}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-slate-600">Analyzing usage patterns...</p>
            </div>
          ) : forecasts ? (
            <>
              {/* Forecast Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Items Analyzed</span>
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{forecasts.summary.totalItemsAnalyzed}</p>
                  <p className="text-sm text-slate-500 mt-1">With usage history</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Critical Items</span>
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-3xl font-bold text-red-600">{forecasts.summary.criticalItems}</p>
                  <p className="text-sm text-slate-500 mt-1">Stockout within 7 days</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Warning Items</span>
                    <Clock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{forecasts.summary.warningItems}</p>
                  <p className="text-sm text-slate-500 mt-1">Stockout within 14 days</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-sm">Need Reorder</span>
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-slate-800">{forecasts.summary.itemsNeedingReorder}</p>
                  <p className="text-sm text-slate-500 mt-1">Recommended to order</p>
                </div>
              </div>

              {/* Critical Items */}
              {forecasts.criticalItems.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
                  <div className="p-6 border-b border-red-200">
                    <h4 className="font-bold text-red-800 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Critical - Immediate Action Required
                    </h4>
                    <p className="text-sm text-red-600 mt-1">These items will run out within 7 days based on usage patterns</p>
                  </div>
                  <div className="divide-y divide-red-200">
                    {forecasts.criticalItems.map(item => (
                      <div key={item.itemId} className="p-4 flex items-center justify-between hover:bg-red-100">
                        <div>
                          <p className="font-medium text-slate-800">{item.itemName}</p>
                          <p className="text-sm text-slate-600">{item.category}</p>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
                            <span>Stock: {item.currentStock}</span>
                            <span>Daily usage: {item.avgDailyUsage}/day</span>
                            <span className="flex items-center">
                              {item.usageTrend === 'increasing' ? (
                                <TrendingUp className="w-3 h-3 text-red-500 mr-1" />
                              ) : item.usageTrend === 'decreasing' ? (
                                <TrendingDown className="w-3 h-3 text-green-500 mr-1" />
                              ) : (
                                <Activity className="w-3 h-3 text-slate-500 mr-1" />
                              )}
                              {item.usageTrend}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            {item.daysUntilStockout} days left
                          </p>
                          {item.stockoutDate && (
                            <p className="text-sm text-slate-500">
                              Out: {new Date(item.stockoutDate).toLocaleDateString()}
                            </p>
                          )}
                          {item.suggestedQuantity && (
                            <p className="text-sm text-blue-600 font-medium mt-1">
                              Order: {item.suggestedQuantity} units
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Forecasts Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 flex items-center">
                    <Activity className="w-5 h-5 text-blue-500 mr-2" />
                    Usage Forecasts ({forecastDays} Day Outlook)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Item</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Stock</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Daily Usage</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Trend</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Days Left</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Projected Stock</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {forecasts.forecasts.map(item => (
                        <tr key={item.itemId} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{item.itemName}</p>
                            <p className="text-xs text-slate-500">{item.category}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={item.currentStock <= item.reorderPoint ? 'text-red-600 font-bold' : ''}>
                              {item.currentStock}
                            </span>
                            {item.onOrder > 0 && (
                              <span className="text-xs text-blue-600 ml-1">(+{item.onOrder})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">{item.avgDailyUsage}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.usageTrend === 'increasing' ? 'bg-red-100 text-red-700' :
                              item.usageTrend === 'decreasing' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {item.usageTrend === 'increasing' && <TrendingUp className="w-3 h-3 mr-1" />}
                              {item.usageTrend === 'decreasing' && <TrendingDown className="w-3 h-3 mr-1" />}
                              {item.usageTrend}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.daysUntilStockout !== null ? (
                              <span className={
                                item.daysUntilStockout <= 7 ? 'text-red-600 font-bold' :
                                item.daysUntilStockout <= 14 ? 'text-yellow-600 font-bold' :
                                'text-slate-800'
                              }>
                                {item.daysUntilStockout}
                              </span>
                            ) : (
                              <span className="text-green-600">365+</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={item.projectedStock <= 0 ? 'text-red-600 font-bold' : ''}>
                              {item.projectedStock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.needsReorder ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Reorder
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No forecast data available.</p>
              <p className="text-sm text-slate-500 mt-1">
                Forecasts require usage history from stock movements.
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-800 mb-2">AI-Powered Order Suggestions</h4>
                <p className="text-slate-600">
                  Our AI analyzes your upcoming jobs, usage patterns, and current stock levels to suggest optimal purchase orders.
                </p>
              </div>
              <button
                onClick={fetchSuggestions}
                disabled={isSuggesting}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isSuggesting ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="font-bold text-slate-800">Suggested Purchase Order ({suggestions.length} items)</h4>
                <button
                  onClick={createPOsFromSuggestions}
                  disabled={isCreatingPOs}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                >
                  {isCreatingPOs ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating POs...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Create Purchase Orders
                    </>
                  )}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="p-6 flex items-start justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-bold text-slate-800">{s.itemName}</p>
                        <Badge variant="blue">+{s.suggestedQuantity}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center italic">
                        <ChevronRight className="w-4 h-4 text-slate-400 mr-1" />
                        {s.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <RuleModal
          rule={editingRule}
          inventory={inventory}
          contacts={contacts}
          onSave={handleSaveRule}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Usage Analytics Modal */}
      {showUsageModal && selectedItemUsage && (
        <UsageModal
          usage={selectedItemUsage}
          onClose={() => {
            setShowUsageModal(false);
            setSelectedItemUsage(null);
          }}
        />
      )}
    </div>
  );
};

// Rule Modal Component
interface RuleModalProps {
  rule: ReorderRule | null;
  inventory: InventoryItem[];
  contacts: any[];
  onSave: (data: CreateReorderRuleInput) => void;
  onClose: () => void;
}

const RuleModal: React.FC<RuleModalProps> = ({ rule, inventory, contacts, onSave, onClose }) => {
  const [formData, setFormData] = useState<CreateReorderRuleInput>({
    itemId: rule?.itemId || '',
    reorderPoint: rule?.reorderPoint || 10,
    reorderQuantity: rule?.reorderQuantity || 20,
    maxStockLevel: rule?.maxStockLevel || undefined,
    leadTimeDays: rule?.leadTimeDays || 7,
    safetyStockDays: rule?.safetyStockDays || 3,
    preferredSupplierId: rule?.preferredSupplierId || undefined,
    autoCreatePo: rule?.autoCreatePo || false,
    isActive: rule?.isActive ?? true,
  });

  const suppliers = contacts.filter(c => c.type === 'Supplier');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId) {
      alert('Please select an item');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {rule ? 'Edit Reorder Rule' : 'Add Reorder Rule'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item *</label>
            <select
              value={formData.itemId}
              onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
              disabled={!!rule}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
              required
            >
              <option value="">Select an item...</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
              <input
                type="number"
                value={formData.reorderPoint}
                onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Quantity</label>
              <input
                type="number"
                value={formData.reorderQuantity}
                onChange={(e) => setFormData({ ...formData, reorderQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (days)</label>
              <input
                type="number"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Safety Stock (days)</label>
              <input
                type="number"
                value={formData.safetyStockDays}
                onChange={(e) => setFormData({ ...formData, safetyStockDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Stock Level (optional)</label>
            <input
              type="number"
              value={formData.maxStockLevel || ''}
              onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              min="0"
              placeholder="No maximum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Supplier</label>
            <select
              value={formData.preferredSupplierId || ''}
              onChange={(e) => setFormData({ ...formData, preferredSupplierId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">No preference</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} {supplier.company ? `(${supplier.company})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.autoCreatePo}
                onChange={(e) => setFormData({ ...formData, autoCreatePo: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded"
              />
              <span className="ml-2 text-sm text-slate-700">Auto-create PO when triggered</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded"
              />
              <span className="ml-2 text-sm text-slate-700">Rule active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Usage Analytics Modal Component
interface UsageModalProps {
  usage: UsageAnalytics;
  onClose: () => void;
}

const UsageModal: React.FC<UsageModalProps> = ({ usage, onClose }) => {
  const getTrendIcon = () => {
    switch (usage.usageTrend) {
      case 'increasing': return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing': return <TrendingDown className="w-5 h-5 text-green-500" />;
      default: return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  const getTrendColor = () => {
    switch (usage.usageTrend) {
      case 'increasing': return 'text-red-600';
      case 'decreasing': return 'text-green-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Usage Analytics: {usage.itemName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Usage Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Daily Average</p>
              <p className="text-2xl font-bold text-slate-800">{usage.avgDailyUsage.toFixed(1)}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Weekly Average</p>
              <p className="text-2xl font-bold text-slate-800">{usage.avgWeeklyUsage.toFixed(1)}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Monthly Average</p>
              <p className="text-2xl font-bold text-slate-800">{usage.avgMonthlyUsage.toFixed(1)}</p>
            </div>
          </div>

          {/* Trend and Forecast */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600">Usage Trend</p>
                {getTrendIcon()}
              </div>
              <p className={`text-xl font-bold ${getTrendColor()}`}>
                {usage.usageTrend.charAt(0).toUpperCase() + usage.usageTrend.slice(1)}
                {usage.trendPercentage !== 0 && (
                  <span className="text-sm ml-2">
                    ({usage.trendPercentage > 0 ? '+' : ''}{usage.trendPercentage.toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">Days of Stock</p>
              <p className={`text-xl font-bold ${
                usage.daysOfStockRemaining < 7 ? 'text-red-600' :
                usage.daysOfStockRemaining < 14 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {usage.daysOfStockRemaining} days
              </p>
              {usage.projectedStockoutDate && (
                <p className="text-sm text-slate-500 mt-1">
                  Stockout: {new Date(usage.projectedStockoutDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Period Totals */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-3">Usage Totals</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Last 30 Days</p>
                <p className="text-lg font-bold text-slate-800">{usage.totalUsage30Days}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Last 90 Days</p>
                <p className="text-lg font-bold text-slate-800">{usage.totalUsage90Days}</p>
              </div>
            </div>
          </div>

          {/* Recent Usage History */}
          {usage.usageHistory && usage.usageHistory.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-800 mb-3">Recent Usage</h4>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-600">Date</th>
                      <th className="px-4 py-2 text-left text-slate-600">Quantity</th>
                      <th className="px-4 py-2 text-left text-slate-600">Type</th>
                      <th className="px-4 py-2 text-left text-slate-600">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usage.usageHistory.slice(0, 10).map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-800">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-slate-800">{entry.quantity}</td>
                        <td className="px-4 py-2 text-slate-600">{entry.movementType}</td>
                        <td className="px-4 py-2 text-slate-500">{entry.reference || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
