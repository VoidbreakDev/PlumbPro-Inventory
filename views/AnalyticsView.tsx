import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Download,
  Calendar,
  FileText
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
import { analyticsAPI } from '../lib/analyticsAPI';
import type {
  InventoryAnalytics,
  JobProfitability,
  WorkerPerformance,
  SupplierPerformance
} from '../lib/analyticsAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { format, subDays, subMonths } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'jobs' | 'workers' | 'suppliers'>('inventory');
  const [dateRange, setDateRange] = useState({ start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [isLoading, setIsLoading] = useState(false);

  // Analytics data
  const [inventoryData, setInventoryData] = useState<InventoryAnalytics | null>(null);
  const [jobData, setJobData] = useState<JobProfitability | null>(null);
  const [workerData, setWorkerData] = useState<WorkerPerformance | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierPerformance | null>(null);
  const setError = useStore((state) => state.setError);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, activeTab]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'inventory') {
        const data = await analyticsAPI.getInventoryAnalytics(dateRange.start, dateRange.end);
        setInventoryData(data);
      } else if (activeTab === 'jobs') {
        const data = await analyticsAPI.getJobProfitability(dateRange.start, dateRange.end);
        setJobData(data);
      } else if (activeTab === 'workers') {
        const data = await analyticsAPI.getWorkerPerformance(dateRange.start, dateRange.end);
        setWorkerData(data);
      } else if (activeTab === 'suppliers') {
        const data = await analyticsAPI.getSupplierPerformance();
        setSupplierData(data);
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load analytics'));
    } finally {
      setIsLoading(false);
    }
  };

  const setQuickDate = (days: number) => {
    setDateRange({
      start: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('PlumbPro Analytics Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 36);

    let yPosition = 50;

    if (activeTab === 'inventory' && inventoryData) {
      doc.setFontSize(14);
      doc.text('Inventory Analysis', 14, yPosition);
      yPosition += 10;

      // Category value table
      autoTable(doc, {
        startY: yPosition,
        head: [['Category', 'Items', 'Total Stock', 'Value']],
        body: inventoryData.categoryValue.map(cat => [
          cat.category,
          cat.itemCount.toString(),
          cat.totalQuantity.toString(),
          `£${cat.totalValue.toFixed(2)}`
        ])
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Top turnover items
      doc.setFontSize(14);
      doc.text('Top Turnover Items', 14, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Item', 'Category', 'Turnover Rate', 'Total Used']],
        body: inventoryData.turnover.slice(0, 10).map(item => [
          item.name,
          item.category,
          item.turnoverRate.toString(),
          item.totalUsed.toString()
        ])
      });
    } else if (activeTab === 'jobs' && jobData) {
      doc.setFontSize(14);
      doc.text('Job Profitability Analysis', 14, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Job Type', 'Count', 'Avg Cost', 'Total Cost']],
        body: jobData.jobTypeStats.map(jt => [
          jt.jobType,
          jt.jobCount.toString(),
          `£${jt.avgMaterialCost.toFixed(2)}`,
          `£${jt.totalMaterialCost.toFixed(2)}`
        ])
      });
    } else if (activeTab === 'workers' && workerData) {
      doc.setFontSize(14);
      doc.text('Worker Performance', 14, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Worker', 'Total Jobs', 'Completed', 'Completion Rate']],
        body: workerData.workers.map(w => [
          w.name,
          w.totalJobs.toString(),
          w.completedJobs.toString(),
          `${w.completionRate}%`
        ])
      });
    }

    doc.save(`plumbpro-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlumbPro Inventory';
    workbook.created = new Date();

    if (activeTab === 'inventory' && inventoryData) {
      // Category value sheet
      const ws1 = workbook.addWorksheet('Category Values');
      ws1.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Item Count', key: 'itemCount', width: 15 },
        { header: 'Total Stock', key: 'totalStock', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 }
      ];
      inventoryData.categoryValue.forEach(cat => {
        ws1.addRow({
          category: cat.category,
          itemCount: cat.itemCount,
          totalStock: cat.totalQuantity,
          totalValue: cat.totalValue
        });
      });

      // Turnover sheet
      const ws2 = workbook.addWorksheet('Turnover Analysis');
      ws2.columns = [
        { header: 'Item', key: 'item', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Current Stock', key: 'currentStock', width: 15 },
        { header: 'Total Used', key: 'totalUsed', width: 15 },
        { header: 'Turnover Rate', key: 'turnoverRate', width: 15 }
      ];
      inventoryData.turnover.forEach(item => {
        ws2.addRow({
          item: item.name,
          category: item.category,
          currentStock: item.currentStock,
          totalUsed: item.totalUsed,
          turnoverRate: item.turnoverRate
        });
      });

      // Aging stock sheet
      const ws3 = workbook.addWorksheet('Aging Stock');
      ws3.columns = [
        { header: 'Item', key: 'item', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Quantity', key: 'quantity', width: 15 },
        { header: 'Price', key: 'price', width: 15 },
        { header: 'Days Idle', key: 'daysIdle', width: 15 }
      ];
      inventoryData.stockAging.forEach(item => {
        ws3.addRow({
          item: item.name,
          category: item.category,
          quantity: item.quantity,
          price: item.price,
          daysIdle: item.daysIdle || 'Never moved'
        });
      });
    } else if (activeTab === 'jobs' && jobData) {
      // Job type stats
      const ws1 = workbook.addWorksheet('Job Type Stats');
      ws1.columns = [
        { header: 'Job Type', key: 'jobType', width: 25 },
        { header: 'Job Count', key: 'jobCount', width: 15 },
        { header: 'Avg Material Cost', key: 'avgCost', width: 20 },
        { header: 'Total Material Cost', key: 'totalCost', width: 20 }
      ];
      jobData.jobTypeStats.forEach(jt => {
        ws1.addRow({
          jobType: jt.jobType,
          jobCount: jt.jobCount,
          avgCost: jt.avgMaterialCost,
          totalCost: jt.totalMaterialCost
        });
      });

      // Monthly trends
      const ws2 = workbook.addWorksheet('Monthly Trends');
      ws2.columns = [
        { header: 'Month', key: 'month', width: 15 },
        { header: 'Job Count', key: 'jobCount', width: 15 },
        { header: 'Completed', key: 'completed', width: 15 },
        { header: 'Material Cost', key: 'materialCost', width: 20 }
      ];
      jobData.monthlyTrends.forEach(mt => {
        ws2.addRow({
          month: mt.month,
          jobCount: mt.jobCount,
          completed: mt.completedCount,
          materialCost: mt.totalMaterialCost
        });
      });

      // Individual jobs
      const ws3 = workbook.addWorksheet('Jobs');
      ws3.columns = [
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Job Type', key: 'jobType', width: 20 },
        { header: 'Builder', key: 'builder', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Material Cost', key: 'materialCost', width: 15 },
        { header: 'Workers', key: 'workers', width: 12 },
        { header: 'Items', key: 'items', width: 12 }
      ];
      jobData.jobs.forEach(job => {
        ws3.addRow({
          title: job.title,
          jobType: job.jobType,
          builder: job.builder,
          status: job.status,
          date: job.date,
          materialCost: job.materialCost,
          workers: job.workerCount,
          items: job.itemCount
        });
      });
    } else if (activeTab === 'workers' && workerData) {
      const ws = workbook.addWorksheet('Worker Performance');
      ws.columns = [
        { header: 'Worker', key: 'worker', width: 25 },
        { header: 'Total Jobs', key: 'totalJobs', width: 15 },
        { header: 'Completed', key: 'completed', width: 15 },
        { header: 'In Progress', key: 'inProgress', width: 15 },
        { header: 'Completion Rate', key: 'completionRate', width: 18 },
        { header: 'Materials Handled', key: 'materialsHandled', width: 20 }
      ];
      workerData.workers.forEach(w => {
        ws.addRow({
          worker: w.name,
          totalJobs: w.totalJobs,
          completed: w.completedJobs,
          inProgress: w.inProgressJobs,
          completionRate: `${w.completionRate}%`,
          materialsHandled: w.totalMaterialsHandled
        });
      });
    } else if (activeTab === 'suppliers' && supplierData) {
      const ws = workbook.addWorksheet('Supplier Performance');
      ws.columns = [
        { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'Company', key: 'company', width: 30 },
        { header: 'Total Items', key: 'totalItems', width: 15 },
        { header: 'Total Stock', key: 'totalStock', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
        { header: 'Low Stock Items', key: 'lowStockItems', width: 18 }
      ];
      supplierData.suppliers.forEach(s => {
        ws.addRow({
          supplier: s.name,
          company: s.company,
          totalItems: s.totalItems,
          totalStock: s.totalStock,
          totalValue: s.totalValue,
          lowStockItems: s.lowStockItems
        });
      });
    }

    // Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plumbpro-analytics-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            Analytics & Reports
          </h1>
          <p className="text-slate-600 mt-1">Business insights and performance metrics</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="font-medium text-slate-700">Date Range:</span>
          </div>

          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-1.5 border border-slate-300 rounded-lg"
          />
          <span className="text-slate-600">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-1.5 border border-slate-300 rounded-lg"
          />

          <div className="flex gap-2 ml-auto">
            <button onClick={() => setQuickDate(7)} className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
              Last 7 days
            </button>
            <button onClick={() => setQuickDate(30)} className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
              Last 30 days
            </button>
            <button onClick={() => setQuickDate(90)} className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
              Last 90 days
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Inventory Analysis
          </div>
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Job Profitability
          </div>
        </button>
        <button
          onClick={() => setActiveTab('workers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'workers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Worker Performance
          </div>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'suppliers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Supplier Performance
          </div>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Inventory Analytics */}
      {activeTab === 'inventory' && inventoryData && !isLoading && (
        <div className="space-y-6">
          {/* Stock Value by Category */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Stock Value by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={inventoryData.categoryValue}
                  dataKey="totalValue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.category}: £${entry.totalValue.toFixed(0)}`}
                >
                  {inventoryData.categoryValue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `£${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Turnover Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Inventory Turnover Rate (Top 10)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={inventoryData.turnover.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="turnoverRate" fill="#3b82f6" name="Turnover Rate" />
                <Bar dataKey="totalUsed" fill="#10b981" name="Total Used" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Aging Stock */}
          {inventoryData.stockAging.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Slow-Moving Stock (60+ days)</h3>
                <p className="text-sm text-slate-600 mt-1">Items with no recent movement</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Days Idle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventoryData.stockAging.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-800">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.category}</td>
                        <td className="px-6 py-4 text-sm text-slate-800">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-slate-800">£{(item.price * item.quantity).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            {item.daysIdle ? `${item.daysIdle} days` : 'Never moved'}
                          </span>
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

      {/* Job Profitability */}
      {activeTab === 'jobs' && jobData && !isLoading && (
        <div className="space-y-6">
          {/* Job Type Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Material Cost by Job Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={jobData.jobTypeStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jobType" />
                <YAxis />
                <Tooltip formatter={(value: number) => `£${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="avgMaterialCost" fill="#3b82f6" name="Avg Cost" />
                <Bar dataKey="totalMaterialCost" fill="#10b981" name="Total Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trends */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Job Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={jobData.monthlyTrends.reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="jobCount" stroke="#3b82f6" name="Jobs" />
                <Line yAxisId="left" type="monotone" dataKey="completedCount" stroke="#10b981" name="Completed" />
                <Line yAxisId="right" type="monotone" dataKey="totalMaterialCost" stroke="#f59e0b" name="Material Cost (£)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Jobs Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Job Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Job</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Builder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Material Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Workers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {jobData.jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-800">{job.title}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{job.jobType}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{job.builder || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(job.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-medium">£{job.materialCost.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{job.workerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Worker Performance */}
      {activeTab === 'workers' && workerData && !isLoading && (
        <div className="space-y-6">
          {/* Worker comparison chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Job Completion Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workerData.workers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalJobs" fill="#3b82f6" name="Total Jobs" />
                <Bar dataKey="completedJobs" fill="#10b981" name="Completed" />
                <Bar dataKey="inProgressJobs" fill="#f59e0b" name="In Progress" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Worker table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Worker Statistics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Worker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Total Jobs</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">In Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Completion Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Materials Handled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {workerData.workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{worker.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{worker.totalJobs}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">{worker.completedJobs}</td>
                      <td className="px-6 py-4 text-sm text-blue-600">{worker.inProgressJobs}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${worker.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-slate-600 font-medium">{worker.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">£{worker.totalMaterialsHandled.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Performance */}
      {activeTab === 'suppliers' && supplierData && !isLoading && (
        <div className="space-y-6">
          {/* Supplier value chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Stock Value by Supplier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={supplierData.suppliers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => `£${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="totalValue" fill="#3b82f6" name="Total Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Supplier table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Supplier Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Total Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Total Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Stock Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Low Stock Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {supplierData.suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{supplier.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{supplier.company || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{supplier.totalItems}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{supplier.totalStock}</td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-medium">£{supplier.totalValue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm">
                        {supplier.lowStockItems > 0 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                            {supplier.lowStockItems} items
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
