import React from 'react';
import {
  Bell,
  RefreshCw,
  Package,
  AlertTriangle,
  ShoppingCart,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ReorderAlert } from '../../types';

interface PriceAlertsListProps {
  alerts: ReorderAlert[];
  isLoading: boolean;
  isCheckingStock: boolean;
  dismissingAlertId: string | null;
  dismissReason: string;
  onCheckAllStock: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onDismissAlert: (alertId: string) => void;
  onDismissAlertConfirmed: () => void;
  onCancelDismiss: () => void;
  onSetDismissReason: (reason: string) => void;
  onCreatePOFromAlert: (alertId: string) => void;
  onViewUsage: (itemId: string) => void;
}

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

export const PriceAlertsList: React.FC<PriceAlertsListProps> = ({
  alerts,
  isLoading,
  isCheckingStock,
  dismissingAlertId,
  dismissReason,
  onCheckAllStock,
  onAcknowledgeAlert,
  onDismissAlert,
  onDismissAlertConfirmed,
  onCancelDismiss,
  onSetDismissReason,
  onCreatePOFromAlert,
  onViewUsage,
}) => {
  return (
    <>
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
            onClick={onCheckAllStock}
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
                            onClick={() => onViewUsage(alert.itemId)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="View Usage"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onAcknowledgeAlert(alert.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Acknowledge"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onCreatePOFromAlert(alert.id)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                          >
                            Create PO
                          </button>
                          <button
                            onClick={() => onDismissAlert(alert.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Dismiss"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => onCreatePOFromAlert(alert.id)}
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

      {/* Dismiss Alert Reason Modal */}
      {dismissingAlertId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Dismiss Alert</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for dismissing (optional)
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              value={dismissReason}
              onChange={(e) => onSetDismissReason(e.target.value)}
              placeholder="Enter reason..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={onCancelDismiss}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={onDismissAlertConfirmed}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
