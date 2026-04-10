import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  isSameDay,
} from 'date-fns';
import type { Job, Contact, JobStatus } from '../types';
import { canPerform } from '../lib/permissions';
import { DayView } from './calendar/DayView';
import { WeekView } from './calendar/WeekView';
import { StaffGridView } from './calendar/StaffGridView';
import { JobDetailSheet } from './calendar/JobDetailSheet';
import { useStore } from '../store/useStore';

type ViewMode = 'day' | 'week' | 'month' | 'staff';

interface CalendarViewProps {
  jobs: Job[];
  contacts: Contact[];
}

function getDateRangeLabel(mode: ViewMode, date: Date): string {
  switch (mode) {
    case 'day':   return format(date, 'EEEE, d MMMM yyyy');
    case 'week': {
      const ws = startOfWeek(date, { weekStartsOn: 1 });
      const we = endOfWeek(date, { weekStartsOn: 1 });
      return `${format(ws, 'd MMM')} – ${format(we, 'd MMM yyyy')}`;
    }
    case 'month': return format(date, 'MMMM yyyy');
    case 'staff': return format(date, 'EEEE, d MMMM yyyy');
  }
}

function navigate(mode: ViewMode, date: Date, dir: 1 | -1): Date {
  switch (mode) {
    case 'day':   return dir === 1 ? addDays(date, 1)   : subDays(date, 1);
    case 'week':  return dir === 1 ? addWeeks(date, 1)  : subWeeks(date, 1);
    case 'month': return dir === 1 ? addMonths(date, 1) : subMonths(date, 1);
    case 'staff': return dir === 1 ? addDays(date, 1)   : subDays(date, 1);
  }
}

// Month grid — preserved from existing implementation, enhanced to use scheduledStart
function MonthGrid({ date, jobs, onDayClick }: {
  date: Date; jobs: Job[]; onDayClick: (job: Job) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const calDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getJobsForDate = (day: number) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return jobs.filter(j => (j.scheduledStart ?? j.date)?.startsWith(dateStr));
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="aspect-square" />;
          const dayJobs = getJobsForDate(day);
          const isToday = isSameDay(new Date(date.getFullYear(), date.getMonth(), day), today);
          return (
            <div
              key={day}
              className={`aspect-square border-2 rounded-xl p-1 transition-all cursor-pointer ${
                isToday          ? 'border-blue-500 bg-blue-50' :
                dayJobs.length > 0 ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-100' :
                'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayJobs.slice(0, 2).map(job => (
                  <div
                    key={job.id}
                    onClick={() => onDayClick(job)}
                    className={`text-[9px] px-1 rounded truncate text-white ${
                      job.status === 'In Progress' ? 'bg-amber-500' :
                      job.status === 'Completed'   ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  >
                    {job.title}
                  </div>
                ))}
                {dayJobs.length > 2 && (
                  <div className="text-[8px] text-slate-500">+{dayJobs.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CalendarView: React.FC<CalendarViewProps> = ({ jobs, contacts }) => {
  const user                 = useStore(s => s.user);
  const calendarJobs         = useStore(s => s.calendarJobs);
  const calendarPollFailures = useStore(s => s.calendarPollFailures);
  const updateJobStatus      = useStore(s => s.updateJobStatus);
  const assignJob            = useStore(s => s.assignJob);

  const userRole = user?.role ?? 'technician';
  const userId   = user?.id ?? '';

  const [viewMode, setViewMode]       = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Compute date range for polling
  const rangeStart = format(
    viewMode === 'month' ? startOfMonth(currentDate) :
    viewMode === 'week'  ? startOfWeek(currentDate, { weekStartsOn: 1 }) :
    currentDate,
    'yyyy-MM-dd'
  );
  const rangeEnd = format(
    viewMode === 'month' ? endOfMonth(currentDate) :
    viewMode === 'week'  ? endOfWeek(currentDate, { weekStartsOn: 1 }) :
    currentDate,
    'yyyy-MM-dd'
  );

  useEffect(() => {
    const { fetchJobsForRange, startCalendarPolling, stopCalendarPolling } = useStore.getState();
    fetchJobsForRange(rangeStart, rangeEnd);
    startCalendarPolling(rangeStart, rangeEnd);
    return () => stopCalendarPolling();
  }, [rangeStart, rangeEnd]);

  // Use calendarJobs if populated; fall back to jobs prop for initial render
  const displayJobs = calendarJobs.length > 0 ? calendarJobs : jobs;

  const handleStatusChange = async (jobId: string, status: JobStatus) => {
    try {
      await updateJobStatus(jobId, status);
      if (selectedJob?.id === jobId) {
        setSelectedJob(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error('[CalendarView] Failed to update job status:', err);
    }
  };

  const handleReschedule = async (jobId: string, newDate: string) => {
    const existingWorkers = displayJobs.find(j => j.id === jobId)?.assignedWorkerIds ?? [];
    try {
      await assignJob(jobId, existingWorkers, `${newDate}T08:00:00`, `${newDate}T17:00:00`);
    } catch (err) {
      console.error('[CalendarView] Failed to reschedule job:', err);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div className="space-y-4">
      {/* Poll failure banner */}
      {calendarPollFailures >= 3 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-sm">
          Connection issue — calendar may not be up to date. Retrying…
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Top bar */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setCurrentDate(d => navigate(viewMode, d, -1))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="font-semibold text-slate-800 min-w-0">
            {getDateRangeLabel(viewMode, currentDate)}
          </span>

          <button
            onClick={() => setCurrentDate(d => navigate(viewMode, d, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>

          {/* View switcher */}
          <div className="ml-auto flex gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Calendar view">
            {(['day', 'week', 'month', 'staff'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {canPerform(userRole, 'createJob', false) && (
            <button className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" aria-hidden="true" /> New Job
            </button>
          )}
        </div>

        {/* View content */}
        <div className="p-4">
          {viewMode === 'day' && (
            <DayView
              date={currentDate}
              jobs={displayJobs}
              contacts={contacts}
              onJobClick={setSelectedJob}
              canDrag={canPerform(userRole, 'reschedule', false)}
            />
          )}
          {viewMode === 'week' && (
            <WeekView
              weekStart={weekStart}
              jobs={displayJobs}
              contacts={contacts}
              onJobClick={setSelectedJob}
              canDrag={canPerform(userRole, 'reschedule', false)}
              onReschedule={handleReschedule}
            />
          )}
          {viewMode === 'month' && (
            <MonthGrid
              date={currentDate}
              jobs={displayJobs}
              onDayClick={setSelectedJob}
            />
          )}
          {viewMode === 'staff' && (
            <StaffGridView
              date={currentDate}
              jobs={displayJobs}
              contacts={contacts}
              onJobClick={setSelectedJob}
              canDrag={canPerform(userRole, 'reschedule', false)}
            />
          )}
        </div>
      </div>

      {/* Job detail sheet */}
      <JobDetailSheet
        job={selectedJob}
        contacts={contacts}
        userRole={userRole}
        userId={userId}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
        onReschedule={(job) => {
          // Stub: open reschedule modal — wired in Phase 2
          console.log('Reschedule', job.id);
        }}
        onReassign={(job) => {
          // Stub: open reassign modal — wired in Phase 2
          console.log('Reassign', job.id);
        }}
      />
    </div>
  );
};
