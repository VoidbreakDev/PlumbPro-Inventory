import React from 'react';
import { User } from 'lucide-react';
import type { Job, Contact } from '../../types';

const STATUS_COLOURS: Record<string, string> = {
  'Unscheduled': 'bg-slate-100 border-slate-300 text-slate-700',
  'Scheduled':   'bg-blue-100  border-blue-300  text-blue-800',
  'In Progress': 'bg-amber-100 border-amber-300 text-amber-800',
  'On Hold':     'bg-orange-100 border-orange-300 text-orange-800',
  'Completed':   'bg-green-100 border-green-300 text-green-800',
  'Cancelled':   'bg-gray-100  border-gray-300  text-gray-500',
  'Invoiced':    'bg-purple-100 border-purple-300 text-purple-800',
};

interface JobCardProps {
  job: Job;
  contacts: Contact[];
  onClick: (job: Job) => void;
  isDragging?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
  onDragEnd?: () => void;
  compact?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job, contacts, onClick, isDragging = false,
  draggable = false, onDragStart, onDragEnd, compact = false
}) => {
  const colourClass = STATUS_COLOURS[job.status] ?? STATUS_COLOURS['Scheduled'];
  const workerNames = job.assignedWorkerIds
    .slice(0, 2)
    .map(id => contacts.find(c => c.id === id)?.name.split(' ')[0] ?? '?')
    .join(', ');
  const extraWorkers = job.assignedWorkerIds.length > 2
    ? ` +${job.assignedWorkerIds.length - 2}` : '';

  const timeLabel = job.scheduledStart
    ? new Date(job.scheduledStart).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, job.id) : undefined}
      onDragEnd={onDragEnd}
      onClick={() => onClick(job)}
      className={`
        border rounded-lg text-xs cursor-pointer select-none transition-all
        ${colourClass}
        ${compact ? 'px-1 py-0.5' : 'p-1.5'}
        ${isDragging ? 'opacity-40' : 'hover:shadow-sm'}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      <div className="font-semibold truncate leading-tight">{job.title}</div>
      {!compact && (
        <>
          {timeLabel && (
            <div className="opacity-75 text-[10px]">{timeLabel}</div>
          )}
          {job.assignedWorkerIds.length > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5 opacity-70">
              <User className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{workerNames}{extraWorkers}</span>
            </div>
          )}
          {job.jobAddress && (
            <div className="truncate opacity-60 text-[10px]">{job.jobAddress}</div>
          )}
        </>
      )}
    </div>
  );
};
