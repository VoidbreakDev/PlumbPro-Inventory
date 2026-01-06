import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, MapPin } from 'lucide-react';
import { Job, Contact } from '../types';
import { Badge } from '../components/Shared';

interface CalendarViewProps {
  jobs: Job[];
  contacts: Contact[];
  onJobClick?: (job: Job) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ jobs, contacts, onJobClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  // Helper functions for calendar
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();
  };

  // Get jobs for a specific date
  const getJobsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return jobs.filter(job => job.date === dateStr);
  };

  // Generate calendar days
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get upcoming jobs (next 7 days)
  const upcomingJobs = jobs
    .filter(job => {
      const jobDate = new Date(job.date);
      const diffTime = jobDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7 && job.status !== 'Completed';
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Calendar Header */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={previousMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-semibold"
                >
                  Today
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex space-x-2">
              {['month', 'week', 'day'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                    view === v
                      ? 'bg-white text-blue-600'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dayJobs = getJobsForDate(day);
                const hasJobs = dayJobs.length > 0;

                return (
                  <div
                    key={day}
                    className={`aspect-square border-2 rounded-xl p-2 transition-all cursor-pointer ${
                      isToday(day)
                        ? 'border-blue-500 bg-blue-50'
                        : hasJobs
                        ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-100'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col h-full">
                      <span className={`text-sm font-bold ${isToday(day) ? 'text-blue-600' : 'text-slate-700'}`}>
                        {day}
                      </span>
                      {hasJobs && (
                        <div className="mt-1 flex-1 overflow-hidden">
                          {dayJobs.slice(0, 2).map((job, idx) => (
                            <div
                              key={job.id}
                              onClick={() => onJobClick?.(job)}
                              className="mb-1 truncate"
                            >
                              <div className={`text-[10px] px-1 py-0.5 rounded ${
                                job.status === 'Scheduled' ? 'bg-blue-500 text-white' :
                                job.status === 'In Progress' ? 'bg-amber-500 text-white' :
                                'bg-green-500 text-white'
                              }`}>
                                {job.title}
                              </div>
                            </div>
                          ))}
                          {dayJobs.length > 2 && (
                            <div className="text-[9px] text-slate-500 font-semibold">
                              +{dayJobs.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Jobs Sidebar */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            Upcoming Jobs
          </h3>

          {upcomingJobs.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No upcoming jobs in the next 7 days</p>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => onJobClick?.(job)}
                  className="p-4 border-2 border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 text-sm">{job.title}</h4>
                    <Badge variant={
                      job.status === 'Scheduled' ? 'blue' :
                      job.status === 'In Progress' ? 'yellow' :
                      'green'
                    }>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {new Date(job.date).toLocaleDateString('en-AU', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    {job.builder && (
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {job.builder}
                      </div>
                    )}
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {job.assignedWorkerIds.length} worker{job.assignedWorkerIds.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4 opacity-90">This Month</h3>
          <div className="space-y-3">
            <div>
              <div className="text-3xl font-black">{jobs.filter(j => j.status === 'Scheduled').length}</div>
              <div className="text-sm opacity-90">Scheduled Jobs</div>
            </div>
            <div>
              <div className="text-3xl font-black">{jobs.filter(j => j.status === 'In Progress').length}</div>
              <div className="text-sm opacity-90">In Progress</div>
            </div>
            <div>
              <div className="text-3xl font-black">{jobs.filter(j => j.status === 'Completed').length}</div>
              <div className="text-sm opacity-90">Completed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
