/**
 * Lead Pipeline View
 * Sales pipeline management from inquiry to conversion
 */

import React, { useState, useMemo } from 'react';
import {
  Target,
  Phone,
  Mail,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  Star,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2,
  MapPin,
  Tag,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource, LeadPriority, LostReason } from '../types';
import { Badge } from '../components/Shared';

type ViewMode = 'pipeline' | 'list';
type FilterStatus = 'all' | LeadStatus;

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'quoted', 'negotiation', 'won', 'lost', 'on_hold'];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  new: { label: 'New', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Target },
  contacted: { label: 'Contacted', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Phone },
  qualified: { label: 'Qualified', color: 'text-indigo-600', bgColor: 'bg-indigo-50', icon: CheckCircle },
  quoted: { label: 'Quoted', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: DollarSign },
  negotiation: { label: 'Negotiation', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: MessageSquare },
  won: { label: 'Won', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  lost: { label: 'Lost', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
  on_hold: { label: 'On Hold', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: Clock },
};

const SOURCE_ICONS: Record<LeadSource, any> = {
  website: Target,
  phone: Phone,
  referral: User,
  social_media: Send,
  email: Mail,
  walk_in: Building2,
  advertisement: Tag,
  other: Tag,
};

const PRIORITY_CONFIG: Record<LeadPriority, { color: string; bgColor: string; label: string }> = {
  hot: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Hot' },
  warm: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Warm' },
  cold: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Cold' },
};

// Mock data
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    leadNumber: 'LEAD-2026-001',
    contactName: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '0412 345 678',
    address: '123 Main St, Sydney NSW 2000',
    source: 'website',
    status: 'new',
    priority: 'hot',
    jobType: 'Bathroom Renovation',
    description: 'Complete bathroom renovation including plumbing, tiling, and fixture installation',
    estimatedValue: 15000,
    assignedToName: 'Mike Smith',
    receivedAt: '2026-02-01T09:00:00Z',
    nextFollowUpDate: '2026-02-02T10:00:00Z',
    nextFollowUpType: 'call',
    communications: [],
    tags: ['renovation', 'bathroom'],
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
  },
  {
    id: '2',
    leadNumber: 'LEAD-2026-002',
    contactName: 'David Chen',
    companyName: 'Chen Property Group',
    email: 'david@chenproperties.com.au',
    phone: '0423 456 789',
    source: 'referral',
    status: 'quoted',
    priority: 'warm',
    jobType: 'Commercial Fit-out',
    description: 'Plumbing for new office fit-out - 5 bathrooms, kitchen, and staff amenities',
    estimatedValue: 45000,
    assignedToName: 'Jane Wilson',
    receivedAt: '2026-01-25T14:30:00Z',
    quotedAt: '2026-01-28T11:00:00Z',
    communications: [],
    tags: ['commercial', 'fit-out'],
    createdAt: '2026-01-25T14:30:00Z',
    updatedAt: '2026-01-28T11:00:00Z',
  },
  {
    id: '3',
    leadNumber: 'LEAD-2026-003',
    contactName: 'Emma Thompson',
    email: 'emma.t@email.com',
    phone: '0434 567 890',
    source: 'phone',
    status: 'contacted',
    priority: 'hot',
    jobType: 'Blocked Drain',
    description: 'Emergency blocked drain at residential property',
    estimatedValue: 350,
    assignedToName: 'Mike Smith',
    receivedAt: '2026-02-01T08:15:00Z',
    firstContactAt: '2026-02-01T08:30:00Z',
    communications: [],
    tags: ['emergency', 'drainage'],
    createdAt: '2026-02-01T08:15:00Z',
    updatedAt: '2026-02-01T08:30:00Z',
  },
  {
    id: '4',
    leadNumber: 'LEAD-2026-004',
    contactName: 'Robert Brown',
    email: 'rbrown@email.com',
    phone: '0445 678 901',
    source: 'social_media',
    status: 'negotiation',
    priority: 'warm',
    jobType: 'Hot Water System',
    description: 'Replace existing electric hot water system with gas',
    estimatedValue: 2800,
    assignedToName: 'Jane Wilson',
    receivedAt: '2026-01-20T10:00:00Z',
    quotedAt: '2026-01-22T15:00:00Z',
    communications: [],
    tags: ['hot-water', 'gas'],
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-30T14:00:00Z',
  },
  {
    id: '5',
    leadNumber: 'LEAD-2026-005',
    contactName: 'Lisa Anderson',
    email: 'lisa.a@email.com',
    phone: '0456 789 012',
    source: 'website',
    status: 'won',
    priority: 'hot',
    jobType: 'Kitchen Plumbing',
    description: 'New kitchen plumbing for renovation - sink, dishwasher, fridge connection',
    estimatedValue: 4200,
    assignedToName: 'Mike Smith',
    receivedAt: '2026-01-15T09:00:00Z',
    convertedAt: '2026-01-25T16:00:00Z',
    communications: [],
    tags: ['kitchen', 'renovation'],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-25T16:00:00Z',
  },
  {
    id: '6',
    leadNumber: 'LEAD-2026-006',
    contactName: 'Michael Wilson',
    email: 'mwilson@email.com',
    phone: '0467 890 123',
    source: 'advertisement',
    status: 'lost',
    priority: 'cold',
    jobType: 'Full House Repipe',
    description: 'Complete repiping of old house',
    estimatedValue: 12000,
    assignedToName: 'Jane Wilson',
    receivedAt: '2026-01-10T11:00:00Z',
    lostReason: 'price',
    lostReasonDetail: 'Customer found cheaper quote elsewhere',
    communications: [],
    tags: ['repipe', 'quote'],
    createdAt: '2026-01-10T11:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
  },
  {
    id: '7',
    leadNumber: 'LEAD-2026-007',
    contactName: 'Amanda White',
    email: 'amanda@email.com',
    phone: '0478 901 234',
    source: 'walk_in',
    status: 'qualified',
    priority: 'warm',
    jobType: 'Gas Installation',
    description: 'New gas line for outdoor BBQ and fireplace',
    estimatedValue: 3500,
    assignedToName: 'Mike Smith',
    receivedAt: '2026-01-28T13:00:00Z',
    communications: [],
    tags: ['gas', 'outdoor'],
    createdAt: '2026-01-28T13:00:00Z',
    updatedAt: '2026-01-29T09:00:00Z',
  },
];

