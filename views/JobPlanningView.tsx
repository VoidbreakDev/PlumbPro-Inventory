import React from 'react';
import { Job, Contact, InventoryItem, JobTemplate, AllocatedItem, Kit } from '../types';
import { JobsView } from './JobsView';

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

/**
 * Job Planning View
 * This view is focused on planning and creating new jobs, managing stock allocation,
 * and working with stock templates.
 *
 * Features:
 * - Create and manage jobs
 * - Allocate stock to jobs
 * - Create and use stock templates for common jobs
 * - Manage job templates library
 *
 * Future Enhancement: AroFlo Integration
 * - Automatically sync jobs from AroFlo calendar
 * - Human verification step before adding to system
 * - Auto-populate job details (title, date, workers, location)
 */
export const JobPlanningView: React.FC<JobPlanningViewProps> = (props) => {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Job Planning & Stock Templates</h2>
        <p className="text-slate-600">
          Plan jobs, allocate stock, and manage reusable stock templates for common job types.
        </p>
      </div>

      {/* Info Banner for Future AroFlo Integration */}
      <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">🚀 Coming Soon: AroFlo Integration</h3>
            <p className="text-sm text-blue-700">
              Automatic job import from AroFlo calendar with human verification before adding to the system.
            </p>
          </div>
        </div>
      </div>

      {/* Use the existing JobsView component which includes Stock Templates management */}
      <JobsView {...props} />
    </div>
  );
};
