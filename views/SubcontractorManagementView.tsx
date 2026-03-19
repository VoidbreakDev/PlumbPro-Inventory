import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Star,
  Users,
  X,
} from 'lucide-react';
import { subcontractorAPI } from '../lib/subcontractorAPI';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import type { InsuranceDocument, LicenseDocument, Subcontractor, SubcontractorJob } from '../types';
import { Badge } from '../components/Shared';

type TabType = 'all' | 'compliant' | 'pending' | 'non_compliant';

type DraftSubcontractor = {
  name: string;
  email: string;
  phone: string;
  abn: string;
  businessName: string;
  tradingName: string;
  tradeType: string;
  expertise: string;
  availabilityStatus: Subcontractor['availabilityStatus'];
  hourlyRate: string;
  dailyRate: string;
  callOutFee: string;
  typicalLeadTime: string;
  serviceArea: string;
  company: string;
};

type DraftInsurance = {
  type: InsuranceDocument['type'];
  provider: string;
  policyNumber: string;
  coverageAmount: string;
  expiryDate: string;
};

type DraftLicense = {
  type: LicenseDocument['type'];
  licenseNumber: string;
  issuingAuthority: string;
  expiryDate: string;
};

type DraftJob = {
  jobId: string;
  jobTitle: string;
  scopeOfWork: string;
  hourlyRate: string;
  totalValue: string;
  status: SubcontractorJob['status'];
};

const emptyDraft = (): DraftSubcontractor => ({
  name: '',
  email: '',
  phone: '',
  abn: '',
  businessName: '',
  tradingName: '',
  tradeType: '',
  expertise: '',
  availabilityStatus: 'available',
  hourlyRate: '',
  dailyRate: '',
  callOutFee: '',
  typicalLeadTime: '',
  serviceArea: '',
  company: '',
});

const emptyInsurance = (): DraftInsurance => ({
  type: 'public_liability',
  provider: '',
  policyNumber: '',
  coverageAmount: '',
  expiryDate: '',
});

const emptyLicense = (): DraftLicense => ({
  type: 'trade_license',
  licenseNumber: '',
  issuingAuthority: '',
  expiryDate: '',
});

const emptyJob = (): DraftJob => ({
  jobId: '',
  jobTitle: '',
  scopeOfWork: '',
  hourlyRate: '',
  totalValue: '',
  status: 'quoted',
});

const formatCurrency = (value?: number) => new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
}).format(value || 0);

