import React from 'react';
import { format } from 'date-fns';
import type { Job, Contact } from '../../types';
import { JobCard } from './JobCard';

// Grid from 6am to 7pm = 13 hours = 780 minutes
const START_HOUR = 6;
const END_HOUR = 19;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT_PX = 60; // 60px per hour

interface DayViewProps {
  date: Date;
  jobs: Job[];
  contacts: Contact[];
  onJobClick: (job: Job) => void;
  canDrag: boolean;
}

function minutesFromStart(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
}


function jobsForDay(jobs: Job[], date: Date): Job[] {
  const dateStr = format(date, 'yyyy-MM-dd');
  return jobs.filter(j => {
    const src = j.scheduledStart ?? j.date;
    return src?.startsWith(dateStr);
  });
}

export const DayView: React.FC<DayViewProps> = ({ date, jobs, contacts, onJobClick, canDrag }) => {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const dayJobs = jobsForDay(jobs, date);

  return (
    <div className="flex overflow-y-auto" style={{ maxHeight: '70vh' }}>
      {/* Time gutter */}
      <div className="flex-shrink-0 w-12 relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT_PX}px` }}>
        {hours.map(h => (
          <div
            key={h}
            className="absolute right-2 text-xs text-slate-400 font-medium"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX - 8}px` }}
          >
            {h < 10 ? `0${h}` : h}:00
          </div>
        ))}
      </div>

      {/* Grid + events */}
      <div
        className="flex-1 relative border-l border-slate-200"
        style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT_PX}px` }}
      >
        {/* Hour lines */}
        {hours.map(h => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX}px` }}
          />
        ))}

        {/* Job blocks */}
        {dayJobs.map(job => {
          const start = job.scheduledStart ?? `${job.date}T${String(START_HOUR).padStart(2, '0')}:00:00`;
          const end   = job.scheduledEnd   ?? `${job.date}T${String(START_HOUR + 1).padStart(2, '0')}:00:00`;
          const startMins = Math.max(0, minutesFromStart(start));
          const endMins   = Math.min(TOTAL_MINUTES, (new Date(end).getHours() - START_HOUR) * 60 + new Date(end).getMinutes());
          const topPct    = (startMins / TOTAL_MINUTES) * 100;
          const heightPct = Math.max(0, ((endMins - startMins) / TOTAL_MINUTES) * 100);

          return (
            <div
              key={job.id}
              className="absolute left-1 right-1"
              style={{
                top: `${topPct}%`,
                height: `${Math.max(heightPct, 3)}%`
              }}
            >
              <JobCard job={job} contacts={contacts} onClick={onJobClick} draggable={canDrag} />
            </div>
          );
        })}

        {dayJobs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-slate-300">No jobs scheduled</span>
          </div>
        )}
      </div>
    </div>
  );
};
