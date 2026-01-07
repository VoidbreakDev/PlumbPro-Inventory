import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Calendar,
  RefreshCw,
  Download,
  Sparkles
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { aiAPI } from '../lib/aiAPI';
import type { StockForecast } from '../lib/aiAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';

export function AIForecastView() {
  const [forecasts, setForecasts] = useState<StockForecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [selectedItem, setSelectedItem] = useState<StockForecast | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const setError = useStore((state) => state.setError);

  useEffect(() => {
    loadForecasts();
  }, [selectedPeriod]);

  const loadForecasts = async () => {
    setIsLoading(true);
    try {
      const result = await aiAPI.getForecast(undefined, selectedPeriod);
      setForecasts(result.forecasts || []);
      setLastRefresh(new Date());
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load forecasts'));
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getPriorityItems = () => {
    return forecasts
      .filter(f => f.expectedStockoutDate || f.confidence === 'high')
      .sort((a, b) => {
        if (a.expectedStockoutDate && !b.expectedStockoutDate) return -1;
        if (!a.expectedStockoutDate && b.expectedStockoutDate) return 1;
        return b.confidencePercentage - a.confidencePercentage;
      })
      .slice(0, 5);
  };

  const getForecastChartData = () => {
    if (!selectedItem || !selectedItem.forecastByWeek || selectedItem.forecastByWeek.length === 0) {
      return [];
    }

    return selectedItem.forecastByWeek.map(week => ({
      week: `Week ${week.week}`,
      consumption: week.estimatedConsumption,
      currentStock: selectedItem.currentStock - (week.estimatedConsumption * week.week),
      reorderLevel: selectedItem.reorderLevel
    }));
  };

  const exportForecasts = () => {
    const data = forecasts.map(f => ({
      Item: f.itemName,
      Category: f.category,
      'Current Stock': f.currentStock,
      'Predicted Demand': f.predictedDemand,
      Confidence: f.confidence,
      'Recommended Order Qty': f.recommendedReorderQty,
      'Stockout Date': f.expectedStockoutDate || 'N/A',
      'Seasonal Trends': f.seasonalTrends
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-forecast-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading && forecasts.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const priorityItems = getPriorityItems();
  const chartData = getForecastChartData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-blue-600" />
            AI Demand Forecasting
          </h1>
          <p className="text-slate-600 mt-1">
            Predictive analytics powered by advanced AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>

          <button
            onClick={loadForecasts}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={exportForecasts}
            disabled={forecasts.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-slate-600">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{forecasts.length}</p>
          <p className="text-sm text-slate-600">Items Forecasted</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {forecasts.filter(f => f.expectedStockoutDate).length}
          </p>
          <p className="text-sm text-slate-600">Expected Stockouts</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {forecasts.filter(f => f.confidence === 'high').length}
          </p>
          <p className="text-sm text-slate-600">High Confidence</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600">{selectedPeriod}</p>
          <p className="text-sm text-slate-600">Days Ahead</p>
        </div>
      </div>

      {/* Priority Items Alert */}
      {priorityItems.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Attention Required
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                {priorityItems.length} item{priorityItems.length > 1 ? 's' : ''} require immediate attention
                based on AI forecast analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Priority Items
          </h3>

          {priorityItems.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>No priority items at the moment</p>
              <p className="text-sm text-slate-400 mt-1">All items are forecasted to be adequately stocked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {priorityItems.map((item) => (
                <div
                  key={item.itemId}
                  onClick={() => setSelectedItem(item)}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-900">{item.itemName}</h4>
                      <p className="text-sm text-slate-600">{item.category}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(item.confidence)}`}>
                      {item.confidence}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-slate-600">Current</p>
                      <p className="font-semibold text-slate-900">{item.currentStock}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Demand</p>
                      <p className="font-semibold text-blue-600">{item.predictedDemand}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Order</p>
                      <p className="font-semibold text-green-600">{item.recommendedReorderQty}</p>
                    </div>
                  </div>

                  {item.expectedStockoutDate && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-800">
                        ⚠️ Stockout expected: {new Date(item.expectedStockoutDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Forecast Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Forecast Visualization
          </h3>

          {selectedItem ? (
            <div>
              <div className="mb-4">
                <h4 className="font-medium text-slate-900">{selectedItem.itemName}</h4>
                <p className="text-sm text-slate-600">{selectedItem.category}</p>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="currentStock"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="Projected Stock"
                    />
                    <Area
                      type="monotone"
                      dataKey="reorderLevel"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.1}
                      name="Reorder Level"
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-slate-600">
                  <p>Weekly forecast data not available</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded p-3">
                  <p className="text-xs text-blue-600 mb-1">Avg Daily Consumption</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {selectedItem.avgDailyConsumption.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 rounded p-3">
                  <p className="text-xs text-green-600 mb-1">Confidence</p>
                  <p className="text-lg font-semibold text-green-900">
                    {selectedItem.confidencePercentage}%
                  </p>
                </div>
              </div>

              {selectedItem.seasonalTrends && (
                <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-3">
                  <p className="text-xs text-purple-600 mb-1">Seasonal Trends</p>
                  <p className="text-sm text-purple-900">{selectedItem.seasonalTrends}</p>
                </div>
              )}

              {selectedItem.riskFactors && selectedItem.riskFactors.length > 0 && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-3">
                  <p className="text-xs text-orange-600 mb-1">Risk Factors</p>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedItem.riskFactors.map((risk, index) => (
                      <li key={index} className="text-sm text-orange-900">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-slate-600">Select an item to view forecast</p>
              <p className="text-sm text-slate-400 mt-1">
                Click on any item from the priority list
              </p>
            </div>
          )}
        </div>
      </div>

      {/* All Forecasts Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">All Forecasts</h3>

        {forecasts.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>No forecast data available</p>
            <p className="text-sm text-slate-400 mt-1">
              Add stock movements to generate AI-powered forecasts
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Current</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Demand</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Order Qty</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Stockout</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {forecasts.map((forecast) => (
                  <tr key={forecast.itemId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{forecast.itemName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{forecast.category}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">
                      {forecast.currentStock}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">
                      {forecast.predictedDemand}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-green-600">
                      {forecast.recommendedReorderQty}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(forecast.confidence)}`}>
                        {forecast.confidence} ({forecast.confidencePercentage}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {forecast.expectedStockoutDate ? (
                        <span className="text-xs text-red-600">
                          {new Date(forecast.expectedStockoutDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedItem(forecast)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
