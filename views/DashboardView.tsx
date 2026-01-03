import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Calendar, Users, ClipboardList } from 'lucide-react';
import { InventoryItem, Job, Contact } from '../types';
import { StatCard, Badge, getStockStatus } from '../components/Shared';

interface DashboardViewProps {
  inventory: InventoryItem[];
  jobs: Job[];
  contacts: Contact[];
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ inventory, jobs, contacts, onNavigate }) => {
  const lowStockCount = inventory.filter(i => i.quantity <= i.reorderLevel).length;
  const upcomingJobsCount = jobs.filter(j => j.status === 'Scheduled').length;
  const inventoryValue = inventory.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Inventory Value" value={`$${inventoryValue.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title="Low Stock Items" value={lowStockCount} icon={AlertTriangle} color="bg-amber-500" />
        <StatCard title="Upcoming Jobs" value={upcomingJobsCount} icon={Calendar} color="bg-blue-500" />
        <StatCard title="Active Plumbers" value={contacts.filter(c => c.type === 'Plumber').length} icon={Users} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Critical Stock Alerts</h3>
            <button onClick={() => onNavigate('inventory')} className="text-sm text-blue-600 font-semibold hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {inventory.filter(i => i.quantity <= i.reorderLevel).map(item => {
              const status = getStockStatus(item.quantity, item.reorderLevel);
              return (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${status.variant === 'red' ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <AlertTriangle className={`w-4 h-4 ${status.variant === 'red' ? 'text-red-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-slate-500">{item.category} • {item.supplierCode}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${status.variant === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{item.quantity}</p>
                    <p className="text-xs text-slate-400">Min: {item.reorderLevel}</p>
                  </div>
                </div>
              );
            })}
            {lowStockCount === 0 && <p className="text-slate-400 text-center py-4">No critical stock levels detected.</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Upcoming Jobs</h3>
            <button onClick={() => onNavigate('jobs')} className="text-sm text-blue-600 font-semibold hover:underline">Full Schedule</button>
          </div>
          <div className="space-y-4">
            {jobs.slice(0, 3).map(job => (
              <div key={job.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{job.title}</p>
                    {/* // Fix: Use assignedWorkerIds[0] since assignedWorkerId does not exist on type Job */}
                    <p className="text-xs text-slate-500">{job.date} • {contacts.find(c => c.id === job.assignedWorkerIds[0])?.name}</p>
                  </div>
                </div>
                <Badge variant={job.status === 'Scheduled' ? 'blue' : 'yellow'}>{job.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};