export function SubcontractorManagementView() {
  const setError = useStore((state) => state.setError);

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [tradeTypes, setTradeTypes] = useState<string[]>([]);
  const [selectedTrade, setSelectedTrade] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [subcontractorJobs, setSubcontractorJobs] = useState<SubcontractorJob[]>([]);
  const [draft, setDraft] = useState<DraftSubcontractor>(emptyDraft());
  const [insuranceDraft, setInsuranceDraft] = useState<DraftInsurance>(emptyInsurance());
  const [licenseDraft, setLicenseDraft] = useState<DraftLicense>(emptyLicense());
  const [jobDraft, setJobDraft] = useState<DraftJob>(emptyJob());
  const [jobRatings, setJobRatings] = useState<Record<string, { rating: string; review: string; wouldRecommend: boolean }>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [subcontractorResponse, tradeTypeResponse] = await Promise.all([
        subcontractorAPI.getSubcontractors({ pageSize: 300 }),
        subcontractorAPI.getTradeTypes().catch(() => []),
      ]);

      setSubcontractors(subcontractorResponse.subcontractors);
      setTradeTypes(tradeTypeResponse);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load subcontractors'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredSubcontractors = useMemo(() => {
    return subcontractors.filter((subcontractor) => {
      if (activeTab !== 'all' && subcontractor.complianceStatus !== activeTab) return false;
      if (selectedTrade && !subcontractor.tradeType.includes(selectedTrade)) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const haystack = [
          subcontractor.name,
          subcontractor.businessName || '',
          subcontractor.email,
          subcontractor.phone,
          subcontractor.abn,
          ...(subcontractor.tradeType || []),
        ].join(' ').toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [activeTab, searchQuery, selectedTrade, subcontractors]);

  const stats = useMemo(() => {
    return {
      totalSubcontractors: subcontractors.length,
      compliant: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'compliant').length,
      pending: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'pending').length,
      nonCompliant: subcontractors.filter((subcontractor) => subcontractor.complianceStatus === 'non_compliant').length,
      expiringInsurance: subcontractors.filter((subcontractor) => subcontractor.insuranceDocuments.some((document) => document.status === 'expiring')).length,
      expiringLicenses: subcontractors.filter((subcontractor) => subcontractor.licenseDocuments.some((document) => document.status === 'expiring')).length,
    };
  }, [subcontractors]);

  const openCreate = () => {
    setSelectedSubcontractor(null);
    setSubcontractorJobs([]);
    setDraft(emptyDraft());
    setInsuranceDraft(emptyInsurance());
    setLicenseDraft(emptyLicense());
    setJobDraft(emptyJob());
    setShowModal(true);
  };

  const openSubcontractor = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor);
    setDraft({
      name: subcontractor.name,
      email: subcontractor.email,
      phone: subcontractor.phone,
      abn: subcontractor.abn,
      businessName: subcontractor.businessName || '',
      tradingName: subcontractor.tradingName || '',
      tradeType: (subcontractor.tradeType || []).join(', '),
      expertise: (subcontractor.expertise || []).join(', '),
      availabilityStatus: subcontractor.availabilityStatus,
      hourlyRate: subcontractor.hourlyRate ? String(subcontractor.hourlyRate) : '',
      dailyRate: subcontractor.dailyRate ? String(subcontractor.dailyRate) : '',
      callOutFee: subcontractor.callOutFee ? String(subcontractor.callOutFee) : '',
      typicalLeadTime: subcontractor.typicalLeadTime ? String(subcontractor.typicalLeadTime) : '',
      serviceArea: (subcontractor.serviceArea || []).join(', '),
      company: subcontractor.company || '',
    });
    setInsuranceDraft(emptyInsurance());
    setLicenseDraft(emptyLicense());
    setJobDraft(emptyJob());
    setShowModal(true);

    try {
      const jobs = await subcontractorAPI.getSubcontractorJobs(subcontractor.id);
      setSubcontractorJobs(jobs);
      setJobRatings(
        Object.fromEntries(
          jobs.map((job) => [job.jobId, {
            rating: job.rating ? String(job.rating) : '',
            review: job.review || '',
            wouldRecommend: job.wouldRecommend ?? true,
          }])
        )
      );
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load subcontractor jobs'));
      setSubcontractorJobs([]);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSubcontractor(null);
    setSubcontractorJobs([]);
  };

  const saveSubcontractor = async () => {
    try {
      setSaving(true);
      const payload = {
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        abn: draft.abn,
        businessName: draft.businessName || undefined,
        tradingName: draft.tradingName || undefined,
        tradeType: draft.tradeType.split(',').map((item) => item.trim()).filter(Boolean),
        expertise: draft.expertise.split(',').map((item) => item.trim()).filter(Boolean),
        availabilityStatus: draft.availabilityStatus,
        hourlyRate: draft.hourlyRate ? Number(draft.hourlyRate) : undefined,
        dailyRate: draft.dailyRate ? Number(draft.dailyRate) : undefined,
        callOutFee: draft.callOutFee ? Number(draft.callOutFee) : undefined,
        typicalLeadTime: draft.typicalLeadTime ? Number(draft.typicalLeadTime) : undefined,
        serviceArea: draft.serviceArea.split(',').map((item) => item.trim()).filter(Boolean),
        company: draft.company || undefined,
      };

      if (selectedSubcontractor) {
        await subcontractorAPI.updateSubcontractor(selectedSubcontractor.id, payload);
      } else {
        await subcontractorAPI.createSubcontractor(payload as Omit<Subcontractor, 'id' | 'createdAt' | 'updatedAt' | 'type'>);
      }

      await loadData();
      closeModal();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save subcontractor'));
    } finally {
      setSaving(false);
    }
  };

  const saveInsurance = async () => {
    if (!selectedSubcontractor) return;

    try {
      setSaving(true);
      await subcontractorAPI.addInsuranceDocument(selectedSubcontractor.id, {
        type: insuranceDraft.type,
        provider: insuranceDraft.provider,
        policyNumber: insuranceDraft.policyNumber,
        coverageAmount: Number(insuranceDraft.coverageAmount || 0),
        issueDate: new Date().toISOString().slice(0, 10),
        expiryDate: insuranceDraft.expiryDate,
        status: 'pending_verification',
      });
      const updated = await subcontractorAPI.getSubcontractor(selectedSubcontractor.id);
      setSelectedSubcontractor(updated);
      setSubcontractors((current) => current.map((item) => item.id === updated.id ? updated : item));
      setInsuranceDraft(emptyInsurance());
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to add insurance document'));
    } finally {
      setSaving(false);
    }
  };

  const saveLicense = async () => {
    if (!selectedSubcontractor) return;

    try {
      setSaving(true);
      await subcontractorAPI.addLicenseDocument(selectedSubcontractor.id, {
        type: licenseDraft.type,
        licenseNumber: licenseDraft.licenseNumber,
        issuingAuthority: licenseDraft.issuingAuthority,
        issueDate: new Date().toISOString().slice(0, 10),
        expiryDate: licenseDraft.expiryDate,
        status: 'pending_verification',
      });
      const updated = await subcontractorAPI.getSubcontractor(selectedSubcontractor.id);
      setSelectedSubcontractor(updated);
      setSubcontractors((current) => current.map((item) => item.id === updated.id ? updated : item));
      setLicenseDraft(emptyLicense());
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to add license'));
    } finally {
      setSaving(false);
    }
  };

  const assignJob = async () => {
    if (!selectedSubcontractor) return;

    try {
      setSaving(true);
      const created = await subcontractorAPI.assignJob({
        subcontractorId: selectedSubcontractor.id,
        jobId: jobDraft.jobId,
        jobTitle: jobDraft.jobTitle,
        scopeOfWork: jobDraft.scopeOfWork,
        hourlyRate: Number(jobDraft.hourlyRate || 0),
        totalValue: Number(jobDraft.totalValue || 0),
        status: jobDraft.status,
      } as Omit<SubcontractorJob, 'id' | 'createdAt' | 'updatedAt'>);
      setSubcontractorJobs((current) => [created, ...current]);
      setJobDraft(emptyJob());
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to assign job'));
    } finally {
      setSaving(false);
    }
  };

  const updateJobStatus = async (job: SubcontractorJob, status: SubcontractorJob['status']) => {
    if (!selectedSubcontractor) return;

    try {
      const updated = await subcontractorAPI.updateJobStatus(selectedSubcontractor.id, job.jobId, status);
      setSubcontractorJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to update job status'));
    }
  };

  const saveJobRating = async (job: SubcontractorJob) => {
    if (!selectedSubcontractor) return;

    const ratingDraft = jobRatings[job.jobId];
    if (!ratingDraft?.rating) return;

    try {
      const updated = await subcontractorAPI.rateSubcontractor(selectedSubcontractor.id, job.jobId, {
        rating: Number(ratingDraft.rating),
        review: ratingDraft.review || undefined,
        wouldRecommend: ratingDraft.wouldRecommend,
      });
      setSubcontractorJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
      const refreshed = await subcontractorAPI.getSubcontractor(selectedSubcontractor.id);
      setSelectedSubcontractor(refreshed);
      setSubcontractors((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save subcontractor rating'));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalSubcontractors}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Compliant</p>
          <p className="text-2xl font-bold text-green-600">{stats.compliant}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Non-Compliant</p>
          <p className="text-2xl font-bold text-red-600">{stats.nonCompliant}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Expiring</p>
          <p className="text-2xl font-bold text-orange-600">{stats.expiringInsurance + stats.expiringLicenses}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                {(['all', 'compliant', 'pending', 'non_compliant'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize ${activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select value={selectedTrade} onChange={(event) => setSelectedTrade(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">All Trades</option>
                {tradeTypes.map((tradeType) => <option key={tradeType} value={tradeType}>{tradeType}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search subcontractors..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <button onClick={() => void loadData()} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                <RotateCcw className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Add Subcontractor
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredSubcontractors.map((subcontractor) => (
            <button
              key={subcontractor.id}
              onClick={() => void openSubcontractor(subcontractor)}
              className="w-full text-left p-4 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{subcontractor.name}</h3>
                    <Badge variant={subcontractor.complianceStatus === 'compliant' ? 'green' : subcontractor.complianceStatus === 'pending' ? 'yellow' : 'red'}>
                      {subcontractor.complianceStatus.replace('_', ' ')}
                    </Badge>
                    <Badge variant="slate">{subcontractor.availabilityStatus}</Badge>
                    {subcontractor.rating && (
                      <span className="flex items-center gap-1 text-sm text-slate-600">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        {subcontractor.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {subcontractor.businessName || subcontractor.company || 'Independent'}</span>
                    <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {subcontractor.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {subcontractor.email}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {subcontractor.tradeType.map((tradeType) => (
                      <Badge key={tradeType} variant="blue">{tradeType}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{formatCurrency(subcontractor.hourlyRate)}</p>
                  <p className="text-sm text-slate-500">{subcontractor.completedJobs || 0}/{subcontractor.totalJobs || 0} jobs</p>
                </div>
              </div>
            </button>
          ))}

          {filteredSubcontractors.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3" />
              <p>No subcontractors match the current filters</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">{selectedSubcontractor ? selectedSubcontractor.name : 'New Subcontractor'}</h2>
                <p className="text-sm text-slate-500">
                  {selectedSubcontractor ? 'Manage details, compliance, and assigned jobs.' : 'Create a live subcontractor record.'}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Name</span>
                    <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Business Name</span>
                    <input value={draft.businessName} onChange={(event) => setDraft((current) => ({ ...current, businessName: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Email</span>
                    <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Phone</span>
                    <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">ABN</span>
                    <input value={draft.abn} onChange={(event) => setDraft((current) => ({ ...current, abn: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Availability</span>
                    <select value={draft.availabilityStatus} onChange={(event) => setDraft((current) => ({ ...current, availabilityStatus: event.target.value as Subcontractor['availabilityStatus'] }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                      <option value="available">Available</option>
                      <option value="limited">Limited</option>
                      <option value="busy">Busy</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="block text-slate-500 mb-1">Trade Types</span>
                    <input value={draft.tradeType} onChange={(event) => setDraft((current) => ({ ...current, tradeType: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Electrical, HVAC" />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="block text-slate-500 mb-1">Expertise</span>
                    <input value={draft.expertise} onChange={(event) => setDraft((current) => ({ ...current, expertise: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Switchboards, split systems" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Hourly Rate</span>
                    <input value={draft.hourlyRate} onChange={(event) => setDraft((current) => ({ ...current, hourlyRate: event.target.value }))} type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Daily Rate</span>
                    <input value={draft.dailyRate} onChange={(event) => setDraft((current) => ({ ...current, dailyRate: event.target.value }))} type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Call Out Fee</span>
                    <input value={draft.callOutFee} onChange={(event) => setDraft((current) => ({ ...current, callOutFee: event.target.value }))} type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm">
                    <span className="block text-slate-500 mb-1">Lead Time (days)</span>
                    <input value={draft.typicalLeadTime} onChange={(event) => setDraft((current) => ({ ...current, typicalLeadTime: event.target.value }))} type="number" min="0" step="1" className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="block text-slate-500 mb-1">Service Area</span>
                    <input value={draft.serviceArea} onChange={(event) => setDraft((current) => ({ ...current, serviceArea: event.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="5000, 5006, Hills District" />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                {selectedSubcontractor && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-slate-500" />
                          <h3 className="font-medium text-slate-800">Insurance</h3>
                        </div>
                        {selectedSubcontractor.insuranceDocuments.map((document) => (
                          <div key={document.id} className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm text-slate-700">{document.provider}</p>
                                <p className="text-xs text-slate-500">{document.policyNumber}</p>
                              </div>
                              <Badge variant={document.status === 'valid' ? 'green' : document.status === 'expiring' ? 'yellow' : document.status === 'pending_verification' ? 'blue' : 'red'}>
                                {document.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-1 gap-2">
                          <input value={insuranceDraft.provider} onChange={(event) => setInsuranceDraft((current) => ({ ...current, provider: event.target.value }))} placeholder="Provider" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input value={insuranceDraft.policyNumber} onChange={(event) => setInsuranceDraft((current) => ({ ...current, policyNumber: event.target.value }))} placeholder="Policy Number" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input value={insuranceDraft.coverageAmount} onChange={(event) => setInsuranceDraft((current) => ({ ...current, coverageAmount: event.target.value }))} type="number" placeholder="Coverage Amount" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input value={insuranceDraft.expiryDate} onChange={(event) => setInsuranceDraft((current) => ({ ...current, expiryDate: event.target.value }))} type="date" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <button onClick={saveInsurance} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Add Insurance</button>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="w-4 h-4 text-slate-500" />
                          <h3 className="font-medium text-slate-800">Licenses</h3>
                        </div>
                        {selectedSubcontractor.licenseDocuments.map((document) => (
                          <div key={document.id} className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm text-slate-700">{document.issuingAuthority}</p>
                                <p className="text-xs text-slate-500">{document.licenseNumber}</p>
                              </div>
                              <Badge variant={document.status === 'valid' ? 'green' : document.status === 'expiring' ? 'yellow' : document.status === 'pending_verification' ? 'blue' : 'red'}>
                                {document.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-1 gap-2">
                          <input value={licenseDraft.licenseNumber} onChange={(event) => setLicenseDraft((current) => ({ ...current, licenseNumber: event.target.value }))} placeholder="License Number" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input value={licenseDraft.issuingAuthority} onChange={(event) => setLicenseDraft((current) => ({ ...current, issuingAuthority: event.target.value }))} placeholder="Issuing Authority" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input value={licenseDraft.expiryDate} onChange={(event) => setLicenseDraft((current) => ({ ...current, expiryDate: event.target.value }))} type="date" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <button onClick={saveLicense} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Add License</button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-slate-500" />
                        <h3 className="font-medium text-slate-800">Assigned Jobs</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input value={jobDraft.jobId} onChange={(event) => setJobDraft((current) => ({ ...current, jobId: event.target.value }))} placeholder="Job ID" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        <input value={jobDraft.jobTitle} onChange={(event) => setJobDraft((current) => ({ ...current, jobTitle: event.target.value }))} placeholder="Job Title" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        <input value={jobDraft.scopeOfWork} onChange={(event) => setJobDraft((current) => ({ ...current, scopeOfWork: event.target.value }))} placeholder="Scope of Work" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        <input value={jobDraft.hourlyRate} onChange={(event) => setJobDraft((current) => ({ ...current, hourlyRate: event.target.value }))} type="number" placeholder="Hourly Rate" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        <input value={jobDraft.totalValue} onChange={(event) => setJobDraft((current) => ({ ...current, totalValue: event.target.value }))} type="number" placeholder="Total Value" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      </div>
                      <button onClick={assignJob} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Assign Job</button>

                      <div className="space-y-3">
                        {subcontractorJobs.map((job) => {
                          const ratingDraft = jobRatings[job.jobId] || { rating: '', review: '', wouldRecommend: true };
                          return (
                            <div key={job.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-800">{job.jobTitle}</p>
                                  <p className="text-sm text-slate-500">{job.scopeOfWork}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="slate">{job.status}</Badge>
                                  <span className="text-sm text-slate-600">{formatCurrency(job.totalValue)}</span>
                                  <select value={job.status} onChange={(event) => void updateJobStatus(job, event.target.value as SubcontractorJob['status'])} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option value="quoted">Quoted</option>
                                    <option value="approved">Approved</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="invoiced">Invoiced</option>
                                    <option value="paid">Paid</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <input value={ratingDraft.rating} onChange={(event) => setJobRatings((current) => ({ ...current, [job.jobId]: { ...ratingDraft, rating: event.target.value } }))} type="number" min="1" max="5" step="1" placeholder="Rating 1-5" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                <input value={ratingDraft.review} onChange={(event) => setJobRatings((current) => ({ ...current, [job.jobId]: { ...ratingDraft, review: event.target.value } }))} placeholder="Review" className="px-3 py-2 border border-slate-200 rounded-lg text-sm md:col-span-2" />
                                <button onClick={() => void saveJobRating(job)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                                  Save Rating
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {subcontractorJobs.length === 0 && (
                          <p className="text-sm text-slate-400">No jobs assigned yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {!selectedSubcontractor && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                    Create the subcontractor first, then reopen the record to add compliance documents and job assignments.
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-between gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
              <button
                onClick={saveSubcontractor}
                disabled={saving || !draft.name || !draft.email || !draft.phone || !draft.abn}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : selectedSubcontractor ? 'Save Changes' : 'Create Subcontractor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubcontractorManagementView;
