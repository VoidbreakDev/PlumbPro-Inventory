import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Lightbulb,
  X,
  Send,
  Loader
} from 'lucide-react';
import { aiAPI } from '../lib/aiAPI';
import type { SearchResult } from '../lib/aiAPI';

interface AIAssistantProps {
  onClose: () => void;
}

type AssistantMode = 'search' | 'forecast' | 'anomalies' | 'purchase-orders' | 'insights' | 'chat';

export function AIAssistant({ onClose }: AIAssistantProps) {
  const [mode, setMode] = useState<AssistantMode>('chat');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);
    setSearchResults(null);

    try {
      const result = await aiAPI.search(query);
      setSearchResults(result);
      setMode('search');
    } catch (err: any) {
      setError(err.message || 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetForecast = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await aiAPI.getForecast();
      setResponse(result);
      setMode('forecast');
    } catch (err: any) {
      setError(err.message || 'Failed to get forecast');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAnomalies = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await aiAPI.getAnomalies();
      setResponse(result);
      setMode('anomalies');
    } catch (err: any) {
      setError(err.message || 'Failed to detect anomalies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPurchaseOrders = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await aiAPI.getPurchaseOrders();
      setResponse(result);
      setMode('purchase-orders');
    } catch (err: any) {
      setError(err.message || 'Failed to generate purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetInsights = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await aiAPI.getInsights();
      setResponse(result);
      setMode('insights');
    } catch (err: any) {
      setError(err.message || 'Failed to get insights');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-xl font-bold">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask me anything... (e.g., 'show me all copper pipes under £50')"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Quick Actions:</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <button
              onClick={handleGetForecast}
              disabled={isLoading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-blue-50 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <TrendingUp className="w-4 h-4" />
              Forecast
            </button>
            <button
              onClick={handleGetAnomalies}
              disabled={isLoading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-orange-50 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              Anomalies
            </button>
            <button
              onClick={handleGetPurchaseOrders}
              disabled={isLoading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-green-50 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              Orders
            </button>
            <button
              onClick={handleGetInsights}
              disabled={isLoading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-purple-50 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Lightbulb className="w-4 h-4" />
              Insights
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-600">AI is thinking...</p>
            </div>
          )}

          {/* Search Results */}
          {mode === 'search' && searchResults && !isLoading && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Search className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Search Interpretation</h3>
                    <p className="text-sm text-blue-800 mt-1">{searchResults.interpretation}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-3">
                  Found {searchResults.results.length} items
                </h3>
                <div className="space-y-2">
                  {searchResults.results.map((item, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-slate-900">{item.name}</h4>
                          <p className="text-sm text-slate-600">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">£{item.price}</p>
                          <p className="text-sm text-slate-600">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {searchResults.suggestions.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">Suggestions</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {searchResults.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-purple-800">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Forecast Results */}
          {mode === 'forecast' && response && !isLoading && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Stock Demand Forecast (Next 30 Days)
              </h3>

              {response.message && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                  {response.message}
                </div>
              )}

              <div className="space-y-3">
                {response.forecasts?.map((forecast: any, index: number) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{forecast.itemName}</h4>
                        <p className="text-sm text-slate-600">{forecast.category}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        forecast.confidence === 'high' ? 'bg-green-100 text-green-800' :
                        forecast.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {forecast.confidence} confidence ({forecast.confidencePercentage}%)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-600">Current Stock</p>
                        <p className="text-lg font-semibold text-slate-900">{forecast.currentStock}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Predicted Demand</p>
                        <p className="text-lg font-semibold text-blue-600">{forecast.predictedDemand}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Avg Daily Use</p>
                        <p className="text-lg font-semibold text-slate-900">{forecast.avgDailyConsumption.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Reorder Qty</p>
                        <p className="text-lg font-semibold text-green-600">{forecast.recommendedReorderQty}</p>
                      </div>
                    </div>

                    {forecast.expectedStockoutDate && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                        <p className="text-sm text-red-800">
                          ⚠️ Expected stockout: {new Date(forecast.expectedStockoutDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {forecast.seasonalTrends && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-600 mb-1">Seasonal Trends</p>
                        <p className="text-sm text-slate-700">{forecast.seasonalTrends}</p>
                      </div>
                    )}

                    {forecast.riskFactors && forecast.riskFactors.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Risk Factors</p>
                        <ul className="list-disc list-inside space-y-1">
                          {forecast.riskFactors.map((risk: string, i: number) => (
                            <li key={i} className="text-sm text-orange-700">{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {mode === 'anomalies' && response && !isLoading && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Detected Anomalies
              </h3>

              {response.message && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                  {response.message}
                </div>
              )}

              {response.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">{response.summary}</p>
                </div>
              )}

              <div className="space-y-3">
                {response.anomalies?.map((anomaly: any, index: number) => (
                  <div key={index} className={`rounded-lg p-4 border ${
                    anomaly.severity === 'high' ? 'bg-red-50 border-red-200' :
                    anomaly.severity === 'medium' ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-900">{anomaly.itemName}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-white">
                          {anomaly.type}
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        anomaly.severity === 'high' ? 'bg-red-100 text-red-800' :
                        anomaly.severity === 'medium' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {anomaly.severity} severity
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 mb-2">{anomaly.description}</p>

                    <div className="bg-white bg-opacity-50 rounded p-2 mb-2">
                      <p className="text-xs text-slate-600 mb-1">Detected Pattern</p>
                      <p className="text-sm text-slate-800">{anomaly.detectedPattern}</p>
                    </div>

                    <div className="bg-white bg-opacity-50 rounded p-2">
                      <p className="text-xs text-slate-600 mb-1">Recommendation</p>
                      <p className="text-sm font-medium text-slate-900">{anomaly.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchase Orders */}
          {mode === 'purchase-orders' && response && !isLoading && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-green-600" />
                Purchase Order Recommendations
              </h3>

              {response.message && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                  {response.message}
                </div>
              )}

              {response.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">{response.summary}</p>
                </div>
              )}

              {response.totalEstimatedCost && (
                <div className="bg-slate-100 rounded-lg p-4">
                  <p className="text-sm text-slate-600">Total Estimated Cost</p>
                  <p className="text-2xl font-bold text-slate-900">£{response.totalEstimatedCost.toFixed(2)}</p>
                </div>
              )}

              <div className="space-y-3">
                {response.purchaseOrders?.map((po: any, index: number) => (
                  <div key={index} className={`rounded-lg p-4 border ${
                    po.priority === 'urgent' ? 'bg-red-50 border-red-200' :
                    po.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">{po.itemName}</h4>
                        <p className="text-sm text-slate-600">{po.supplier}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        po.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        po.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {po.priority} priority
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-600">Current Stock</p>
                        <p className="text-lg font-semibold text-slate-900">{po.currentStock}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Order Qty</p>
                        <p className="text-lg font-semibold text-blue-600">{po.recommendedOrderQty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Est. Cost</p>
                        <p className="text-lg font-semibold text-green-600">£{po.estimatedCost.toFixed(2)}</p>
                      </div>
                    </div>

                    {po.daysUntilStockout > 0 && (
                      <div className="bg-white bg-opacity-50 rounded p-2 mb-2">
                        <p className="text-sm text-slate-700">
                          ⏰ Estimated stockout in <strong>{po.daysUntilStockout} days</strong>
                        </p>
                      </div>
                    )}

                    <div className="bg-white bg-opacity-50 rounded p-2">
                      <p className="text-xs text-slate-600 mb-1">Reasoning</p>
                      <p className="text-sm text-slate-800">{po.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {mode === 'insights' && response && !isLoading && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                Smart Business Insights
              </h3>

              {response.overallHealthScore !== undefined && (
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                  <p className="text-sm opacity-90">Overall Business Health Score</p>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-bold">{response.overallHealthScore}</p>
                    <p className="text-lg mb-1">/100</p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Key Insights</h4>
                <div className="space-y-2">
                  {response.insights?.map((insight: any, index: number) => (
                    <div key={index} className={`rounded-lg p-3 border ${
                      insight.trend === 'positive' ? 'bg-green-50 border-green-200' :
                      insight.trend === 'negative' ? 'bg-red-50 border-red-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between mb-1">
                        <h5 className="font-medium text-slate-900">{insight.title}</h5>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                          insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {insight.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{insight.description}</p>
                      <p className="text-xs text-slate-600 mt-1">Category: {insight.category}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Recommendations</h4>
                <div className="space-y-2">
                  {response.recommendations?.map((rec: any, index: number) => (
                    <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-slate-900">{rec.action}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mb-1">{rec.expectedBenefit}</p>
                      <p className="text-xs text-slate-600">Effort: {rec.effort}</p>
                    </div>
                  ))}
                </div>
              </div>

              {response.risks && response.risks.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Risks</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {response.risks.map((risk: string, index: number) => (
                      <li key={index} className="text-sm text-red-800">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {response.opportunities && response.opportunities.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Opportunities</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {response.opportunities.map((opp: string, index: number) => (
                      <li key={index} className="text-sm text-green-800">{opp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Welcome State */}
          {mode === 'chat' && !response && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-16 h-16 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                Welcome to AI Assistant
              </h3>
              <p className="text-slate-600 mb-6 max-w-md">
                I can help you with natural language search, demand forecasting, anomaly detection,
                purchase order recommendations, and smart business insights.
              </p>
              <p className="text-sm text-slate-500">
                Try asking: "Show me all copper pipes under £50" or click a quick action above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
