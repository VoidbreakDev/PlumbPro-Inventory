import React, { useEffect, useState } from 'react';
import { CalendarPlus, Search } from 'lucide-react';
import { addHours, format, parseISO } from 'date-fns';
import type { Job } from '../types';
import { useStore } from '../store/useStore';

export default function UnscheduledJobsView() {
  const fetchUnscheduled = useStore(s => s.fetchUnscheduled);
  const unscheduledJobs  = useStore(s => s.unscheduledJobs);
  const contacts         = useStore(s => s.contacts);
  const assignJob        = useStore(s => s.assignJob);

  const [search, setSearch]       = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [scheduling, setScheduling] = useState<{
    job: Job;
    date: string;
    startTime: string;
  } | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnscheduled().finally(() => setIsLoading(false));
  }, [fetchUnscheduled]);

  const filtered = unscheduledJobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.jobAddress?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSchedule = async () => {
    if (!scheduling) return;
    const { job, date, startTime } = scheduling;
    const start = parseISO(`${date}T${startTime}:00`);
    const end   = addHours(start, 2);
    const scheduledStart = start.toISOString();
    const scheduledEnd   = end.toISOString();
    try {
      await assignJob(job.id, job.assignedWorkerIds, scheduledStart, scheduledEnd);
      await fetchUnscheduled();
      setScheduling(null);
    } catch {
      setScheduleError('Failed to schedule job. Please try again.');
    }
  };

  const getContactName = (id: string) =>
    contacts.find(c => c.id === id)?.name ?? 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Unscheduled Jobs</h1>
          <p className="text-slate-500 text-sm">Jobs awaiting a time slot</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            aria-label="Search unscheduled jobs"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarPlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No unscheduled jobs</p>
            <p className="text-sm">All jobs have been given a time slot.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(job => (
              <div key={job.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{job.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5 flex-wrap">
                    <span>{job.jobType}</span>
                    {job.jobAddress && <span>· {job.jobAddress}</span>}
                    {job.assignedWorkerIds.length > 0 && (
                      <span>· {job.assignedWorkerIds.map(getContactName).join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setScheduleError(null);
                    setScheduling({
                      job,
                      date: format(new Date(), 'yyyy-MM-dd'),
                      startTime: '08:00',
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex-shrink-0"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule modal */}
      {scheduling && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          onKeyDown={e => { if (e.key === 'Escape') setScheduling(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 id="schedule-modal-title" className="text-lg font-bold text-slate-800">Schedule Job</h2>
            <p className="text-sm text-slate-500 truncate">{scheduling.job.title}</p>

            <div>
              <label htmlFor="schedule-date" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Date
              </label>
              <input
                id="schedule-date"
                type="date"
                value={scheduling.date}
                onChange={e => setScheduling(s => s ? { ...s, date: e.target.value } : null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="schedule-start-time" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Start Time
              </label>
              <input
                id="schedule-start-time"
                type="time"
                value={scheduling.startTime}
                onChange={e => setScheduling(s => s ? { ...s, startTime: e.target.value } : null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {scheduleError && (
              <p className="text-red-600 text-sm">{scheduleError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setScheduling(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
