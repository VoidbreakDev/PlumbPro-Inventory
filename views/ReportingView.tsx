/**
 * Reporting View
 * Comprehensive business reports and analytics for Phase 2 & 3
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Users,
  Briefcase,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  FileText,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Activity,
  Truck,
  X,
  Star,
  StarOff,
  Play,
  Plus,
  Settings,
  Mail,
  Trash2,
  Save,
  Eye
} from 'lucide-react';
import { StatCard } from '../components/Shared';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { advancedAnalyticsAPI, AnalyticsDashboard, JobProfitability, InventoryAnalytics, CustomerAnalytics, SavedReport } from '../lib/advancedAnalyticsAPI';

interface ReportData {
  inventoryValue: number;
  lowStockCount: number;
  jobStats: Record<string, number>;
  recentMovements: Array<{ type: string; count: number; totalQuantity: number }>;
  topUsedItems: Array<{ id: string; name: string; category: string; totalUsed: number }>;
}

interface InventoryReport {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  categoryBreakdown: Array<{ category: string; count: number; value: number }>;
  slowMovingItems: Array<{ id: string; name: string; lastMovement: string; quantity: number }>;
  fastMovingItems: Array<{ id: string; name: string; movements: number; totalQuantity: number }>;
}

interface JobReport {
  totalJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  scheduledJobs: number;
  averageJobValue: number;
  jobsByMonth: Array<{ month: string; count: number; value: number }>;
  topClients: Array<{ name: string; jobs: number; totalValue: number }>;
}

interface FinancialReport {
  totalRevenue: number;
  totalQuoted: number;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  averageQuoteValue: number;
  averageInvoiceValue: number;
  revenueByMonth: Array<{ month: string; quoted: number; invoiced: number; paid: number }>;
}

type ReportType = 'overview' | 'inventory' | 'jobs' | 'financial' | 'supplier' | 'customers' | 'saved';

export function ReportingView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportType>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [jobReport, setJobReport] = useState<JobReport | null>(null);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);

  // Advanced Analytics State
  const [advancedDashboard, setAdvancedDashboard] = useState<AnalyticsDashboard | null>(null);
  const [jobProfitability, setJobProfitability] = useState<JobProfitability | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<InventoryAnalytics | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showCreateReport, setShowCreateReport] = useState(false);

  useEffect(() => {
    loadReports();
  }, [activeReport, dateRange]);

  const getPeriodDays = () => {
    switch (dateRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  };

  const loadReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const periodDays = getPeriodDays();

      // Load dashboard analytics (both basic and advanced)
      const [dashboardResponse, advancedResponse] = await Promise.all([
        api.get('/analytics/dashboard').catch(() => ({ data: null })),
        advancedAnalyticsAPI.getDashboard(periodDays).catch(() => null)
      ]);

      setReportData(dashboardResponse.data);
      setAdvancedDashboard(advancedResponse);

      // Load additional reports based on active tab
      if (activeReport === 'inventory') {
        const [inventoryResponse, advancedInvResponse] = await Promise.all([
          api.get('/analytics/inventory').catch(() => ({ data: null })),
          advancedAnalyticsAPI.getInventoryAnalytics(periodDays).catch(() => null)
        ]);
        setInventoryReport(inventoryResponse.data);
        setInventoryAnalytics(advancedInvResponse);
      } else if (activeReport === 'jobs') {
        const [jobsResponse, profitResponse] = await Promise.all([
          api.get('/analytics/jobs', { params: { range: dateRange } }).catch(() => ({ data: null })),
          advancedAnalyticsAPI.getJobProfitability(periodDays).catch(() => null)
        ]);
        setJobReport(jobsResponse.data);
        setJobProfitability(profitResponse);
      } else if (activeReport === 'financial') {
        // Try to get financial data from quotes and invoices
        const [quotesStats, invoicesStats] = await Promise.all([
          api.get('/quotes/stats').catch(() => ({ data: {} })),
          api.get('/invoices/stats').catch(() => ({ data: {} }))
        ]);

        setFinancialReport({
          totalRevenue: invoicesStats.data?.total_paid || 0,
          totalQuoted: quotesStats.data?.total_quoted || 0,
          totalInvoiced: invoicesStats.data?.total_invoiced || 0,
          totalPaid: invoicesStats.data?.total_paid || 0,
          outstanding: invoicesStats.data?.outstanding || 0,
          averageQuoteValue: quotesStats.data?.average_quote || 0,
          averageInvoiceValue: invoicesStats.data?.average_invoice || 0,
          revenueByMonth: []
        });
      } else if (activeReport === 'customers') {
        const customerData = await advancedAnalyticsAPI.getCustomerAnalytics().catch(() => null);
        setCustomerAnalytics(customerData);
      } else if (activeReport === 'saved') {
        const { reports } = await advancedAnalyticsAPI.getReports().catch(() => ({ reports: [] }));
        setSavedReports(reports);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (report: SavedReport) => {
    try {
      await advancedAnalyticsAPI.updateReport(report.id, { isFavorite: !report.isFavorite });
      setSavedReports(reports =>
        reports.map(r => r.id === report.id ? { ...r, isFavorite: !r.isFavorite } : r)
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update report'));
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await advancedAnalyticsAPI.deleteReport(reportId);
      setSavedReports(reports => reports.filter(r => r.id !== reportId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete report'));
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    // Placeholder for export functionality
    alert(`Export to ${format.toUpperCase()} coming soon!`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(value);
  };

  const reportTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'supplier', label: 'Supplier', icon: Truck },
    { id: 'saved', label: 'Saved Reports', icon: FileText }
  ];

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
          <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">
            Business insights, inventory analytics, and financial reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={loadReports}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {reportTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeReport === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading reports...</span>
        </div>
      )}

      {/* Overview Report */}
      {!loading && activeReport === 'overview' && reportData && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Package}
              label="Inventory Value"
              value={formatCurrency(reportData.inventoryValue)}
              color="blue"
            />
            <StatCard
              icon={AlertCircle}
              label="Low Stock Items"
              value={reportData.lowStockCount.toString()}
              color={reportData.lowStockCount > 5 ? 'red' : 'yellow'}
            />
            <StatCard
              icon={Briefcase}
              label="Active Jobs"
              value={(reportData.jobStats?.['In Progress'] || 0).toString()}
              color="green"
            />
            <StatCard
              icon={Activity}
              label="Recent Movements"
              value={reportData.recentMovements?.reduce((acc, m) => acc + m.count, 0).toString() || '0'}
              color="purple"
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Status Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status Overview</h3>
              <div className="space-y-3">
                {Object.entries(reportData.jobStats || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-gray-600">{status}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            status === 'Completed' ? 'bg-green-500' :
                            status === 'In Progress' ? 'bg-blue-500' :
                            status === 'Scheduled' ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`}
                          style={{
                            width: `${(count / Object.values(reportData.jobStats).reduce((a, b) => a + b, 1)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="font-semibold text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock Movements */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Movements</h3>
              {reportData.recentMovements?.length > 0 ? (
                <div className="space-y-3">
                  {reportData.recentMovements.map((movement) => (
                    <div key={`movement-${movement.type}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {movement.type === 'In' ? (
                          <ArrowDownRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium text-gray-900">{movement.type}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{movement.count} transactions</p>
                        <p className="text-sm text-gray-500">{movement.totalQuantity} items</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No recent movements</p>
              )}
            </div>
          </div>

          {/* Top Used Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Used Items (Last 30 Days)</h3>
            {reportData.topUsedItems?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.topUsedItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-gray-100 text-gray-700' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="font-medium text-gray-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.category}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{item.totalUsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No usage data available</p>
            )}
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {!loading && activeReport === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Package}
              label="Total Items"
              value={inventoryReport?.totalItems?.toString() || '0'}
              color="blue"
            />
            <StatCard
              icon={DollarSign}
              label="Total Value"
              value={formatCurrency(inventoryReport?.totalValue || 0)}
              color="green"
            />
            <StatCard
              icon={AlertCircle}
              label="Low Stock"
              value={inventoryReport?.lowStockItems?.toString() || '0'}
              color="yellow"
            />
            <StatCard
              icon={X}
              label="Out of Stock"
              value={inventoryReport?.outOfStockItems?.toString() || '0'}
              color="red"
            />
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Category</h3>
            {inventoryReport?.categoryBreakdown?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventoryReport.categoryBreakdown.map(category => (
                  <div key={category.category} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{category.category || 'Uncategorized'}</p>
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-500">{category.count} items</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(category.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No category data available</p>
              </div>
            )}
          </div>

          {/* Slow Moving Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Slow Moving Inventory</h3>
            <p className="text-sm text-gray-500 mb-4">Items with no movement in the last 90 days</p>
            {inventoryReport?.slowMovingItems?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Movement
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inventoryReport.slowMovingItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {item.lastMovement ? new Date(item.lastMovement).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No slow-moving items found</p>
            )}
          </div>
        </div>
      )}

      {/* Jobs Report */}
      {!loading && activeReport === 'jobs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Briefcase}
              label="Total Jobs"
              value={jobReport?.totalJobs?.toString() || (reportData?.jobStats ? Object.values(reportData.jobStats).reduce((a, b) => a + b, 0).toString() : '0')}
              color="blue"
            />
            <StatCard
              icon={Clock}
              label="In Progress"
              value={jobReport?.inProgressJobs?.toString() || reportData?.jobStats?.['In Progress']?.toString() || '0'}
              color="yellow"
            />
            <StatCard
              icon={Calendar}
              label="Scheduled"
              value={jobReport?.scheduledJobs?.toString() || reportData?.jobStats?.['Scheduled']?.toString() || '0'}
              color="purple"
            />
            <StatCard
              icon={TrendingUp}
              label="Completed"
              value={jobReport?.completedJobs?.toString() || reportData?.jobStats?.['Completed']?.toString() || '0'}
              color="green"
            />
          </div>

          {/* Job Profitability */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Profitability Analysis</h3>
            <p className="text-gray-500 text-center py-8">
              Profitability tracking requires jobs to be linked with quotes and invoices.
              As more jobs are completed with full financial tracking, this section will populate.
            </p>
          </div>

          {/* Top Clients */}
          {jobReport?.topClients?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clients by Job Volume</h3>
              <div className="space-y-3">
                {jobReport.topClients.map((client, idx) => (
                  <div key={client.name || `client-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                        idx === 1 ? 'bg-gray-100 text-gray-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-900">{client.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{client.jobs} jobs</p>
                      <p className="text-sm text-gray-500">{formatCurrency(client.totalValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Report */}
      {!loading && activeReport === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={FileText}
              label="Total Quoted"
              value={formatCurrency(financialReport?.totalQuoted || 0)}
              color="blue"
            />
            <StatCard
              icon={DollarSign}
              label="Total Invoiced"
              value={formatCurrency(financialReport?.totalInvoiced || 0)}
              color="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Total Paid"
              value={formatCurrency(financialReport?.totalPaid || 0)}
              color="purple"
            />
            <StatCard
              icon={AlertCircle}
              label="Outstanding"
              value={formatCurrency(financialReport?.outstanding || 0)}
              color={financialReport?.outstanding && financialReport.outstanding > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Averages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Analytics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Average Quote Value</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(financialReport?.averageQuoteValue || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-semibold text-gray-900">
                    {financialReport?.totalQuoted && financialReport?.totalInvoiced
                      ? `${((financialReport.totalInvoiced / financialReport.totalQuoted) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Analytics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Average Invoice Value</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(financialReport?.averageInvoiceValue || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Collection Rate</span>
                  <span className="font-semibold text-gray-900">
                    {financialReport?.totalInvoiced && financialReport?.totalPaid
                      ? `${((financialReport.totalPaid / financialReport.totalInvoiced) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Status Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status Summary</h3>
            <p className="text-sm text-gray-500 mb-4">Overview of outstanding payments and collection efficiency</p>
            {financialReport?.outstanding && financialReport.outstanding > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(financialReport.outstanding)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">All Payments Collected</p>
                    <p className="text-sm text-green-700">No outstanding invoices</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Report */}
      {!loading && activeReport === 'supplier' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Supplier Analytics</p>
                <p className="text-sm text-blue-700 mt-1">
                  For detailed supplier performance metrics, delivery tracking, and price analysis,
                  visit the dedicated Supplier Dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Supplier Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <Truck className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <p className="text-2xl font-bold text-gray-900">--</p>
              <p className="text-gray-500">Active Suppliers</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <Clock className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-2xl font-bold text-gray-900">--</p>
              <p className="text-gray-500">Avg Lead Time (days)</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <TrendingUp className="w-10 h-10 text-purple-500 mx-auto mb-3" />
              <p className="text-2xl font-bold text-gray-900">--</p>
              <p className="text-gray-500">On-Time Delivery %</p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Analytics Report */}
      {!loading && activeReport === 'customers' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Customers"
              value={customerAnalytics?.summary?.totalCustomers?.toString() || '0'}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="New (30 Days)"
              value={customerAnalytics?.summary?.newLast30Days?.toString() || '0'}
              color="green"
            />
            <StatCard
              icon={Activity}
              label="Active (90 Days)"
              value={customerAnalytics?.summary?.activeLast90Days?.toString() || '0'}
              color="purple"
            />
            <StatCard
              icon={DollarSign}
              label="Avg Lifetime Value"
              value={formatCurrency(customerAnalytics?.summary?.avgLifetimeValue || 0)}
              color="yellow"
            />
          </div>

          {/* Customer Retention */}
          {customerAnalytics?.retention && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Retention Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{customerAnalytics.retention.neverBooked}</p>
                  <p className="text-sm text-gray-500">Never Booked</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{customerAnalytics.retention.oneTime}</p>
                  <p className="text-sm text-gray-500">One-Time</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{customerAnalytics.retention.occasional}</p>
                  <p className="text-sm text-gray-500">Occasional (2-5)</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{customerAnalytics.retention.frequent}</p>
                  <p className="text-sm text-gray-500">Frequent (5+)</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{customerAnalytics.retention.churned}</p>
                  <p className="text-sm text-gray-500">Churned (6mo+)</p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Segments */}
          {customerAnalytics?.bySegment && customerAnalytics.bySegment.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Customer Type</h3>
              <div className="space-y-3">
                {customerAnalytics.bySegment.map((segment) => (
                  <div key={`segment-${segment.customerType || 'other'}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{segment.customerType || 'Other'}</p>
                      <p className="text-sm text-gray-500">{segment.customerCount} customers, {segment.totalJobs} jobs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(segment.totalRevenue)}</p>
                      <p className="text-sm text-gray-500">Avg: {formatCurrency(segment.avgJobValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Customers */}
          {customerAnalytics?.topCustomers && customerAnalytics.topCustomers.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers by Lifetime Value</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jobs</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lifetime Value</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Job</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {customerAnalytics.topCustomers.slice(0, 10).map((customer, idx) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-gray-100 text-gray-700' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="font-medium text-gray-900">{customer.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                            {customer.customerType || customer.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{customer.totalJobs}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(customer.lifetimeValue)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(customer.avgJobValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Reports */}
      {!loading && activeReport === 'saved' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Saved Reports</h2>
              <p className="text-sm text-gray-500">Create and schedule custom reports</p>
            </div>
            <button
              onClick={() => setShowCreateReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Report
            </button>
          </div>

          {/* Reports Grid */}
          {savedReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedReports.map(report => (
                <div key={report.id} className="bg-white rounded-lg shadow p-4 border border-gray-100 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{report.name}</h4>
                        <button
                          onClick={() => toggleFavorite(report)}
                          className="text-gray-400 hover:text-yellow-500"
                        >
                          {report.isFavorite ? (
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{report.reportType.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  {report.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{report.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>Last run: {report.lastRunAt ? new Date(report.lastRunAt).toLocaleDateString() : 'Never'}</span>
                    {report.schedule && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Mail className="w-3 h-3" />
                        {report.schedule.frequency}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100">
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100">
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Saved Reports</h3>
              <p className="text-gray-500 mb-4">Create custom reports to track the metrics that matter most to your business.</p>
              <button
                onClick={() => setShowCreateReport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create Your First Report
              </button>
            </div>
          )}

          {/* Report Templates */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Templates</h3>
            <p className="text-sm text-gray-500 mb-4">Quick start with pre-configured report types</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { type: 'job_profitability', label: 'Job Profitability', icon: Briefcase, color: 'blue' },
                { type: 'inventory_turnover', label: 'Inventory Turnover', icon: Package, color: 'green' },
                { type: 'customer_lifetime_value', label: 'Customer LTV', icon: Users, color: 'purple' },
                { type: 'payment_aging', label: 'Payment Aging', icon: Clock, color: 'yellow' },
              ].map(template => (
                <button
                  key={template.type}
                  onClick={() => {
                    // Would open create dialog with template pre-selected
                    setShowCreateReport(true);
                  }}
                  className={`p-4 rounded-lg border-2 border-dashed border-${template.color}-200 hover:border-${template.color}-400 hover:bg-${template.color}-50 transition-colors text-left`}
                >
                  <template.icon className={`w-8 h-8 text-${template.color}-500 mb-2`} />
                  <p className="font-medium text-gray-900">{template.label}</p>
                  <p className="text-xs text-gray-500 mt-1">Click to create</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Report Modal (simplified) */}
      {showCreateReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Report</h3>
              <button onClick={() => setShowCreateReport(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                <input
                  type="text"
                  placeholder="e.g., Monthly Job Summary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="job_profitability">Job Profitability</option>
                  <option value="inventory_turnover">Inventory Turnover</option>
                  <option value="customer_lifetime_value">Customer Lifetime Value</option>
                  <option value="sales_summary">Sales Summary</option>
                  <option value="payment_aging">Payment Aging</option>
                  <option value="stock_valuation">Stock Valuation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  placeholder="Brief description of this report..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateReport(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Would call API to create report
                    alert('Report creation coming soon!');
                    setShowCreateReport(false);
                  }}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Create Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