const LOST_REASONS: Record<LostReason, string> = {
  price: 'Price too high',
  timing: 'Bad timing',
  competitor: 'Went with competitor',
  no_response: 'No response',
  not_qualified: 'Not qualified',
  other: 'Other',
};

export function LeadPipelineView() {
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);

  const leads = MOCK_LEADS;

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filterStatus !== 'all' && lead.status !== filterStatus) return false;
      if (searchQuery && 
          !lead.contactName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !lead.leadNumber.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [leads, filterStatus, searchQuery]);

  // Pipeline stats
  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status));
    return {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      active: activeLeads.length,
      quoted: leads.filter(l => l.status === 'quoted').length,
      won: leads.filter(l => l.status === 'won').length,
      lost: leads.filter(l => l.status === 'lost').length,
      pipelineValue: activeLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
      wonValue: leads.filter(l => l.status === 'won').reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
      conversionRate: leads.filter(l => l.status === 'won').length / (leads.filter(l => ['won', 'lost'].includes(l.status)).length || 1) * 100,
    };
  }, [leads]);

  // Group leads by status for pipeline view
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    LEAD_STATUSES.forEach(status => {
      grouped[status] = filteredLeads.filter(lead => lead.status === status);
    });
    return grouped;
  }, [filteredLeads]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
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

      {/* Toolbar */}
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
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            {LEAD_STATUSES.map(status => (
              <option key={status} value={status}>
                {STATUS_CONFIG[status].label}
              </option>
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        </div>
      </div>

      {/* Pipeline View */}
      {viewMode === 'pipeline' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="flex min-w-max p-4 gap-4">
              {LEAD_STATUSES.filter(s => !['won', 'lost'].includes(s)).map(status => {
                const statusLeads = leadsByStatus[status] || [];
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                
                return (
                  <div key={status} className="w-72 flex-shrink-0">
                    {/* Column Header */}
                    <div className={`p-3 rounded-lg mb-3 ${config.bgColor}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span className={`font-semibold ${config.color}`}>{config.label}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-white ${config.color}`}>
                          {statusLeads.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatCurrency(statusLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0))}
                      </p>
                    </div>
                    
                    {/* Leads */}
                    <div className="space-y-2">
                      {statusLeads.map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowLeadModal(true);
                          }}
                          className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-slate-800 text-sm">{lead.contactName}</h4>
                            {lead.priority && (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${PRIORITY_CONFIG[lead.priority].bgColor} ${PRIORITY_CONFIG[lead.priority].color}`}>
                                {PRIORITY_CONFIG[lead.priority].label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{lead.jobType}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">
                              {formatCurrency(lead.estimatedValue)}
                            </span>
                            <span className="text-slate-400">
                              {formatDate(lead.receivedAt)}
                            </span>
                          </div>
                          {lead.assignedToName && (
                            <p className="text-xs text-slate-400 mt-1">
                              Assigned: {lead.assignedToName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Won/Lost Column */}
              <div className="w-72 flex-shrink-0">
                <div className="p-3 rounded-lg mb-3 bg-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Closed</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white text-slate-600">
                      {leadsByStatus.won?.length + leadsByStatus.lost?.length}
                    </span>
                  </div>
                </div>
                
                {/* Won */}
                {(leadsByStatus.won || []).map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setShowLeadModal(true);
                    }}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg shadow-sm mb-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-medium text-green-600">Won</span>
                    </div>
                    <h4 className="font-medium text-slate-800 text-sm">{lead.contactName}</h4>
                    <p className="text-xs text-slate-500">{formatCurrency(lead.estimatedValue)}</p>
                  </div>
                ))}
                
                {/* Lost */}
                {(leadsByStatus.lost || []).map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setShowLeadModal(true);
                    }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm mb-2 cursor-pointer opacity-60"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      <span className="text-xs font-medium text-red-600">Lost</span>
                    </div>
                    <h4 className="font-medium text-slate-800 text-sm">{lead.contactName}</h4>
                    {lead.lostReason && (
                      <p className="text-xs text-slate-400">{LOST_REASONS[lead.lostReason]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Lead</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Source</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Value</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Assigned</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(lead => {
                const statusConfig = STATUS_CONFIG[lead.status];
                const SourceIcon = SOURCE_ICONS[lead.source];
                
                return (
                  <tr
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setShowLeadModal(true);
                    }}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{lead.contactName}</p>
                        <p className="text-sm text-slate-500">{lead.jobType}</p>
                        <p className="text-xs text-slate-400">{lead.leadNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <SourceIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600 capitalize">{lead.source.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant={
                        lead.status === 'won' ? 'green' :
                        lead.status === 'lost' ? 'red' :
                        lead.status === 'new' ? 'blue' :
                        'yellow'
                      }>
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-center font-medium">
                      {formatCurrency(lead.estimatedValue)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-600">
                      {lead.assignedToName || 'Unassigned'}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-500">
                      {formatDate(lead.receivedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LeadPipelineView;
