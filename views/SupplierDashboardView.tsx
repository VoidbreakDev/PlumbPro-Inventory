import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  AlertCircle,
  Package,
  Star,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { PriceAlertsWidget } from '../components/PriceAlertsWidget';
import { SupplierPerformanceCard } from '../components/SupplierPerformanceCard';
import { StatCard } from '../components/Shared';
import { supplierAnalyticsAPI, priceAlertsAPI } from '../lib/supplierAPI';
import { Contact } from '../types';

interface SupplierDashboardViewProps {
  contacts: Contact[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function SupplierDashboardView({ contacts }: SupplierDashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [topSuppliers, setTopSuppliers] = useState<any[]>([]);
  const [priceAlertSummary, setPriceAlertSummary] = useState<any>(null);
  const [selectedMetric, setSelectedMetric] = useState<'rating' | 'delivery' | 'orders' | 'value'>('rating');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const suppliers = contacts.filter(c => c.type === 'Supplier');

  useEffect(() => {
    loadDashboardData();
  }, [selectedMetric]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [topPerformers, alertsSummary] = await Promise.all([
        supplierAnalyticsAPI.getTopPerformers(selectedMetric, 10),
        priceAlertsAPI.getSummary()
      ]);

      setTopSuppliers(topPerformers.suppliers);
      setPriceAlertSummary(alertsSummary);

      // Auto-select first supplier if none selected
      if (!selectedSupplierId && topPerformers.suppliers.length > 0) {
        setSelectedSupplierId(topPerformers.suppliers[0].id);
      }

      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Load dashboard error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getMetricValue = (supplier: any): number => {
    switch (selectedMetric) {
      case 'rating':
        return parseFloat(supplier.averageRating) || 0;
      case 'delivery':
        return parseFloat(supplier.deliveryReliability) || 0;
      case 'orders':
        return parseInt(supplier.totalOrders) || 0;
      case 'value':
        return parseFloat(supplier.totalValue) || 0;
      default:
        return 0;
    }
  };

  const getMetricLabel = (): string => {
    switch (selectedMetric) {
      case 'rating':
        return 'Average Rating';
      case 'delivery':
        return 'Delivery Reliability (%)';
      case 'orders':
        return 'Total Orders';
      case 'value':
        return 'Total Value ($)';
      default:
        return '';
    }
  };

  const formatMetricValue = (value: number): string => {
    switch (selectedMetric) {
      case 'rating':
        return value.toFixed(1);
      case 'delivery':
        return `${value.toFixed(1)}%`;
      case 'orders':
        return value.toString();
      case 'value':
        return `$${value.toFixed(2)}`;
      default:
        return value.toString();
    }
  };

  // Calculate supplier statistics
  const suppliersWithRatings = suppliers.filter(s => s.averageRating && parseFloat(s.averageRating.toString()) > 0);
  const avgRating = suppliersWithRatings.length > 0
    ? suppliersWithRatings.reduce((acc, s) => acc + parseFloat(s.averageRating?.toString() || '0'), 0) / suppliersWithRatings.length
    : 0;

  const supplierStats = {
    total: suppliers.length,
    withRatings: suppliersWithRatings.length,
    averageRating: avgRating,
    topRated: suppliers.filter(s => parseFloat(s.averageRating?.toString() || '0') >= 4.5).length
  };

  // Prepare chart data
  const topSuppliersChartData = topSuppliers
    .filter(s => s && s.name)
    .map(s => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
      value: getMetricValue(s),
      fullName: s.name
    }));

  // Rating distribution
  const ratingDistribution = suppliers.reduce((acc: any[], supplier) => {
    const rating = Math.round(parseFloat(supplier.averageRating?.toString() || '0'));
    if (rating > 0) {
      const existing = acc.find(r => r.stars === rating);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ stars: rating, count: 1 });
      }
    }
    return acc;
  }, []).sort((a, b) => b.stars - a.stars);

  // Show loading state
  if (loading && !error && topSuppliers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading supplier dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && topSuppliers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Management Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Track supplier performance, pricing, and relationships
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-slate-600">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="Total Suppliers"
          value={supplierStats.total.toString()}
          color="blue"
        />

        <StatCard
          icon={Star}
          label="Average Rating"
          value={supplierStats.averageRating.toFixed(1)}
          color="yellow"
        />

        <StatCard
          icon={Award}
          label="Top Rated (4.5+)"
          value={supplierStats.topRated.toString()}
          color="green"
        />

        <StatCard
          icon={AlertCircle}
          label="Price Alerts"
          value={priceAlertSummary?.summary?.unviewedAlerts?.toString() || '0'}
          trend={(priceAlertSummary?.summary?.priceIncreases || 0) > (priceAlertSummary?.summary?.priceDecreases || 0) ? 'down' : 'up'}
          color="red"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Performers Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Top Performing Suppliers
              </h3>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="rating">By Rating</option>
                <option value="delivery">By Delivery</option>
                <option value="orders">By Orders</option>
                <option value="value">By Value</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-80">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : topSuppliersChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topSuppliersChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip
                    formatter={(value: number) => formatMetricValue(value)}
                    labelFormatter={(label) => {
                      const item = topSuppliersChartData.find(d => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="value" name={getMetricLabel()} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80 text-gray-500">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No supplier data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Rating Distribution */}
          {ratingDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-600" />
                Rating Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={ratingDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ stars, count }) => `${stars}★ (${count})`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.stars - 1] || COLORS[0]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} suppliers`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Price Trends */}
          {priceAlertSummary?.topItems && priceAlertSummary.topItems.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Items with Most Price Changes
              </h3>
              <div className="space-y-3">
                {priceAlertSummary.topItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.alertCount} {item.alertCount === 1 ? 'change' : 'changes'}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 font-medium ${
                      parseFloat(item.avgChange) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {parseFloat(item.avgChange) > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>{Math.abs(parseFloat(item.avgChange)).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          {/* Price Alerts Widget */}
          <PriceAlertsWidget />

          {/* Supplier Selector */}
          {suppliers.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Supplier Performance
              </label>
              <select
                value={selectedSupplierId || ''}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.company ? `- ${supplier.company}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Performance Card (Full Width) */}
      {selectedSupplierId && suppliers.find(s => s.id === selectedSupplierId) && (
        <div className="mt-6">
          <SupplierPerformanceCard
            key={selectedSupplierId}
            supplierId={selectedSupplierId}
          />
        </div>
      )}
    </div>
  );
}
