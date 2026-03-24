import React from 'react';
import { format, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { Users, CheckCircle, Clock } from 'lucide-react';
import { Job, Contact } from '../../types';

interface TechnicianCapacityProps {
  jobs: Job[];
  contacts: Contact[];
}

const WEEKLY_CAPACITY = 5; // default jobs per technician per week

export const TechnicianCapacity: React.FC<TechnicianCapacityProps> = ({ jobs, contacts }) => {
  const plumbers = contacts.filter(c => c.type === 'Plumber');

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const getWeeklyJobCount = (plumberId: string) =>
    jobs.filter(j => {
      if (!j.date || !j.assignedWorkerIds.includes(plumberId)) return false;
      if (j.status === 'Cancelled') return false;
      try {
        return isWithinInterval(parseISO(j.date), { start: weekStart, end: weekEnd });
      } catch {
        return false;
      }
    }).length;

  const getTotalJobCount = (plumberId: string) =>
    jobs.filter(j => j.assignedWorkerIds.includes(plumberId) && j.status !== 'Cancelled').length;

  if (plumbers.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center text-slate-500 text-sm">
        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No plumber contacts found. Add contacts with type "Plumber" to see capacity.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Users className="w-5 h-5 text-slate-400" />
        <h3 className="font-semibold text-slate-800">Technician Capacity</h3>
        <span className="text-xs text-slate-400 ml-auto">
          Week of {format(weekStart, 'd MMM')}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {plumbers.map(plumber => {
          const weekCount = getWeeklyJobCount(plumber.id);
          const totalCount = getTotalJobCount(plumber.id);
          const pct = Math.min(100, Math.round((weekCount / WEEKLY_CAPACITY) * 100));
          const isOverloaded = weekCount > WEEKLY_CAPACITY;

          return (
            <div key={plumber.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                    {plumber.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-800">{plumber.name}</span>
                    {plumber.phone && (
                      <span className="text-xs text-slate-400 ml-2">{plumber.phone}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {isOverloaded ? (
                    <span className="text-red-600 font-medium">{weekCount} jobs this week</span>
                  ) : weekCount === 0 ? (
                    <span className="text-slate-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" /> Available
                    </span>
                  ) : (
                    <span className="text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {weekCount}/{WEEKLY_CAPACITY} this week
                    </span>
                  )}
                  <span className="text-slate-400">({totalCount} total)</span>
                </div>
              </div>

              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverloaded ? 'bg-red-500' : weekCount >= WEEKLY_CAPACITY * 0.8 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
