import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Users,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock3,
  Package,
  BarChart3,
  Filter,
} from 'lucide-react';
import { analyticsAPI } from '../lib/analyticsAPI';
import { useStore } from '../store/useStore';

type SortBy = 'jobs' | 'completion' | 'materials';
type Period = 'week' | 'month' | 'quarter' | 'year';

interface WorkerRow {
  id: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  totalMaterialsHandled: number;
  completionRate: number;
}

const periodConfig: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365
};

const getDateRange = (period: Period) => {
  const end = new Date();
  const start = new Date(Date.now() - periodConfig[period] * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
};

export function TechnicianPerformanceView() {
  const setError = useStore((state) => state.setError);
  const [period, setPeriod] = useState<Period>('month');
  const [sortBy, setSortBy] = useState<SortBy>('completion');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(period);
        const response = await analyticsAPI.getWorkerPerformance(startDate, endDate);
        if (!cancelled) {
          setWorkers(response.workers.map((worker) => ({
            ...worker,
            completionRate: Number(worker.completionRate)
          })));
        }
      } catch (error) {
        if (!cancelled) {
          setWorkers([]);
          setError('Failed to load technician performance');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [period, setError]);

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((left, right) => {
      switch (sortBy) {
        case 'jobs':
          return right.totalJobs - left.totalJobs;
        case 'materials':
          return right.totalMaterialsHandled - left.totalMaterialsHandled;
        case 'completion':
        default:
          return right.completionRate - left.completionRate;
      }
    });
  }, [sortBy, workers]);

  const teamStats = useMemo(() => {
    const totalWorkers = workers.length;
    const totalJobs = workers.reduce((sum, worker) => sum + worker.totalJobs, 0);
    const completedJobs = workers.reduce((sum, worker) => sum + worker.completedJobs, 0);
    const inProgressJobs = workers.reduce((sum, worker) => sum + worker.inProgressJobs, 0);
    const totalMaterialsHandled = workers.reduce((sum, worker) => sum + worker.totalMaterialsHandled, 0);

    return {
      totalWorkers,
      totalJobs,
      completedJobs,
      inProgressJobs,
      totalMaterialsHandled,
      averageCompletionRate: totalWorkers > 0
        ? workers.reduce((sum, worker) => sum + worker.completionRate, 0) / totalWorkers
        : 0
    };
  }, [workers]);

  const topPerformer = sortedWorkers[0] || null;
  const selectedWorker = sortedWorkers.find((worker) => worker.id === selectedWorkerId) || topPerformer;

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Technician Performance</h1>
            <p className="text-slate-500 mt-1">Track the team using live worker-performance analytics.</p>
          </div>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">No technician activity in this period</h2>
          <p className="text-slate-500 mt-2">
            Completed jobs and material handling activity will appear here once team members are attached to jobs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Technician Performance</h1>
          <p className="text-slate-500 mt-1">Live worker-performance analytics for the selected reporting window.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="completion">Sort by Completion Rate</option>
            <option value="jobs">Sort by Total Jobs</option>
            <option value="materials">Sort by Materials Handled</option>
          </select>
        </div>
      </div>

      {topPerformer && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-center gap-2 text-amber-700 font-semibold mb-4">
            <Trophy className="w-5 h-5" />
            Top Performer
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{topPerformer.name}</h2>
              <p className="text-slate-600 mt-1">
                {topPerformer.completedJobs} completed jobs from {topPerformer.totalJobs} assigned
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{topPerformer.completionRate.toFixed(1)}%</p>
                <p className="text-sm text-slate-500">Completion Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{topPerformer.inProgressJobs}</p>
                <p className="text-sm text-slate-500">In Progress</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{topPerformer.totalMaterialsHandled.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Materials</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Team Members</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.totalWorkers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm text-slate-500">Total Jobs</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.totalJobs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.completedJobs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <Clock3 className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">In Progress</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.inProgressJobs}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm text-slate-500">Avg Completion</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.averageCompletionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">Performance Rankings</h2>
            <p className="text-sm text-slate-500">Sorted by live team activity for the selected period.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter className="w-4 h-4" />
            {sortBy === 'completion' ? 'Completion Rate' : sortBy === 'jobs' ? 'Total Jobs' : 'Materials Handled'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Technician</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Total Jobs</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Completed</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">In Progress</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Completion Rate</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Materials Handled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedWorkers.map((worker) => (
                <tr
                  key={worker.id}
                  onClick={() => setSelectedWorkerId(worker.id)}
                  className={`cursor-pointer hover:bg-slate-50 ${selectedWorkerId === worker.id ? 'bg-blue-50/70' : ''}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                        {worker.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{worker.name}</p>
                        <p className="text-sm text-slate-500">Worker ID: {worker.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center font-medium text-slate-800">{worker.totalJobs}</td>
                  <td className="px-4 py-4 text-center font-medium text-green-700">{worker.completedJobs}</td>
                  <td className="px-4 py-4 text-center font-medium text-amber-700">{worker.inProgressJobs}</td>
                  <td className="px-4 py-4 text-center font-semibold text-slate-800">{worker.completionRate.toFixed(1)}%</td>
                  <td className="px-4 py-4 text-center font-medium text-slate-700">{worker.totalMaterialsHandled.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorker && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{selectedWorker.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Completed Jobs</p>
              <p className="text-2xl font-bold text-slate-800">{selectedWorker.completedJobs}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Open Jobs</p>
              <p className="text-2xl font-bold text-slate-800">{selectedWorker.inProgressJobs}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Materials Handled</p>
              <p className="text-2xl font-bold text-slate-800">{selectedWorker.totalMaterialsHandled.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Completion Rate</p>
              <p className="text-2xl font-bold text-slate-800">{selectedWorker.completionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianPerformanceView;
