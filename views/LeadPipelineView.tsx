import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { leadAPI } from '../lib/leadAPI';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import type { Lead, LeadPriority, LeadSource, LeadStatus, LostReason } from '../types';
import { Badge } from '../components/Shared';

type ViewMode = 'pipeline' | 'list';
type FilterStatus = 'all' | LeadStatus;

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'quoted', 'negotiation', 'won', 'lost', 'on_hold'];

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'gray' }> = {
  new: { label: 'New', variant: 'blue' },
  contacted: { label: 'Contacted', variant: 'purple' },
  qualified: { label: 'Qualified', variant: 'green' },
  quoted: { label: 'Quoted', variant: 'yellow' },
  negotiation: { label: 'Negotiation', variant: 'purple' },
  won: { label: 'Won', variant: 'green' },
  lost: { label: 'Lost', variant: 'red' },
  on_hold: { label: 'On Hold', variant: 'gray' },
};

const PRIORITY_OPTIONS: LeadPriority[] = ['hot', 'warm', 'cold'];
const SOURCE_OPTIONS: LeadSource[] = ['website', 'phone', 'referral', 'social_media', 'email', 'walk_in', 'advertisement', 'other'];
const LOST_REASONS: LostReason[] = ['price', 'timing', 'competitor', 'no_response', 'not_qualified', 'other'];

const emptyLead = (): Partial<Lead> => ({
  contactName: '',
  email: '',
  phone: '',
  source: 'website',
  status: 'new',
  priority: 'warm',
  communications: [],
  tags: [],
});

