
import React, { useMemo, useState } from 'react';
import { Plus, Search, Calendar, MapPin, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Job, JobStatus, Contact } from '../types';
import type { NavTab } from '../components/Navigation';

const STATUS_FILTERS = ['All', 'Unscheduled', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Invoiced', 'Cancelled'] as const;

const STATUS_COLORS: Record<JobStatus, string> = {
  Unscheduled:   'bg-slate-100 text-slate-600',
  Scheduled:     'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'On Hold':     'bg-orange-100 text-orange-700',
  Completed:     'bg-green-100 text-green-700',
  Invoiced:      'bg-purple-100 text-purple-700',
  Cancelled:     'bg-red-100 text-red-600',
};

interface JobsViewProps {
  jobs: Job[];
  contacts: Contact[];
  onNavigate?: (tab: NavTab) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ jobs, contacts, onNavigate }) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs
      .filter(j => statusFilter === 'All' || j.status === statusFilter)
      .filter(j =>
        !q ||
        j.title.toLowerCase().includes(q) ||
        (j.jobAddress ?? '').toLowerCase().includes(q) ||
        (j.builder ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const dateA = a.scheduledStart ?? a.date ?? '';
        const dateB = b.scheduledStart ?? b.date ?? '';
        return dateB.localeCompare(dateA);
      });
  }, [jobs, statusFilter, search]);

  const getWorkerNames = (job: Job) =>
    job.assignedWorkerIds
      .map(id => contacts.find(c => c.id === id)?.name ?? id)
      .join(', ');

  const formatScheduled = (job: Job) => {
    if (job.scheduledStart) {
      try { return format(new Date(job.scheduledStart), 'd MMM yyyy'); } catch { /* ignore */ }
    }
    return job.date ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">All Jobs</h2>
            <p className="text-xs text-slate-400 mt-0.5">{jobs.length} total jobs in the system</p>
          </div>
          <button
            onClick={() => onNavigate?.('calendar')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>

        {/* Filters + Search */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs…"
              className="pl-8 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-6 py-3 font-semibold">Job</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Scheduled</th>
                <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Address</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(job => {
                const workers = getWorkerNames(job);
                const scheduledDate = formatScheduled(job);

                return (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => onNavigate?.('calendar')}
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800 leading-tight">{job.title}</div>
                      {job.jobAddress && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 xl:hidden">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{job.jobAddress}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {workers ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{workers}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                      {scheduledDate ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {scheduledDate}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {job.jobAddress ? (
                        <span className="text-slate-500 truncate max-w-[200px] block">{job.jobAddress}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No jobs found</p>
              {search && <p className="text-xs mt-1">Try clearing your search filter</p>}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};
