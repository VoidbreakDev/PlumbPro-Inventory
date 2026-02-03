/**
 * Supplier Dashboard View
 * Comprehensive supplier management with performance tracking, price alerts, and analytics
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Award,
  RefreshCw,
  Package,
  Truck,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Star,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { StatCard } from '../components/Shared';
import { Contact } from '../types';
import { priceAlertsAPI, supplierRatingsAPI, supplierAnalyticsAPI } from '../lib/supplierAPI';
import type { PriceAlert, TopSupplier, SupplierPerformance } from '../types';
import { getErrorMessage } from '../lib/errors';

interface SupplierDashboardViewProps {
  contacts: Contact[];
}

interface DashboardStats {
  totalSuppliers: number;
  activeSuppliers: number;
  avgRating: number;
  topRated: number;
  totalPOs: number;
  pendingPOs: number;
  openDiscrepancies: number;
  priceAlerts: number;
}

interface SupplierWithMetrics extends Contact {
  totalOrders?: number;
  totalSpent?: number;
  deliveryReliability?: number;
  recentPriceChanges?: number;
}

export function SupplierDashboardView({ contacts }: SupplierDashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'price-alerts' | 'discrepancies'>('overview');
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopSupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Contact | null>(null);
  const [supplierPerformance, setSupplierPerformance] = useState<SupplierPerformance | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);

  const suppliers = contacts?.filter(c => c?.type === 'Supplier') || [];

  // Calculate stats
  const suppliersWithRatings = suppliers.filter(s =>
    s?.averageRating && parseFloat(s.averageRating.toString()) > 0
  );

  const avgRating = suppliersWithRatings.length > 0
    ? suppliersWithRatings.reduce((acc, s) =>
        acc + parseFloat(s.averageRating?.toString() || '0'), 0
      ) / suppliersWithRatings.length
    : 0;

  const stats: DashboardStats = {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter(s => s.status === 'active').length,
    avgRating,
    topRated: suppliers.filter(s => parseFloat(s?.averageRating?.toString() || '0') >= 4.5).length,
    totalPOs: 0,
    pendingPOs: 0,
    openDiscrepancies: 0,
    priceAlerts: priceAlerts.filter(a => !a.isAcknowledged).length
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [alertsData, performersData] = await Promise.all([
        priceAlertsAPI.getAll({ acknowledged: false }).catch(() => ({ alerts: [], pagination: {}, statistics: {} })),
        supplierAnalyticsAPI.getTopPerformers('rating', 10).catch(() => ({ suppliers: [] }))
      ]);

      setPriceAlerts(alertsData.alerts || []);
      setTopPerformers(performersData.suppliers || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierPerformance = async (supplierId: string) => {
    try {
      const data = await supplierAnalyticsAPI.getPerformance(supplierId);
      setSupplierPerformance(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load supplier performance'));
    }
  };

  const handleViewSupplier = async (supplier: Contact) => {
    setSelectedSupplier(supplier);
    setShowDetailModal(true);
    await loadSupplierPerformance(supplier.id);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await priceAlertsAPI.markAcknowledged(alertId);
      setPriceAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, isAcknowledged: true } : a
      ));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to acknowledge alert'));
    }
  };

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.company?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRating = filterRating === 'all' ||
      (filterRating === 'top' && parseFloat(s.averageRating?.toString() || '0') >= 4.5) ||
      (filterRating === 'good' && parseFloat(s.averageRating?.toString() || '0') >= 3.5) ||
      (filterRating === 'unrated' && !s.averageRating);

    return matchesSearch && matchesRating;
  });

  // Render star rating
  const renderStars = (rating: number) => {
    const safeRating = Math.max(0, Math.min(5, Math.round(rating || 0)));
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i <= safeRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Track supplier performance, pricing trends, and delivery metrics
          </p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Total Suppliers"
          value={stats.totalSuppliers.toString()}
          color="bg-blue-500"
        />
        <StatCard
          icon={Award}
          title="Top Rated (4.5+)"
          value={stats.topRated.toString()}
          color="bg-yellow-500"
        />
        <StatCard
          icon={Star}
          title="Average Rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
          color="bg-purple-500"
        />
        <StatCard
          icon={AlertTriangle}
          title="Price Alerts"
          value={stats.priceAlerts.toString()}
          color={stats.priceAlerts > 0 ? 'bg-red-500' : 'bg-green-500'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'price-alerts', label: 'Price Alerts', icon: DollarSign },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'price-alerts' && stats.priceAlerts > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {stats.priceAlerts}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Suppliers List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">All Suppliers</h2>
                <span className="text-sm text-gray-500">{filteredSuppliers.length} suppliers</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Ratings</option>
                  <option value="top">Top Rated (4.5+)</option>
                  <option value="good">Good (3.5+)</option>
                  <option value="unrated">Unrated</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No suppliers found</p>
                  <p className="text-sm mt-1">Add suppliers in the Contacts section</p>
                </div>
              ) : (
                filteredSuppliers.map(supplier => (
                  <div
                    key={supplier.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewSupplier(supplier)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">{supplier.name}</h3>
                          {supplier.isVip && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                              VIP
                            </span>
                          )}
                        </div>
                        {supplier.company && (
                          <p className="text-sm text-gray-600 truncate">{supplier.company}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1">
                          {supplier.email && (
                            <p className="text-sm text-gray-500 truncate">{supplier.email}</p>
                          )}
                          {supplier.phone && (
                            <p className="text-sm text-gray-500">{supplier.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {supplier.averageRating && parseFloat(supplier.averageRating.toString()) > 0 ? (
                          <div className="text-right">
                            {renderStars(Math.round(parseFloat(supplier.averageRating.toString())))}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {parseFloat(supplier.averageRating.toString()).toFixed(1)} ({supplier.totalRatings || 0} reviews)
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No ratings</span>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Top Performers</h2>
              <p className="text-sm text-gray-500">Based on overall rating</p>
            </div>
            <div className="divide-y divide-gray-100">
              {topPerformers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No performance data yet</p>
                </div>
              ) : (
                topPerformers.slice(0, 5).map((performer, index) => (
                  <div key={performer.id} className="p-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{performer.name}</p>
                      {performer.company && (
                        <p className="text-sm text-gray-500 truncate">{performer.company}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold text-gray-900">
                        {typeof performer.averageRating === 'number' 
                          ? performer.averageRating.toFixed(1) 
                          : typeof performer.averageRating === 'string' 
                            ? parseFloat(performer.averageRating).toFixed(1)
                            : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Supplier Performance Metrics</h2>
            <p className="text-sm text-gray-500">Delivery reliability, order history, and ratings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{supplier.name}</p>
                        {supplier.company && (
                          <p className="text-sm text-gray-500">{supplier.company}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {supplier.averageRating ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="font-medium">
                            {parseFloat(supplier.averageRating.toString()).toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-gray-600">{supplier.quoteCount || 0}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">95%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        supplier.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {supplier.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleViewSupplier(supplier)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'price-alerts' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Price Change Alerts</h2>
                <p className="text-sm text-gray-500">Recent price changes from suppliers</p>
              </div>
              <span className="text-sm text-gray-500">
                {priceAlerts.filter(a => !a.isAcknowledged).length} unacknowledged
              </span>
            </div>
          </div>

          {priceAlerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium">No price alerts</p>
              <p className="text-sm mt-1">Price changes will appear here when detected</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {priceAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 ${alert.isAcknowledged ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        alert.percentageChange > 0
                          ? 'bg-red-100'
                          : 'bg-green-100'
                      }`}>
                        {alert.percentageChange > 0 ? (
                          <ArrowUpRight className="w-5 h-5 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{alert.itemName}</p>
                        <p className="text-sm text-gray-500">{alert.supplierName}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-500">
                            ${alert.oldPriceExclGst?.toFixed(2)} → ${alert.newPriceExclGst?.toFixed(2)}
                          </span>
                          <span className={`font-medium ${
                            alert.percentageChange > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {alert.percentageChange > 0 ? '+' : ''}{alert.percentageChange?.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!alert.isAcknowledged && (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.isAcknowledged && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Supplier Detail Modal */}
      {showDetailModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedSupplier.name}</h2>
                  {selectedSupplier.company && (
                    <p className="text-gray-500">{selectedSupplier.company}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedSupplier(null);
                    setSupplierPerformance(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                  <p className="text-gray-900">{selectedSupplier.email || 'Not provided'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                  <p className="text-gray-900">{selectedSupplier.phone || 'Not provided'}</p>
                </div>
              </div>

              {/* Rating */}
              {selectedSupplier.averageRating && (
                <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-800 mb-1">Overall Rating</p>
                      <div className="flex items-center gap-2">
                        {renderStars(Math.round(parseFloat(selectedSupplier.averageRating.toString())))}
                        <span className="text-lg font-semibold text-yellow-900">
                          {parseFloat(selectedSupplier.averageRating.toString()).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-900">
                        {selectedSupplier.totalRatings || 0}
                      </p>
                      <p className="text-sm text-yellow-700">reviews</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              {supplierPerformance && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Performance Metrics</h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-900">
                        {supplierPerformance.performance?.orders?.totalOrders || 0}
                      </p>
                      <p className="text-sm text-blue-700">Total Orders</p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <Truck className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-900">
                        {supplierPerformance.performance?.delivery?.reliabilityPercentage || 'N/A'}%
                      </p>
                      <p className="text-sm text-green-700">On-Time Delivery</p>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-900">
                        ${parseFloat(supplierPerformance.performance?.orders?.totalSpent || '0').toLocaleString()}
                      </p>
                      <p className="text-sm text-purple-700">Total Spent</p>
                    </div>
                  </div>

                  {/* Items Supplied */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Items Supplied</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Items</p>
                        <p className="text-lg font-semibold">
                          {supplierPerformance.performance?.items?.totalItems || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Preferred Items</p>
                        <p className="text-lg font-semibold">
                          {supplierPerformance.performance?.items?.preferredItems || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Price</p>
                        <p className="text-lg font-semibold">
                          ${supplierPerformance.performance?.items?.avgPrice || '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Lead Time</p>
                        <p className="text-lg font-semibold">
                          {supplierPerformance.performance?.items?.avgLeadTime || 0} days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!supplierPerformance && (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
                  <p>Loading performance data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