export function LeadPipelineView() {
  const setError = useStore((state) => state.setError);

  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDraft, setLeadDraft] = useState<Partial<Lead>>(emptyLead());
  const [communicationDraft, setCommunicationDraft] = useState({ method: 'phone', summary: '', notes: '' });
  const [followUpDraft, setFollowUpDraft] = useState({ date: '', type: 'call', notes: '' });
  const [lostReason, setLostReason] = useState<LostReason>('price');
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async (background = false) => {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await leadAPI.getLeads({ pageSize: 200 });
      setLeads(response.leads);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load leads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStatus !== 'all' && lead.status !== filterStatus) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const haystack = `${lead.contactName} ${lead.email || ''} ${lead.leadNumber} ${lead.jobType || ''}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [filterStatus, leads, searchQuery]);

  const stats = useMemo(() => {
    const activeLeads = leads.filter((lead) => !['won', 'lost'].includes(lead.status));
    const closedLeads = leads.filter((lead) => ['won', 'lost'].includes(lead.status));

    return {
      total: leads.length,
      active: activeLeads.length,
      won: leads.filter((lead) => lead.status === 'won').length,
      wonValue: leads.filter((lead) => lead.status === 'won').reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0),
      pipelineValue: activeLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0),
      conversionRate: closedLeads.length > 0 ? (leads.filter((lead) => lead.status === 'won').length / closedLeads.length) * 100 : 0,
    };
  }, [leads]);

  const leadsByStatus = useMemo(() => {
    return LEAD_STATUSES.reduce((accumulator, status) => {
      accumulator[status] = filteredLeads.filter((lead) => lead.status === status);
      return accumulator;
    }, {} as Record<LeadStatus, Lead[]>);
  }, [filteredLeads]);

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const openLead = async (lead: Lead) => {
    try {
      const freshLead = await leadAPI.getLead(lead.id);
      setSelectedLead(freshLead);
      setCommunicationDraft({ method: 'phone', summary: '', notes: '' });
      setFollowUpDraft({
        date: freshLead.nextFollowUpDate?.slice(0, 10) || '',
        type: freshLead.nextFollowUpType || 'call',
        notes: freshLead.followUpNotes || '',
      });
      setShowLeadModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load lead details'));
    }
  };

  const refreshSelectedLead = async (leadId: string) => {
    const freshLead = await leadAPI.getLead(leadId);
    setSelectedLead(freshLead);
    await loadData(true);
    return freshLead;
  };

  const saveLead = async () => {
    try {
      await leadAPI.createLead({
        ...leadDraft,
        phone: leadDraft.phone || '',
        contactName: leadDraft.contactName || '',
        source: leadDraft.source || 'website',
        status: leadDraft.status || 'new',
        priority: leadDraft.priority || 'warm',
        communications: [],
        tags: String(leadDraft.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        receivedAt: new Date().toISOString(),
      } as Omit<Lead, 'id' | 'leadNumber' | 'communications' | 'createdAt' | 'updatedAt'>);
      setShowCreateModal(false);
      setLeadDraft(emptyLead());
      setNotice('Lead created');
      await loadData(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create lead'));
    }
  };

  const updateLeadStatus = async (status: LeadStatus) => {
    if (!selectedLead) return;
    try {
      await leadAPI.updateStatus(selectedLead.id, status);
      await refreshSelectedLead(selectedLead.id);
      setNotice(`Lead marked as ${STATUS_CONFIG[status].label.toLowerCase()}`);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to update lead status'));
    }
  };

  const addCommunication = async () => {
    if (!selectedLead || !communicationDraft.summary.trim()) return;
    try {
      await leadAPI.addCommunication(selectedLead.id, {
        type: 'outbound',
        method: communicationDraft.method as any,
        timestamp: new Date().toISOString(),
        summary: communicationDraft.summary.trim(),
        notes: communicationDraft.notes.trim() || undefined,
      });
      setCommunicationDraft({ method: 'phone', summary: '', notes: '' });
      await refreshSelectedLead(selectedLead.id);
      setNotice('Communication logged');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save communication'));
    }
  };

  const saveFollowUp = async () => {
    if (!selectedLead || !followUpDraft.date) return;
    try {
      await leadAPI.scheduleFollowUp(selectedLead.id, {
        date: new Date(followUpDraft.date).toISOString(),
        type: followUpDraft.type as any,
        notes: followUpDraft.notes || undefined,
      });
      await refreshSelectedLead(selectedLead.id);
      setNotice('Follow-up scheduled');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to schedule follow-up'));
    }
  };

  const convertToQuote = async () => {
    if (!selectedLead) return;
    try {
      const result = await leadAPI.convertToQuote(selectedLead.id, {
        title: selectedLead.jobType || `Quote for ${selectedLead.contactName}`,
        description: selectedLead.description,
        customerName: selectedLead.contactName,
        customerEmail: selectedLead.email,
        customerPhone: selectedLead.phone,
        customerAddress: selectedLead.address,
        total: selectedLead.estimatedValue || 0,
      });
      setSelectedLead(result.lead);
      await loadData(true);
      setNotice(`Quote ${result.quote.quoteNumber || result.quote.id} created`);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to convert lead to quote'));
    }
  };

  const markWon = async () => {
    if (!selectedLead) return;
    try {
      const next = await leadAPI.markAsWon(selectedLead.id, {});
      setSelectedLead(next);
      await loadData(true);
      setNotice('Lead marked as won');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to mark lead as won'));
    }
  };

  const markLost = async () => {
    if (!selectedLead) return;
    try {
      const next = await leadAPI.markAsLost(selectedLead.id, lostReason);
      setSelectedLead(next);
      await loadData(true);
      setNotice('Lead marked as lost');
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to mark lead as lost'));
    }
  };

  const renderLeadCard = (lead: Lead) => (
    <button
      key={lead.id}
      onClick={() => void openLead(lead)}
      className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{lead.contactName}</span>
            <Badge variant={STATUS_CONFIG[lead.status].variant}>{STATUS_CONFIG[lead.status].label}</Badge>
          </div>
          <p className="text-sm text-slate-500">{lead.leadNumber}</p>
          <p className="text-sm text-slate-600">{lead.jobType || 'General enquiry'}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-800">{formatCurrency(lead.estimatedValue)}</p>
          <p className="text-xs text-slate-400 capitalize">{lead.priority}</p>
        </div>
      </div>
    </button>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
        <RotateCcw className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Total Leads</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Active Pipeline</p>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-sm text-slate-400">{formatCurrency(stats.pipelineValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Won</p>
          <p className="text-2xl font-bold text-green-600">{stats.won}</p>
          <p className="text-sm text-slate-400">{formatCurrency(stats.wonValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Conversion Rate</p>
          <p className="text-2xl font-bold text-purple-600">{stats.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'pipeline' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
          </div>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <button onClick={() => void loadData(true)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RotateCcw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        </div>
      </div>

      {viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {LEAD_STATUSES.map((status) => (
            <div key={status} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{STATUS_CONFIG[status].label}</span>
                <Badge variant={STATUS_CONFIG[status].variant}>{leadsByStatus[status]?.length || 0}</Badge>
              </div>
              <div className="space-y-3">
                {(leadsByStatus[status] || []).map((lead) => renderLeadCard(lead))}
                {(leadsByStatus[status] || []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                    No leads
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Lead</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Source</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => void openLead(lead)}>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-800">{lead.contactName}</p>
                    <p className="text-sm text-slate-500">{lead.leadNumber}</p>
                  </td>
                  <td className="px-4 py-4 capitalize text-slate-600">{lead.source.replace('_', ' ')}</td>
                  <td className="px-4 py-4"><Badge variant={STATUS_CONFIG[lead.status].variant}>{STATUS_CONFIG[lead.status].label}</Badge></td>
                  <td className="px-4 py-4 text-right font-medium text-slate-800">{formatCurrency(lead.estimatedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Create Lead</h2>
                <p className="text-sm text-slate-500">Persist a new lead to the live pipeline</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-slate-600">
                Contact Name
                <input value={leadDraft.contactName || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, contactName: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm text-slate-600">
                Phone
                <input value={leadDraft.phone || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm text-slate-600">
                Email
                <input value={leadDraft.email || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm text-slate-600">
                Source
                <select value={leadDraft.source || 'website'} onChange={(event) => setLeadDraft((current) => ({ ...current, source: event.target.value as LeadSource }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg">
                  {SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Priority
                <select value={leadDraft.priority || 'warm'} onChange={(event) => setLeadDraft((current) => ({ ...current, priority: event.target.value as LeadPriority }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg">
                  {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Job Type
                <input value={leadDraft.jobType || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, jobType: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Estimated Value
                <input type="number" value={leadDraft.estimatedValue || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, estimatedValue: Number(event.target.value) || undefined }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Description
                <textarea value={leadDraft.description || ''} onChange={(event) => setLeadDraft((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[120px]" />
              </label>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={() => void saveLead()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeadModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-800">{selectedLead.contactName}</h2>
                  <Badge variant={STATUS_CONFIG[selectedLead.status].variant}>{STATUS_CONFIG[selectedLead.status].label}</Badge>
                </div>
                <p className="text-slate-500">{selectedLead.leadNumber}</p>
              </div>
              <button onClick={() => setShowLeadModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Source</p>
                  <p className="font-semibold text-slate-800 mt-1 capitalize">{selectedLead.source.replace('_', ' ')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Priority</p>
                  <p className="font-semibold text-slate-800 mt-1 capitalize">{selectedLead.priority}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Estimated Value</p>
                  <p className="font-semibold text-slate-800 mt-1">{formatCurrency(selectedLead.estimatedValue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Next Follow-up</p>
                  <p className="font-semibold text-slate-800 mt-1">{selectedLead.nextFollowUpDate ? new Date(selectedLead.nextFollowUpDate).toLocaleDateString('en-AU') : 'Not scheduled'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {LEAD_STATUSES.filter((status) => !['won', 'lost'].includes(status)).map((status) => (
                  <button
                    key={status}
                    onClick={() => void updateLeadStatus(status)}
                    className={`px-3 py-2 rounded-lg text-sm border ${selectedLead.status === status ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
                <button onClick={() => void convertToQuote()} className="px-3 py-2 rounded-lg text-sm border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100">
                  Convert to Quote
                </button>
                <button onClick={() => void markWon()} className="px-3 py-2 rounded-lg text-sm border border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
                  Mark Won
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                  <h3 className="font-semibold text-slate-800">Lead Details</h3>
                  <div className="space-y-2 text-sm text-slate-600">
                    {selectedLead.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {selectedLead.phone}</p>}
                    {selectedLead.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {selectedLead.email}</p>}
                    {selectedLead.companyName && <p className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {selectedLead.companyName}</p>}
                    {selectedLead.address && <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {selectedLead.address}</p>}
                    {selectedLead.jobType && <p className="flex items-center gap-2"><Tag className="w-4 h-4" /> {selectedLead.jobType}</p>}
                  </div>
                  {selectedLead.description && (
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      {selectedLead.description}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                  <h3 className="font-semibold text-slate-800">Add Communication</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select value={communicationDraft.method} onChange={(event) => setCommunicationDraft((current) => ({ ...current, method: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg">
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="meeting">Meeting</option>
                    </select>
                    <input value={communicationDraft.summary} onChange={(event) => setCommunicationDraft((current) => ({ ...current, summary: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-2" placeholder="Summary" />
                    <textarea value={communicationDraft.notes} onChange={(event) => setCommunicationDraft((current) => ({ ...current, notes: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-3 min-h-[100px]" placeholder="Notes" />
                  </div>
                  <button onClick={() => void addCommunication()} className="text-sm text-blue-600 hover:underline">
                    Save communication
                  </button>

                  <h3 className="font-semibold text-slate-800 pt-2">Schedule Follow-up</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="date" value={followUpDraft.date} onChange={(event) => setFollowUpDraft((current) => ({ ...current, date: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg" />
                    <select value={followUpDraft.type} onChange={(event) => setFollowUpDraft((current) => ({ ...current, type: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg">
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="visit">Visit</option>
                    </select>
                    <input value={followUpDraft.notes} onChange={(event) => setFollowUpDraft((current) => ({ ...current, notes: event.target.value }))} className="px-3 py-2 border border-slate-200 rounded-lg" placeholder="Notes" />
                  </div>
                  <button onClick={() => void saveFollowUp()} className="text-sm text-blue-600 hover:underline">
                    Schedule follow-up
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Communication History</h3>
                  <span className="text-sm text-slate-400">{selectedLead.communications.length} entries</span>
                </div>
                {selectedLead.communications.length === 0 ? (
                  <p className="text-sm text-slate-500">No communications logged yet</p>
                ) : (
                  selectedLead.communications.map((communication) => (
                    <div key={communication.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{communication.summary}</p>
                          <p className="text-sm text-slate-500">{communication.method} • {new Date(communication.timestamp).toLocaleString('en-AU')}</p>
                        </div>
                        <Badge variant="slate">{communication.type}</Badge>
                      </div>
                      {communication.notes && <p className="text-sm text-slate-600 mt-2">{communication.notes}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <h3 className="font-semibold text-red-800">Mark as Lost</h3>
                <div className="flex flex-wrap gap-2">
                  {LOST_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setLostReason(reason)}
                      className={`px-3 py-2 rounded-lg text-sm border ${lostReason === reason ? 'border-red-500 bg-white text-red-700' : 'border-red-200 text-red-600 hover:bg-white'}`}
                    >
                      {reason.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <button onClick={() => void markLost()} className="text-sm text-red-700 hover:underline">
                  Mark lost
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowLeadModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadPipelineView;
