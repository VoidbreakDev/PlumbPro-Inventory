import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Eye, Check, X, ChevronRight } from 'lucide-react';
import { PriceAlert, PriceAlertSummary } from '../types';
import { priceAlertsAPI } from '../lib/supplierAPI';
import { Badge } from './Shared';

interface PriceAlertsWidgetProps {
  onViewAll?: () => void;
}

export const PriceAlertsWidget: React.FC<PriceAlertsWidgetProps> = ({ onViewAll }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [summary, setSummary] = useState<PriceAlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [alertsData, summaryData] = await Promise.all([
        priceAlertsAPI.getAll({ viewed: false, limit: 5 }),
        priceAlertsAPI.getSummary()
      ]);

      setAlerts(alertsData.alerts);
      setSummary(summaryData.summary);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load price alerts');
      console.error('Load alerts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkViewed = async (alertId: string) => {
    try {
      await priceAlertsAPI.markViewed(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      if (summary) {
        setSummary({
          ...summary,
          unviewedAlerts: summary.unviewedAlerts - 1
        });
      }
    } catch (err: any) {
      console.error('Mark viewed error:', err);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await priceAlertsAPI.markAcknowledged(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      if (summary) {
        setSummary({
          ...summary,
          unacknowledgedAlerts: summary.unacknowledgedAlerts - 1
        });
      }
    } catch (err: any) {
      console.error('Acknowledge error:', err);
    }
  };

  const getAlertIcon = (alert: PriceAlert) => {
    if (alert.alertType === 'increase') {
      return <TrendingUp className="w-5 h-5 text-red-600" />;
    }
    return <TrendingDown className="w-5 h-5 text-green-600" />;
  };

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, 'red' | 'yellow' | 'gray'> = {
      high: 'red',
      medium: 'yellow',
      low: 'gray'
    };
    return <Badge variant={variants[urgency] || 'gray'}>{urgency.toUpperCase()}</Badge>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Price Alerts</h3>
            {summary && summary.unviewedAlerts > 0 && (
              <Badge variant="red">{summary.unviewedAlerts} new</Badge>
            )}
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="text-center p-2 bg-red-50 rounded">
              <p className="text-2xl font-bold text-red-600">{summary.priceIncreases}</p>
              <p className="text-xs text-red-700">Increases</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">{summary.priceDecreases}</p>
              <p className="text-xs text-green-700">Decreases</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-2xl font-bold text-gray-900">
                {summary.avgPercentageChange.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600">Avg Change</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No new price alerts</p>
            <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {alert.itemName}
                      </p>
                      {getUrgencyBadge(alert.urgency)}
                    </div>

                    <p className="text-xs text-gray-600 mb-2">
                      {alert.supplierName}
                      {alert.supplierCompany && ` • ${alert.supplierCompany}`}
                    </p>

                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Old: </span>
                        <span className="font-medium text-gray-900">
                          ${parseFloat(alert.oldPriceExclGst.toString()).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">New: </span>
                        <span
                          className={`font-medium ${
                            alert.alertType === 'increase' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          ${parseFloat(alert.newPriceExclGst.toString()).toFixed(2)}
                        </span>
                      </div>
                      <div
                        className={`font-medium ${
                          alert.alertType === 'increase' ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {alert.percentageChange > 0 ? '+' : ''}
                        {alert.percentageChange.toFixed(1)}%
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-1">
                    <button
                      onClick={() => handleMarkViewed(alert.id)}
                      title="Mark as viewed"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      title="Acknowledge"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
