import React, { useState, useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import type { Job, Contact } from '../../types';
import { JobCard } from './JobCard';

interface WeekViewProps {
  weekStart: Date;
  jobs: Job[];
  contacts: Contact[];
  onJobClick: (job: Job) => void;
  canDrag: boolean;
  onReschedule?: (jobId: string, newDate: string) => Promise<void>;
}

function jobsForDay(jobs: Job[], day: Date): Job[] {
  return jobs.filter(j => {
    const src = j.scheduledStart ?? j.date;
    if (!src) return false;
    try { return isSameDay(new Date(src), day); } catch { return false; }
  });
}

export const WeekView: React.FC<WeekViewProps> = ({
  weekStart, jobs, contacts, onJobClick, canDrag, onReschedule
}) => {
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggingJobId || !onReschedule) return;
    try {
      await onReschedule(draggingJobId, format(day, 'yyyy-MM-dd'));
    } catch (err) {
      console.error('[WeekView] Failed to reschedule job:', err);
    } finally {
      setDraggingJobId(null);
    }
  };

  return (
    <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[400px] border border-slate-200 rounded-xl overflow-hidden">
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayJobs = jobsForDay(jobs, day);
        const isToday = isSameDay(day, today);
        const isTarget = dropTarget === dateStr;

        return (
          <div
            key={dateStr}
            onDragOver={canDrag ? (e) => { e.preventDefault(); setDropTarget(dateStr); } : undefined}
            onDragLeave={canDrag ? () => setDropTarget(null) : undefined}
            onDrop={canDrag ? (e) => handleDrop(e, day) : undefined}
            className={`flex flex-col min-h-[400px] transition-colors ${isTarget ? 'bg-blue-50' : ''}`}
          >
            {/* Day header */}
            <div className={`px-2 py-2 text-center border-b border-slate-100 ${isToday ? 'bg-blue-600' : 'bg-slate-50'}`}>
              <div className={`text-xs font-medium ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                {format(day, 'EEE')}
              </div>
              <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-800'}`}>
                {format(day, 'd')}
              </div>
            </div>

            {/* Job cards */}
            <div className="flex-1 p-1.5 space-y-1.5">
              {dayJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  contacts={contacts}
                  onClick={onJobClick}
                  draggable={canDrag}
                  isDragging={draggingJobId === job.id}
                  onDragStart={(e, id) => { e.dataTransfer.effectAllowed = 'move'; setDraggingJobId(id); }}
                  onDragEnd={() => { setDraggingJobId(null); setDropTarget(null); }}
                />
              ))}
              {isTarget && draggingJobId && (
                <div className="border-2 border-dashed border-blue-400 rounded-lg p-2 text-xs text-blue-600 text-center">
                  Move here
                </div>
              )}
            </div>

            {dayJobs.length === 0 && !isTarget && (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-slate-300">No jobs</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
