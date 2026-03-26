import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { Job, Contact, JobStatus } from '../../types';

interface JobPlanningBoardProps {
  jobs: Job[];
  contacts: Contact[];
  onReschedule: (jobId: string, newDate: string, newWorkerIds?: string[]) => Promise<void>;
  onJobClick: (job: Job) => void;
}

const STATUS_STYLES: Record<JobStatus, string> = {
  'Scheduled': 'bg-blue-100 border-blue-300 text-blue-800',
  'In Progress': 'bg-yellow-100 border-yellow-300 text-yellow-800',
  'Completed': 'bg-green-100 border-green-300 text-green-800',
  'Cancelled': 'bg-gray-100 border-gray-300 text-gray-500 line-through',
};

export const JobPlanningBoard: React.FC<JobPlanningBoardProps> = ({
  jobs,
  contacts,
  onReschedule,
  onJobClick
}) => {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getWorkerName = (workerId: string) => {
    const c = contacts.find(c => c.id === workerId);
    return c ? c.name.split(' ')[0] : '?';
  };

  const getJobsForDay = (day: Date) =>
    jobs.filter(j => {
      if (!j.date) return false;
      try {
        return isSameDay(parseISO(j.date), day);
      } catch {
        return false;
      }
    });

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingJobId(jobId);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDate(dateStr);
  };

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDropTargetDate(null);
    if (!draggingJobId) return;
    const newDate = format(day, 'yyyy-MM-dd');
    setDraggingJobId(null);
    await onReschedule(draggingJobId, newDate);
  };

  const handleDragLeave = () => setDropTargetDate(null);
  const handleDragEnd = () => { setDraggingJobId(null); setDropTargetDate(null); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Week Navigator */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button
          onClick={() => setWeekStart(prev => subWeeks(prev, 1))}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-slate-800">
          {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart(prev => addWeeks(prev, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Day Columns */}
      <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[320px]">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, today);
          const isDropTarget = dropTargetDate === dateStr;

          return (
            <div
              key={dateStr}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
              className={`flex flex-col min-h-[320px] transition-colors ${isDropTarget ? 'bg-blue-50' : ''}`}
            >
              {/* Day Header */}
              <div className={`px-2 py-2 text-center border-b border-slate-100 ${isToday ? 'bg-blue-600' : 'bg-slate-50'}`}>
                <div className={`text-xs font-medium ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                  {format(day, 'EEE')}
                </div>
                <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-800'}`}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Job Cards */}
              <div className="flex-1 p-1.5 space-y-1.5">
                {dayJobs.map(job => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onJobClick(job)}
                    className={`
                      border rounded-lg p-1.5 text-xs cursor-grab active:cursor-grabbing
                      select-none transition-opacity
                      ${STATUS_STYLES[job.status] ?? 'bg-slate-100 border-slate-200'}
                      ${draggingJobId === job.id ? 'opacity-40' : 'hover:shadow-sm'}
                    `}
                  >
                    <div className="font-semibold truncate leading-tight">{job.title}</div>
                    {job.assignedWorkerIds.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5 text-current opacity-70">
                        <User className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">
                          {job.assignedWorkerIds.slice(0, 2).map(getWorkerName).join(', ')}
                          {job.assignedWorkerIds.length > 2 && ` +${job.assignedWorkerIds.length - 2}`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {isDropTarget && draggingJobId && (
                  <div className="border-2 border-dashed border-blue-400 rounded-lg p-2 text-xs text-blue-600 text-center">
                    Move here
                  </div>
                )}
              </div>

              {dayJobs.length === 0 && !isDropTarget && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xs text-slate-300">No jobs</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        <span>Drag jobs to reschedule</span>
        {Object.entries(STATUS_STYLES).map(([status, cls]) => (
          <span key={status} className={`px-2 py-0.5 rounded border ${cls}`}>{status}</span>
        ))}
      </div>
    </div>
  );
};
