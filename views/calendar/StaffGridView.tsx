import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Job, Contact } from '../../types';
import { JobCard } from './JobCard';

const HOUR_COLOURS = [
  'bg-blue-400', 'bg-purple-400', 'bg-green-400', 'bg-amber-400',
  'bg-pink-400', 'bg-teal-400', 'bg-orange-400', 'bg-indigo-400',
];

interface StaffGridViewProps {
  date: Date;
  jobs: Job[];
  contacts: Contact[];
  onJobClick: (job: Job) => void;
  canDrag: boolean;
  onAssign?: (jobId: string, workerId: string, scheduledStart: string) => Promise<void>;
}

const START_HOUR = 6;
const END_HOUR = 19;
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function workerColour(index: number): string {
  return HOUR_COLOURS[index % HOUR_COLOURS.length];
}


export const StaffGridView: React.FC<StaffGridViewProps> = ({
  date, jobs, contacts, onJobClick, canDrag, onAssign
}) => {
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

  const activeWorkers = useMemo(() =>
    contacts.filter(c =>
      jobs.some(j => j.assignedWorkerIds.includes(c.id))
    ),
    [contacts, jobs]
  );

  const jobsByWorkerHour = useMemo(() => {
    const map = new Map<string, Job[]>();
    const dateStr = format(date, 'yyyy-MM-dd');
    for (const job of jobs) {
      if (!job.scheduledStart) continue;
      const src = job.scheduledStart;
      if (!src.startsWith(dateStr)) continue;
      const h = new Date(job.scheduledStart).getHours();
      for (const wid of job.assignedWorkerIds) {
        const key = `${wid}-${h}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(job);
      }
    }
    return map;
  }, [jobs, date]);

  if (activeWorkers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No staff assigned to jobs this day
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border border-slate-200 rounded-xl overflow-hidden"
        style={{ gridTemplateColumns: `52px repeat(${activeWorkers.length}, minmax(120px, 1fr))` }}
      >
        {/* Header row */}
        <div className="bg-slate-50 border-b border-slate-200" />
        {activeWorkers.map((worker, idx) => (
          <div
            key={worker.id}
            className="bg-slate-50 border-b border-slate-200 border-l px-2 py-2 text-center"
          >
            <div className={`w-7 h-7 ${workerColour(idx)} rounded-full flex items-center justify-center text-white text-xs font-bold mx-auto mb-1`}>
              {worker.name.charAt(0)}
            </div>
            <div className="text-xs font-semibold text-slate-700 truncate">{worker.name.split(' ')[0]}</div>
          </div>
        ))}

        {/* Hour rows */}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            {/* Time label */}
            <div className="border-b border-slate-100 border-r bg-slate-50 px-1 py-2 text-right">
              <span className="text-[10px] text-slate-400">{hour < 10 ? `0${hour}` : hour}:00</span>
            </div>

            {/* Worker cells */}
            {activeWorkers.map((worker) => {
              const cellJobs = jobsByWorkerHour.get(`${worker.id}-${hour}`) ?? [];

              return (
                <div
                  key={worker.id}
                  className="border-b border-l border-slate-100 p-1 min-h-[48px]"
                  onDragOver={canDrag ? (e) => e.preventDefault() : undefined}
                  onDrop={canDrag && onAssign ? async (e) => {
                    e.preventDefault();
                    if (!draggingJobId) return;
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const scheduledStart = `${dateStr}T${String(hour).padStart(2, '0')}:00:00`;
                    try {
                      await onAssign(draggingJobId, worker.id, scheduledStart);
                    } catch (err) {
                      console.error('[StaffGridView] Failed to assign job:', err);
                    } finally {
                      setDraggingJobId(null);
                    }
                  } : undefined}
                >
                  {cellJobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      contacts={contacts}
                      onClick={onJobClick}
                      compact
                      draggable={canDrag}
                      isDragging={draggingJobId === job.id}
                      onDragStart={(e, id) => { e.dataTransfer.effectAllowed = 'move'; setDraggingJobId(id); }}
                      onDragEnd={() => setDraggingJobId(null)}
                    />
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
