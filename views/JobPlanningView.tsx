import React, { useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Job, Contact, InventoryItem, JobTemplate, AllocatedItem, Kit } from '../types';
import { jobsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import { JobPlanningBoard } from './job-planning/JobPlanningBoard';
import { TechnicianCapacity } from './job-planning/TechnicianCapacity';
import { QuickJobCreator } from './job-planning/QuickJobCreator';

interface JobPlanningViewProps {
  jobs: Job[];
  contacts: Contact[];
  inventory: InventoryItem[];
  templates: JobTemplate[];
  kits: Kit[];
  onOpenNewJobModal: () => void;
  onConfirmPick: (jobId: string) => void;
  onOpenAllocateModal: (job: Job) => void;
  onOpenTemplateModal: (jobId: string, templateId: string) => void;
  onNavigate: (tab: any) => void;
  onAddTemplate: (name: string, items: AllocatedItem[]) => void;
  onUpdateTemplate: (id: string, name: string, items: AllocatedItem[]) => void;
  onDeleteTemplate: (id: string) => void;
}

export const JobPlanningView: React.FC<JobPlanningViewProps> = ({
  jobs: initialJobs,
  contacts,
  templates,
  onOpenNewJobModal,
  onNavigate
}) => {
  const setError = useStore(state => state.setError);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  // Keep local jobs in sync with prop changes
  React.useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  const handleReschedule = useCallback(async (jobId: string, newDate: string) => {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, date: newDate } : j));
    try {
      await jobsAPI.update(jobId, { date: newDate });
    } catch (err) {
      // Revert on failure
      setJobs(initialJobs);
      setError(getErrorMessage(err, 'Failed to reschedule job'));
    }
  }, [initialJobs, setError]);

  const handleJobCreated = useCallback((newJob: Job) => {
    setJobs(prev => [...prev, newJob]);
  }, []);

  const handleJobClick = useCallback((job: Job) => {
    onNavigate('job-planning');
    onOpenAllocateModal?.(job);
  }, [onNavigate]);

  const onOpenAllocateModal = (job: Job) => {
    // Navigate to the jobs view and open the allocate modal
    onNavigate('job-planning');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Job Planning</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Schedule jobs, manage technician workload, and create jobs from templates.
          </p>
        </div>
        <button
          onClick={onOpenNewJobModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-sm transition-colors"
        >
          + New Job
        </button>
      </div>

      {/* AroFlo integration hook — kept as a future integration banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-900">Coming Soon: AroFlo Integration</span>
          <span className="text-blue-700 ml-2">
            Automatic job import from AroFlo calendar with human verification before adding to the system.
          </span>
        </div>
      </div>

      {/* Main planning board */}
      <JobPlanningBoard
        jobs={jobs}
        contacts={contacts}
        onReschedule={handleReschedule}
        onJobClick={handleJobClick}
      />

      {/* Bottom row: capacity + quick creator side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TechnicianCapacity jobs={jobs} contacts={contacts} />
        <QuickJobCreator
          templates={templates}
          contacts={contacts}
          onJobCreated={handleJobCreated}
        />
      </div>
    </div>
  );
};
