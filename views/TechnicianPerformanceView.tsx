/**
 * Technician Performance Dashboard
 * Analytics and comparison of technician performance metrics
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Star,
  Award,
  Target,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Trophy,
} from 'lucide-react';
import type { TechnicianPerformance } from '../types';
import { Badge } from '../components/Shared';

// Mock data for development
const MOCK_TECHNICIANS: TechnicianPerformance[] = [
  {
    userId: '1',
    userName: 'John Smith',
    totalJobs: 47,
    completedJobs: 45,
    cancelledJobs: 2,
    completionRate: 95.7,
    averageJobDuration: 3.2,
    onTimeArrivalRate: 92,
    averageResponseTime: 18,
    totalRevenue: 42850,
    totalCost: 28500,
    totalProfit: 14350,
    averageJobValue: 911,
    profitMargin: 33.5,
    callbackCount: 1,
    callbackRate: 2.2,
    customerRating: 4.8,
    averageTravelTime: 22,
    materialsUtilization: 94,
    periodLabel: 'This Month',
    trends: {
      jobsTrend: 'up',
      revenueTrend: 'up',
      profitTrend: 'up',
      ratingTrend: 'stable',
    },
  },
  {
    userId: '2',
    userName: 'Mike Johnson',
    totalJobs: 38,
    completedJobs: 36,
    cancelledJobs: 2,
    completionRate: 94.7,
    averageJobDuration: 2.8,
    onTimeArrivalRate: 88,
    averageResponseTime: 25,
    totalRevenue: 32100,
    totalCost: 21800,
    totalProfit: 10300,
    averageJobValue: 845,
    profitMargin: 32.1,
    callbackCount: 2,
    callbackRate: 5.6,
    customerRating: 4.5,
    averageTravelTime: 28,
    materialsUtilization: 89,
    periodLabel: 'This Month',
    trends: {
      jobsTrend: 'up',
      revenueTrend: 'stable',
      profitTrend: 'down',
      ratingTrend: 'down',
    },
  },
  {
    userId: '3',
    userName: 'Sarah Williams',
    totalJobs: 52,
    completedJobs: 51,
    cancelledJobs: 1,
    completionRate: 98.1,
    averageJobDuration: 2.5,
    onTimeArrivalRate: 96,
    averageResponseTime: 12,
    totalRevenue: 48900,
    totalCost: 31200,
    totalProfit: 17700,
    averageJobValue: 940,
    profitMargin: 36.2,
    callbackCount: 0,
    callbackRate: 0,
    customerRating: 4.9,
    averageTravelTime: 18,
    materialsUtilization: 97,
    periodLabel: 'This Month',
    trends: {
      jobsTrend: 'up',
      revenueTrend: 'up',
      profitTrend: 'up',
      ratingTrend: 'up',
    },
  },
  {
    userId: '4',
    userName: 'David Brown',
    totalJobs: 29,
    completedJobs: 26,
    cancelledJobs: 3,
    completionRate: 89.7,
    averageJobDuration: 4.1,
    onTimeArrivalRate: 79,
    averageResponseTime: 35,
    totalRevenue: 24100,
    totalCost: 17200,
    totalProfit: 6900,
    averageJobValue: 831,
    profitMargin: 28.6,
    callbackCount: 3,
    callbackRate: 11.5,
    customerRating: 4.2,
    averageTravelTime: 32,
    materialsUtilization: 82,
    periodLabel: 'This Month',
    trends: {
      jobsTrend: 'down',
      revenueTrend: 'down',
      profitTrend: 'down',
      ratingTrend: 'stable',
    },
  },
  {
    userId: '5',
    userName: 'Emma Davis',
    totalJobs: 41,
    completedJobs: 40,
    cancelledJobs: 1,
    completionRate: 97.6,
    averageJobDuration: 2.9,
    onTimeArrivalRate: 94,
    averageResponseTime: 15,
    totalRevenue: 38400,
    totalCost: 24800,
    totalProfit: 13600,
    averageJobValue: 936,
    profitMargin: 35.4,
    callbackCount: 1,
    callbackRate: 2.5,
    customerRating: 4.7,
    averageTravelTime: 20,
    materialsUtilization: 95,
    periodLabel: 'This Month',
    trends: {
      jobsTrend: 'up',
      revenueTrend: 'up',
      profitTrend: 'stable',
      ratingTrend: 'up',
    },
  },
];

type SortBy = 'jobs' | 'revenue' | 'profit' | 'rating' | 'efficiency';
type Period = 'week' | 'month' | 'quarter' | 'year';

export function TechnicianPerformanceView() {
  const [sortBy, setSortBy] = useState<SortBy>('profit');
  const [period, setPeriod] = useState<Period>('month');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const technicians = MOCK_TECHNICIANS;

  // Sort technicians
  const sortedTechnicians = useMemo(() => {
    const sorted = [...technicians].sort((a, b) => {
      switch (sortBy) {
        case 'jobs': return b.totalJobs - a.totalJobs;
        case 'revenue': return b.totalRevenue - a.totalRevenue;
        case 'profit': return b.totalProfit - a.totalProfit;
        case 'rating': return b.customerRating - a.customerRating;
        case 'efficiency': return b.completionRate - a.completionRate;
        default: return 0;
      }
    });
    return sorted;
  }, [technicians, sortBy]);

  // Calculate averages
  const averages = useMemo(() => {
    const count = technicians.length;
    return {
      jobs: technicians.reduce((sum, t) => sum + t.totalJobs, 0) / count,
      revenue: technicians.reduce((sum, t) => sum + t.totalRevenue, 0) / count,
      profit: technicians.reduce((sum, t) => sum + t.totalProfit, 0) / count,
      rating: technicians.reduce((sum, t) => sum + t.customerRating, 0) / count,
      completionRate: technicians.reduce((sum, t) => sum + t.completionRate, 0) / count,
    };
  }, [technicians]);

  // Find top performer
  const topPerformer = sortedTechnicians[0];

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <span className="w-5 h-5 flex items-center justify-center bg-slate-200 rounded-full text-xs font-bold text-slate-600">2</span>;
    if (index === 2) return <span className="w-5 h-5 flex items-center justify-center bg-amber-100 rounded-full text-xs font-bold text-amber-700">3</span>;
    return <span className="w-5 h-5 flex items-center justify-center text-xs text-slate-400">{index + 1}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Technician Performance</h1>
          <p className="text-slate-500 mt-1">Compare team performance and identify top performers</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="jobs">Sort by Jobs</option>
            <option value="revenue">Sort by Revenue</option>
            <option value="profit">Sort by Profit</option>
            <option value="rating">Sort by Rating</option>
            <option value="efficiency">Sort by Efficiency</option>
          </select>
        </div>
      </div>

      {/* Top Performer Highlight */}
      {topPerformer && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <span className="font-semibold text-yellow-800">Top Performer</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {topPerformer.userName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{topPerformer.userName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">{topPerformer.customerRating.toFixed(1)}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{topPerformer.totalJobs} jobs completed</span>
                </div>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">${topPerformer.totalProfit.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Profit Generated</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{topPerformer.completionRate.toFixed(0)}%</p>
                <p className="text-sm text-slate-500">Completion Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{topPerformer.callbackRate.toFixed(1)}%</p>
                <p className="text-sm text-slate-500">Callback Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Avg Jobs/Technician</p>
          <p className="text-2xl font-bold text-slate-800">{averages.jobs.toFixed(0)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Avg Revenue</p>
          <p className="text-2xl font-bold text-slate-800">${averages.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Avg Rating</p>
          <p className="text-2xl font-bold text-slate-800">{averages.rating.toFixed(1)} ★</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Avg Completion</p>
          <p className="text-2xl font-bold text-slate-800">{averages.completionRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Performance Rankings</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Technician</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Jobs</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Revenue</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Profit</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Margin</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Rating</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Completion</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Callbacks</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Trends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTechnicians.map((tech, index) => (
                <tr 
                  key={tech.userId}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedTech(selectedTech === tech.userId ? null : tech.userId)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center">
                      {getRankBadge(index)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold">
                        {tech.userName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-slate-800">{tech.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div>
                      <span className="font-semibold text-slate-800">{tech.totalJobs}</span>
                      <p className="text-xs text-slate-400">{tech.completedJobs} done</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center font-semibold text-slate-800">
                    ${tech.totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-green-600">${tech.totalProfit.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-semibold ${tech.profitMargin >= 35 ? 'text-green-600' : tech.profitMargin >= 30 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {tech.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{tech.customerRating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-semibold ${tech.completionRate >= 95 ? 'text-green-600' : tech.completionRate >= 90 ? 'text-blue-600' : 'text-red-600'}`}>
                      {tech.completionRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-semibold ${tech.callbackRate <= 3 ? 'text-green-600' : tech.callbackRate <= 7 ? 'text-amber-600' : 'text-red-600'}`}>
                      {tech.callbackRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {getTrendIcon(tech.trends.profitTrend)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed View (when technician selected) */}
      {selectedTech && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {(() => {
            const tech = technicians.find(t => t.userId === selectedTech);
            if (!tech) return null;
            
            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {tech.userName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{tech.userName}</h2>
                      <p className="text-slate-500">Detailed Performance Metrics</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTech(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Avg Job Duration</p>
                    <p className="text-xl font-bold text-slate-800">{tech.averageJobDuration} hrs</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">On-Time Arrival</p>
                    <p className="text-xl font-bold text-slate-800">{tech.onTimeArrivalRate}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Response Time</p>
                    <p className="text-xl font-bold text-slate-800">{tech.averageResponseTime} min</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Materials Utilization</p>
                    <p className="text-xl font-bold text-slate-800">{tech.materialsUtilization}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Avg Travel Time</p>
                    <p className="text-xl font-bold text-slate-800">{tech.averageTravelTime} min</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Avg Job Value</p>
                    <p className="text-xl font-bold text-slate-800">${tech.averageJobValue}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Cancelled Jobs</p>
                    <p className="text-xl font-bold text-slate-800">{tech.cancelledJobs}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Callbacks</p>
                    <p className="text-xl font-bold text-slate-800">{tech.callbackCount}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default TechnicianPerformanceView;
