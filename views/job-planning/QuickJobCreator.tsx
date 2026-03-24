import React, { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Zap, ChevronDown } from 'lucide-react';
import { Job, Contact, JobTemplate } from '../../types';
import { jobsAPI } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useToast } from '../../components/ToastNotification';

interface QuickJobCreatorProps {
  templates: JobTemplate[];
  contacts: Contact[];
  onJobCreated: (job: Job) => void;
}

export const QuickJobCreator: React.FC<QuickJobCreatorProps> = ({
  templates,
  contacts,
  onJobCreated
}) => {
  const toast = useToast();
  const plumbers = contacts.filter(c => c.type === 'Plumber');
  const customers = contacts.filter(c => c.type === 'Customer');

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl && !jobTitle) {
      setJobTitle(tpl.name);
    }
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleCreate = async () => {
    if (!jobTitle.trim()) {
      toast.warning('Job title is required');
      return;
    }
    if (!date) {
      toast.warning('Date is required');
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);

    setCreating(true);
    try {
      const newJob = await jobsAPI.create({
        title: jobTitle.trim(),
        date,
        jobType: 'Service',
        status: 'Scheduled',
        assignedWorkerIds: selectedWorkerIds,
        customerId: customerId || undefined,
        allocatedItems: template?.items ?? [],
        isPicked: false
      });
      toast.success(`Job "${newJob.title}" created successfully`);
      onJobCreated(newJob);
      // Reset form
      setJobTitle('');
      setSelectedTemplateId('');
      setSelectedWorkerIds([]);
      setCustomerId('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create job'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-slate-800">Quick Job Creator</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* Template Selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Start from template (optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateSelect(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— No template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTemplateId && (
                <p className="text-xs text-slate-400 mt-1">
                  {templates.find(t => t.id === selectedTemplateId)?.items.length ?? 0} stock items will be pre-allocated
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Job Title *
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Hot Water System Replacement"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Scheduled Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Assign Technicians */}
          {plumbers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Assign Technicians
              </label>
              <div className="flex flex-wrap gap-2">
                {plumbers.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleWorker(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedWorkerIds.includes(p.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {p.name.split(' ')[0]}
                    {selectedWorkerIds.includes(p.id) && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer (optional) */}
          {customers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Customer (optional)
              </label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— Select customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !jobTitle.trim() || !date}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {creating ? 'Creating…' : 'Create Job'}
          </button>
        </div>
      )}
    </div>
  );
};
