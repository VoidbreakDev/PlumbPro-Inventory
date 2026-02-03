/**
 * Subcontractor Management View
 * Manage subcontractors, compliance documents, insurance, and licenses
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  DollarSign,
  Star,
  Phone,
  Mail,
  Briefcase,
  Award,
  Clock,
  MapPin,
  ChevronDown,
  ChevronRight,
  X,
  Save,
  Building2,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react';
import { subcontractorAPI } from '../lib/subcontractorAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type { Subcontractor, InsuranceDocument, LicenseDocument } from '../types';
import { Badge } from '../components/Shared';

type TabType = 'all' | 'compliant' | 'pending' | 'non_compliant';
type DocumentType = 'insurance' | 'license';

// Mock data
const MOCK_SUBCONTRACTORS: Subcontractor[] = [
  {
    id: '1',
    name: 'Elite Electrical Services',
    type: 'Subcontractor',
    email: 'info@eliteelectrical.com.au',
    phone: '0412 345 678',
    abn: '12 345 678 901',
    businessName: 'Elite Electrical Services Pty Ltd',
    tradeType: ['Electrical', 'Data Cabling'],
    expertise: ['Commercial Fit-outs', 'Emergency Repairs', 'Switchboard Upgrades'],
    complianceStatus: 'compliant',
    availabilityStatus: 'available',
    typicalLeadTime: 2,
    hourlyRate: 95,
    dailyRate: 750,
    callOutFee: 150,
    rating: 4.8,
    totalJobs: 24,
    completedJobs: 23,
    averageJobValue: 2850,
    serviceArea: ['2000', '2010', '2020', '2030'],
    insuranceDocuments: [
      {
        id: 'i1',
        type: 'public_liability',
        provider: 'QBE Insurance',
        policyNumber: 'PL-2025-001234',
        coverageAmount: 20000000,
        issueDate: '2025-01-01',
        expiryDate: '2026-01-01',
        status: 'valid',
        verifiedAt: '2025-01-15T10:00:00Z',
        verifiedBy: 'Admin User',
      },
      {
        id: 'i2',
        type: 'workers_compensation',
        provider: 'Allianz',
        policyNumber: 'WC-789456',
        coverageAmount: 50000000,
        issueDate: '2025-01-01',
        expiryDate: '2026-01-01',
        status: 'valid',
      },
    ],
    licenseDocuments: [
      {
        id: 'l1',
        type: 'trade_license',
        licenseNumber: 'EL-12345',
        issuingAuthority: 'NSW Fair Trading',
        expiryDate: '2026-06-30',
        status: 'valid',
        verifiedAt: '2025-01-15T10:00:00Z',
        verifiedBy: 'Admin User',
      },
    ],
    emergencyContactName: 'John Smith',
    emergencyContactPhone: '0412 999 888',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: '2',
    name: 'Pro Concrete Solutions',
    type: 'Subcontractor',
    email: 'jobs@proconcrete.com.au',
    phone: '0423 456 789',
    abn: '98 765 432 109',
    businessName: 'Pro Concrete Solutions Pty Ltd',
    tradeType: ['Concreting', 'Excavation'],
    expertise: ['Slab Pouring', 'Driveways', 'Foundation Work'],
    complianceStatus: 'pending',
    availabilityStatus: 'limited',
    typicalLeadTime: 5,
    hourlyRate: 85,
    dailyRate: 680,
    rating: 4.2,
    totalJobs: 12,
    completedJobs: 11,
    insuranceDocuments: [
      {
        id: 'i3',
        type: 'public_liability',
        provider: 'CGU Insurance',
        policyNumber: 'PL-987654',
        coverageAmount: 10000000,
        issueDate: '2025-01-01',
        expiryDate: '2026-01-01',
        status: 'pending_verification',
      },
    ],
    licenseDocuments: [],
    createdAt: '2024-08-15T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
  },
  {
    id: '3',
    name: 'AirMax HVAC Services',
    type: 'Subcontractor',
    email: 'service@airmaxhvac.com.au',
    phone: '0434 567 890',
    abn: '11 222 333 444',
    businessName: 'AirMax HVAC Services Pty Ltd',
    tradeType: ['HVAC', 'Refrigeration'],
    expertise: ['Split System Install', 'Ducted Systems', 'Commercial HVAC'],
    complianceStatus: 'compliant',
    availabilityStatus: 'busy',
    typicalLeadTime: 7,
    hourlyRate: 110,
    dailyRate: 880,
    callOutFee: 200,
    rating: 4.9,
    totalJobs: 31,
    completedJobs: 30,
    averageJobValue: 4200,
    insuranceDocuments: [
      {
        id: 'i4',
        type: 'public_liability',
        provider: 'Zurich Insurance',
        policyNumber: 'PL-456789',
        coverageAmount: 20000000,
        issueDate: '2025-01-01',
        expiryDate: '2025-12-15',
        status: 'expiring',
      },
    ],
    licenseDocuments: [
      {
        id: 'l2',
        type: 'trade_license',
        licenseNumber: 'ARC-TICK-1234',
        issuingAuthority: 'Australian Refrigeration Council',
        expiryDate: '2026-03-31',
        status: 'valid',
      },
    ],
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2025-01-05T00:00:00Z',
  },
  {
    id: '4',
    name: 'Speedy Gas Fitting',
    type: 'Subcontractor',
    email: 'contact@speedygas.com.au',
    phone: '0445 678 901',
    abn: '55 666 777 888',
    tradeType: ['Gas Fitting'],
    expertise: ['Gas Hot Water', 'Gas Heating', 'Leak Detection'],
    complianceStatus: 'non_compliant',
    availabilityStatus: 'unavailable',
    insuranceDocuments: [
      {
        id: 'i5',
        type: 'public_liability',
        provider: 'Old Insurer',
        policyNumber: 'PL-OLD-001',
        coverageAmount: 5000000,
        issueDate: '2024-01-01',
        expiryDate: '2024-12-31',
        status: 'expired',
      },
    ],
    licenseDocuments: [
      {
        id: 'l3',
        type: 'trade_license',
        licenseNumber: 'GF-98765',
        issuingAuthority: 'NSW Fair Trading',
        expiryDate: '2024-06-30',
        status: 'expired',
      },
    ],
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
];

const TRADE_TYPES = ['Electrical', 'Plumbing', 'Gas Fitting', 'HVAC', 'Concreting', 'Excavation', 'Carpentry', 'Tiling', 'Painting', 'Roofing'];

const INSURANCE_TYPES = [
  { value: 'public_liability', label: 'Public Liability', defaultAmount: 20000000 },
  { value: 'professional_indemnity', label: 'Professional Indemnity', defaultAmount: 5000000 },
  { value: 'workers_compensation', label: 'Workers Compensation', defaultAmount: 50000000 },
  { value: 'vehicle', label: 'Vehicle Insurance', defaultAmount: 1000000 },
  { value: 'tool', label: 'Tool Insurance', defaultAmount: 50000 },
  { value: 'income_protection', label: 'Income Protection', defaultAmount: 10000 },
];

const LICENSE_TYPES = [
  { value: 'trade_license', label: 'Trade License' },
  { value: 'contractor_license', label: 'Contractor License' },
  { value: 'safety_certificate', label: 'Safety Certificate' },
  { value: 'white_card', label: 'White Card (Construction Induction)' },
  { value: 'working_with_children', label: 'Working with Children Check' },
];

export function SubcontractorManagementView() {
  const setError = useStore((state) => state.setError);
  
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>(MOCK_SUBCONTRACTORS);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Stats
  const stats = {
    total: subcontractors.length,
    compliant: subcontractors.filter(s => s.complianceStatus === 'compliant').length,
    pending: subcontractors.filter(s => s.complianceStatus === 'pending').length,
    nonCompliant: subcontractors.filter(s => s.complianceStatus === 'non_compliant').length,
    expiringDocs: subcontractors.filter(s => 
      s.insuranceDocuments.some(d => d.status === 'expiring') ||
      s.licenseDocuments.some(d => d.status === 'expiring')
    ).length,
  };

  // Filtered list
  const filteredSubcontractors = subcontractors.filter(sub => {
    if (activeTab !== 'all' && sub.complianceStatus !== activeTab) return false;
    if (selectedTrade && !sub.tradeType.includes(selectedTrade)) return false;
    if (searchQuery && 
        !sub.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !sub.abn.includes(searchQuery)) return false;
    return true;
  });

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge variant="green">Compliant</Badge>;
      case 'pending':
        return <Badge variant="yellow">Pending</Badge>;
      case 'non_compliant':
        return <Badge variant="red">Non-Compliant</Badge>;
      default:
        return <Badge variant="gray">Unknown</Badge>;
    }
  };

  const getAvailabilityBadge = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      limited: 'bg-amber-100 text-amber-800',
      busy: 'bg-blue-100 text-blue-800',
      unavailable: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.unavailable}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Compliant</p>
          <p className="text-2xl font-bold text-green-600">{stats.compliant}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Non-Compliant</p>
          <p className="text-2xl font-bold text-red-600">{stats.nonCompliant}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-orange-600">{stats.expiringDocs}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                {(['all', 'compliant', 'pending', 'non_compliant'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                      activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={selectedTrade}
                onChange={(e) => setSelectedTrade(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">All Trades</option>
                {TRADE_TYPES.map(trade => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search subcontractors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Subcontractor
              </button>
            </div>
          </div>
        </div>

        {/* Subcontractors List */}
        <div className="divide-y divide-slate-100">
          {filteredSubcontractors.map(sub => (
            <div
              key={sub.id}
              className="p-4 hover:bg-slate-50 cursor-pointer"
              onClick={() => {
                setSelectedSubcontractor(sub);
                setShowDetailModal(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800">{sub.name}</h3>
                    {getComplianceBadge(sub.complianceStatus)}
                    {getAvailabilityBadge(sub.availabilityStatus)}
                    {sub.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{sub.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      ABN: {sub.abn}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {sub.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {sub.email}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-2">
                    {sub.tradeType.map(trade => (
                      <span key={trade} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {trade}
                      </span>
                    ))}
                  </div>
                  
                  {/* Document Status */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        Insurance: {sub.insuranceDocuments.filter(d => d.status === 'valid').length}/{sub.insuranceDocuments.length} valid
                      </span>
                      {sub.insuranceDocuments.some(d => d.status === 'expiring') && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        Licenses: {sub.licenseDocuments.filter(d => d.status === 'valid').length}/{sub.licenseDocuments.length} valid
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right ml-4">
                  {sub.hourlyRate && (
                    <p className="font-semibold text-slate-800">
                      ${sub.hourlyRate}/hr
                    </p>
                  )}
                  {sub.totalJobs && (
                    <p className="text-sm text-slate-500">
                      {sub.completedJobs}/{sub.totalJobs} jobs
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredSubcontractors.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3" />
              <p>No subcontractors found</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSubcontractor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-slate-800">{selectedSubcontractor.name}</h2>
                    {getComplianceBadge(selectedSubcontractor.complianceStatus)}
                  </div>
                  <p className="text-slate-500">{selectedSubcontractor.businessName}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Contact Info */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Contact Information</h3>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        ABN: {selectedSubcontractor.abn}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {selectedSubcontractor.phone}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {selectedSubcontractor.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Trades & Expertise */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Trades & Expertise</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedSubcontractor.tradeType.map(trade => (
                        <span key={trade} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {trade}
                        </span>
                      ))}
                    </div>
                    {selectedSubcontractor.expertise && (
                      <ul className="text-sm text-slate-600 space-y-1">
                        {selectedSubcontractor.expertise.map(exp => (
                          <li key={exp} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {exp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  
                  {/* Rates */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Rates</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedSubcontractor.hourlyRate && (
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Hourly Rate</p>
                          <p className="text-lg font-semibold">${selectedSubcontractor.hourlyRate}</p>
                        </div>
                      )}
                      {selectedSubcontractor.dailyRate && (
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-sm text-slate-500">Daily Rate</p>
                          <p className="text-lg font-semibold">${selectedSubcontractor.dailyRate}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-6">
                  {/* Insurance Documents */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Insurance Documents</h3>
                    <div className="space-y-2">
                      {selectedSubcontractor.insuranceDocuments.map(doc => (
                        <div
                          key={doc.id}
                          className={`p-3 rounded-lg border ${
                            doc.status === 'valid' ? 'border-green-200 bg-green-50' :
                            doc.status === 'expiring' ? 'border-amber-200 bg-amber-50' :
                            'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {INSURANCE_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                              </p>
                              <p className="text-xs text-slate-500">
                                {doc.provider} • Policy: {doc.policyNumber}
                              </p>
                              <p className="text-xs text-slate-500">
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge
                              variant={
                                doc.status === 'valid' ? 'green' :
                                doc.status === 'expiring' ? 'yellow' :
                                doc.status === 'pending_verification' ? 'blue' :
                                'red'
                              }
                            >
                              {doc.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {doc.verifiedAt && (
                            <p className="text-xs text-green-600 mt-1">
                              <BadgeCheck className="w-3 h-3 inline mr-1" />
                              Verified by {doc.verifiedBy}
                            </p>
                          )}
                        </div>
                      ))}
                      {selectedSubcontractor.insuranceDocuments.length === 0 && (
                        <p className="text-sm text-slate-400">No insurance documents on file</p>
                      )}
                    </div>
                  </div>
                  
                  {/* License Documents */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Licenses & Certifications</h3>
                    <div className="space-y-2">
                      {selectedSubcontractor.licenseDocuments.map(doc => (
                        <div
                          key={doc.id}
                          className={`p-3 rounded-lg border ${
                            doc.status === 'valid' ? 'border-green-200 bg-green-50' :
                            doc.status === 'expiring' ? 'border-amber-200 bg-amber-50' :
                            'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {LICENSE_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                              </p>
                              <p className="text-xs text-slate-500">
                                {doc.issuingAuthority} • {doc.licenseNumber}
                              </p>
                              <p className="text-xs text-slate-500">
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge
                              variant={
                                doc.status === 'valid' ? 'green' :
                                doc.status === 'expiring' ? 'yellow' :
                                doc.status === 'pending_verification' ? 'blue' :
                                'red'
                              }
                            >
                              {doc.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {selectedSubcontractor.licenseDocuments.length === 0 && (
                        <p className="text-sm text-slate-400">No licenses on file</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubcontractorManagementView;
