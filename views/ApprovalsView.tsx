/**
 * Approvals View
 * Manage approval workflows for jobs, purchase orders, and stock adjustments
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  Ban
} from 'lucide-react';
import approvalsAPI, { ApprovalWorkflow, ApprovalStats } from '../lib/approvalsAPI';

export function ApprovalsView() {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState<ApprovalWorkflow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalWorkflow[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalWorkflow | null>(null);
  const [activeTab, setActiveTab] = useState<'my_approvals' | 'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [actionComments, setActionComments] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [approvalsData, pendingData, statsData] = await Promise.all([
        approvalsAPI.getApprovals({ status: filterStatus }),
        approvalsAPI.getPendingApprovals(),
        approvalsAPI.getStats()
      ]);

      setApprovals(approvalsData);
      setPendingApprovals(pendingData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load approval data:', error);
      // Set empty data on error instead of crashing
      setApprovals([]);
      setPendingApprovals([]);
      setStats({
        total_approvals: 0,
        pending_approvals: 0,
        approved_approvals: 0,
        rejected_approvals: 0,
        pending_my_approvals: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: ApprovalWorkflow) => {
    setSelectedApproval(approval);
    setActionType('approve');
    setActionComments('');
    setShowActionModal(true);
  };

  const handleReject = async (approval: ApprovalWorkflow) => {
    setSelectedApproval(approval);
    setActionType('reject');
    setActionComments('');
    setShowActionModal(true);
  };

  const submitAction = async () => {
    if (!selectedApproval || !actionType) return;

    try {
      if (actionType === 'approve') {
        await approvalsAPI.approve(selectedApproval.id, actionComments || undefined);
      } else {
        if (!actionComments.trim()) {
          alert(t('approvals.comments') + ' required for rejection');
          return;
        }
        await approvalsAPI.reject(selectedApproval.id, actionComments);
      }

      setShowActionModal(false);
      setSelectedApproval(null);
      setActionComments('');
      loadData();
    } catch (error) {
      console.error('Failed to process approval:', error);
      alert('Failed to process approval');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this approval workflow?')) return;

    try {
      await approvalsAPI.cancel(id);
      loadData();
    } catch (error) {
      console.error('Failed to cancel approval:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: Ban }
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {t(`approvals.status.${status}`)}
      </span>
    );
  };

  const getEntityTypeLabel = (type: string) => {
    return t(`approvals.entityTypes.${type}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('approvals.title')}</h1>
          <p className="text-gray-600 mt-1">Manage and track approval workflows</p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm">{t('approvals.title')}</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {stats.total_approvals}
            </div>
          </div>

          <div className="bg-yellow-50 p-6 rounded-lg shadow border border-yellow-200">
            <div className="text-yellow-600 text-sm">{t('approvals.status.pending')}</div>
            <div className="text-3xl font-bold text-yellow-900 mt-2">
              {stats.pending_approvals}
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
            <div className="text-blue-600 text-sm">My Action Required</div>
            <div className="text-3xl font-bold text-blue-900 mt-2">
              {stats.pending_my_approvals}
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-lg shadow border border-green-200">
            <div className="text-green-600 text-sm">{t('approvals.status.approved')}</div>
            <div className="text-3xl font-bold text-green-900 mt-2">
              {stats.approved_approvals}
            </div>
          </div>

          <div className="bg-red-50 p-6 rounded-lg shadow border border-red-200">
            <div className="text-red-600 text-sm">{t('approvals.status.rejected')}</div>
            <div className="text-3xl font-bold text-red-900 mt-2">
              {stats.rejected_approvals}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('approvals.pendingApprovals')} ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab('my_approvals')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'my_approvals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Requests ({approvals.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('approvals.approvalHistory')}
          </button>
        </nav>
      </div>

      {/* Pending Approvals (where I'm an approver) */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No pending approvals requiring your action</p>
            </div>
          ) : (
            pendingApprovals.map(approval => (
              <div key={approval.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getEntityTypeLabel(approval.entity_type)}
                      </h3>
                      {getStatusBadge(approval.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{t('approvals.requestedBy')}: {approval.requested_by_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(approval.requested_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>{t('approvals.stage')} {approval.current_stage} of {approval.total_stages}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(approval)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('approvals.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(approval)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      {t('approvals.reject')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Approval Requests */}
      {activeTab === 'my_approvals' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus(undefined)}
              className={`px-3 py-1 rounded ${
                filterStatus === undefined ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('common.all')}
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded ${
                filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('approvals.status.pending')}
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1 rounded ${
                filterStatus === 'approved' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('approvals.status.approved')}
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 py-1 rounded ${
                filterStatus === 'rejected' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('approvals.status.rejected')}
            </button>
          </div>

          {/* Approvals List */}
          <div className="grid grid-cols-1 gap-4">
            {approvals.map(approval => (
              <div key={approval.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getEntityTypeLabel(approval.entity_type)}
                      </h3>
                      {getStatusBadge(approval.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Requested: {new Date(approval.requested_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>Progress: {approval.current_stage} / {approval.total_stages} {t('approvals.stages')}</span>
                      </div>
                      {approval.completed_at && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completed: {new Date(approval.completed_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {approval.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(approval.id)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {approvals.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No approval requests found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            View complete approval history with detailed stages and comments
          </p>
        </div>
      )}

      {/* Action Modal (Approve/Reject) */}
      {showActionModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {actionType === 'approve' ? t('approvals.approve') : t('approvals.reject')} {getEntityTypeLabel(selectedApproval.entity_type)}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('approvals.comments')} {actionType === 'reject' && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder={actionType === 'reject' ? 'Please provide a reason for rejection...' : 'Optional comments...'}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={submitAction}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    actionType === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {t('common.confirm')}
                </button>
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedApproval(null);
                    setActionComments('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalsView;
