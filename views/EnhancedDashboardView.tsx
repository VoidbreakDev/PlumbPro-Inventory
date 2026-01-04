import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Briefcase,
  Users,
  DollarSign,
  AlertTriangle,
  Calendar,
  Activity,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { analyticsAPI } from '../lib/analyticsAPI';
import type { DashboardAnalytics, MovementTrends } from '../lib/analyticsAPI';
import { StatCard } from '../components/Shared';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function EnhancedDashboardView() {
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(null);
  const [movementTrends, setMovementTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [dashboard, trends] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getMovementTrends(
          getStartDate(selectedPeriod),
          new Date().toISOString(),
          selectedPeriod === '7d' ? 'day' : 'day'
        )
      ]);

      setDashboardData(dashboard);

      // Process trends data for charts
      const processedTrends = processTrendsData(trends.trends);
      setMovementTrends(processedTrends);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStartDate = (period: string): string => {
    const date = new Date();
    switch (period) {
      case '7d':
        date.setDate(date.getDate() - 7);
        break;
      case '30d':
        date.setDate(date.getDate() - 30);
        break;
      case '90d':
        date.setDate(date.getDate() - 90);
        break;
    }
    return date.toISOString();
  };

  const processTrendsData = (trends: any[]) => {
    const groupedByPeriod: Record<string, any> = {};

    trends.forEach((trend) => {
      if (!groupedByPeriod[trend.period]) {
        groupedByPeriod[trend.period] = {
          period: trend.period,
          In: 0,
          Out: 0,
          Adjustment: 0,
          Allocation: 0
        };
      }
      groupedByPeriod[trend.period][trend.type] = trend.totalQuantity;
    });

    return Object.values(groupedByPeriod).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  };

  const calculateTrend = (type: string): number => {
    if (!dashboardData) return 0;
    const movements = dashboardData.recentMovements.find(m => m.type === type);
    if (!movements) return 0;
    // Simple trend calculation - could be enhanced
    return movements.count;
  };

  const getTrendColor = (value: number, inverse: boolean = false) => {
    if (value === 0) return 'text-slate-600';
    const isPositive = value > 0;
    return inverse
      ? (isPositive ? 'text-red-600' : 'text-green-600')
      : (isPositive ? 'text-green-600' : 'text-red-600');
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-center py-12 text-slate-600">Failed to load dashboard</div>;
  }

  const totalJobs = Object.values(dashboardData.jobStats).reduce((sum, count) => sum + count, 0);
  const completionRate = totalJobs > 0
    ? ((dashboardData.jobStats.Completed || 0) / totalJobs * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Business overview and key metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
          icon={DollarSign}
          label="Total Inventory Value"
          value={`£${dashboardData.inventoryValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={calculateTrend('In') > calculateTrend('Out') ? 'up' : 'down'}
          color="blue"
        />

        <StatCard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={dashboardData.lowStockCount.toString()}
          trend={dashboardData.lowStockCount > 5 ? 'down' : 'up'}
          color="yellow"
        />

        <StatCard
          icon={Briefcase}
          label="Active Jobs"
          value={(dashboardData.jobStats['Scheduled'] + dashboardData.jobStats['In Progress']).toString()}
          color="green"
        />

        <StatCard
          icon={Users}
          label="Completion Rate"
          value={`${completionRate}%`}
          trend={parseFloat(completionRate) > 80 ? 'up' : 'down'}
          color="blue"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Movement Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Stock Movement Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={movementTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="In" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Stock In" />
              <Area type="monotone" dataKey="Out" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Stock Out" />
              <Area type="monotone" dataKey="Adjustment" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Adjustments" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Job Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Job Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(dashboardData.jobStats).map(([key, value]) => ({
                  name: key,
                  value: value
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {Object.entries(dashboardData.jobStats).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Used Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Top Used Items (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardData.topUsedItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="totalUsed" fill="#3b82f6" name="Quantity Used" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Recent Activity (30 Days)
          </h3>
          <div className="space-y-4">
            {dashboardData.recentMovements.map((movement, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    movement.type === 'In' ? 'bg-green-100 text-green-600' :
                    movement.type === 'Out' ? 'bg-red-100 text-red-600' :
                    movement.type === 'Adjustment' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {movement.type === 'In' ? <TrendingUp className="w-5 h-5" /> :
                     movement.type === 'Out' ? <TrendingDown className="w-5 h-5" /> :
                     <Activity className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{movement.type}</p>
                    <p className="text-sm text-slate-600">{movement.count} movements</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-800">{movement.totalQuantity}</p>
                  <p className="text-xs text-slate-600">items</p>
                </div>
              </div>
            ))}

            {dashboardData.recentMovements.length === 0 && (
              <div className="text-center py-8 text-slate-600">
                <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {dashboardData.lowStockCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Stock Alert
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                You have {dashboardData.lowStockCount} item{dashboardData.lowStockCount > 1 ? 's' : ''} at or below reorder level.
                Consider placing orders soon to avoid stockouts.
              </p>
              <a href="/inventory" className="mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 inline-block">
                View Items →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {dashboardData.recentMovements.reduce((sum, m) => sum + m.count, 0)}
          </div>
          <div className="text-sm text-slate-600 mt-1">Total Movements</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {dashboardData.jobStats.Completed || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">Jobs Completed</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {dashboardData.jobStats['In Progress'] || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">Jobs In Progress</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {dashboardData.topUsedItems.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Active Items</div>
        </div>
      </div>
    </div>
  );
}
