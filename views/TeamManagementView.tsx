/**
 * Team Management View
 * Manage team members, roles, permissions, and approval workflows.
 *
 * Sub-components live in views/team/:
 *   TeamDashboard   — stats + member table + pending invitations
 *   TeamMemberCard  — individual member row (used inside TeamDashboard)
 *   InviteModal     — invite a new member; CreateTeamModal — create first team
 *   RoleEditor      — roles tab content
 *   CreateRoleModal, CreateWorkflowModal, RoleDetailsModal — role-domain modals
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  FileCheck,
  History,
  Plus,
  Check,
  Key,
  Lock,
  Unlock,
  Trash2
} from 'lucide-react';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  permissionsAPI,
  RoleTemplate,
  CustomRole,
  UserWithRole,
  ApprovalWorkflow,
  PendingApproval,
  AuditLogEntry
} from '../lib/permissionsAPI';

// Sub-components
import { TeamDashboard } from './team/TeamDashboard';
import { InviteModal, CreateTeamModal } from './team/InviteModal';
import { RoleEditor, CreateRoleModal, CreateWorkflowModal, RoleDetailsModal } from './team/RoleEditor';

// Re-export the TeamMember type for use in sub-components
export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  lastActiveAt?: string;
  createdAt: string;
  isCurrentUser: boolean;
}

interface TeamInfo {
  id: string;
  name: string;
  subscriptionTier: string;
  maxUsers: number;
  isOwner: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamData {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  team: TeamInfo | null;
  members: TeamMember[];
}

type ActiveTab = 'members' | 'roles' | 'approvals' | 'workflows' | 'audit';

export function TeamManagementView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);

  // Advanced permissions state
  const [activeTab, setActiveTab] = useState<ActiveTab>('members');
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRole[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showCreateWorkflowModal, setShowCreateWorkflowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleTemplate | CustomRole | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const user = useStore((state) => state.user);

  useEffect(() => {
    loadTeamData();
  }, []);

  useEffect(() => {
    if (activeTab === 'roles') {
      loadRolesData();
    } else if (activeTab === 'approvals') {
      loadApprovalsData();
    } else if (activeTab === 'workflows') {
      loadWorkflowsData();
    } else if (activeTab === 'audit') {
      loadAuditLog();
    }
  }, [activeTab]);

  const loadTeamData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [teamResponse, invitationsResponse, usersResponse] = await Promise.all([
        api.get('/team'),
        api.get('/team/invitations').catch(() => ({ data: [] })),
        permissionsAPI.getUsersWithRoles().catch(() => ({ users: [] }))
      ]);

      setTeamData(teamResponse.data);
      setInvitations(invitationsResponse.data || []);
      setUsersWithRoles(usersResponse.users);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load team data'));
    } finally {
      setLoading(false);
    }
  };

  const loadRolesData = async () => {
    try {
      const [templatesRes, customRes] = await Promise.all([
        permissionsAPI.getRoleTemplates(),
        permissionsAPI.getCustomRoles()
      ]);
      setRoleTemplates(templatesRes.roles);
      setCustomRoles(customRes.roles);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load roles'));
    }
  };

  const loadApprovalsData = async () => {
    try {
      const { approvals } = await permissionsAPI.getPendingApprovals();
      setPendingApprovals(approvals);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load pending approvals'));
    }
  };

  const loadWorkflowsData = async () => {
    try {
      const { workflows: wf } = await permissionsAPI.getWorkflows();
      setWorkflows(wf);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load workflows'));
    }
  };

  const loadAuditLog = async () => {
    try {
      const { entries } = await permissionsAPI.getAuditLog({ limit: 50 });
      setAuditLog(entries);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load audit log'));
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      await permissionsAPI.approveItem(approvalId);
      setSuccess('Item approved successfully');
      loadApprovalsData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve item'));
    }
  };

  const handleReject = async (approvalId: string) => {
    const comments = prompt('Enter rejection reason (optional):');
    try {
      await permissionsAPI.rejectItem(approvalId, comments || undefined);
      setSuccess('Item rejected');
      loadApprovalsData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reject item'));
    }
  };

  const handleAssignRole = async (userId: string, roleId: string, roleType: 'template' | 'custom') => {
    try {
      await permissionsAPI.assignRoleToUser(userId, roleId, roleType);
      setSuccess('Role assigned successfully');
      loadTeamData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to assign role'));
    }
  };

  const handleDeleteCustomRole = (roleId: string) => {
    setConfirmModal({
      title: 'Delete Custom Role',
      description: 'Are you sure you want to delete this custom role?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await permissionsAPI.deleteCustomRole(roleId);
          setSuccess('Role deleted successfully');
          loadRolesData();
        } catch (err) {
          setError(getErrorMessage(err, 'Failed to delete role'));
        }
      }
    });
  };

  const handleToggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      await permissionsAPI.updateWorkflow(workflowId, { isActive: !isActive });
      setSuccess(`Workflow ${!isActive ? 'enabled' : 'disabled'}`);
      loadWorkflowsData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update workflow'));
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await api.put(`/team/members/${memberId}/role`, { role: newRole });
      setSuccess('Role updated successfully');
      setShowRoleDropdown(null);
      loadTeamData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update role'));
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setConfirmModal({
      title: 'Remove Team Member',
      description: `Are you sure you want to remove ${memberName} from the team?`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/team/members/${memberId}`);
          setSuccess('Member removed successfully');
          loadTeamData();
        } catch (err) {
          setError(getErrorMessage(err, 'Failed to remove member'));
        }
      }
    });
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/team/invitations/${invitationId}`);
      setSuccess('Invitation cancelled');
      loadTeamData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel invitation'));
    }
  };

  const canManageMembers = teamData?.user.role === 'owner' || teamData?.user.role === 'admin';

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading team data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-700">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
          <p className="text-slate-600 mt-1">
            {teamData?.team
              ? `Manage your team members, roles, and permissions`
              : `Upgrade to a team plan to add team members`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'members') loadTeamData();
              else if (activeTab === 'roles') loadRolesData();
              else if (activeTab === 'approvals') loadApprovalsData();
              else if (activeTab === 'workflows') loadWorkflowsData();
              else if (activeTab === 'audit') loadAuditLog();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {activeTab === 'members' && teamData?.team && canManageMembers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          )}
          {activeTab === 'roles' && canManageMembers && (
            <button
              onClick={() => setShowCreateRoleModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Custom Role
            </button>
          )}
          {activeTab === 'workflows' && canManageMembers && (
            <button
              onClick={() => setShowCreateWorkflowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {teamData?.team && (
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { id: 'members', label: 'Members', icon: Users },
            { id: 'roles', label: 'Roles', icon: Shield },
            { id: 'approvals', label: 'Approvals', icon: FileCheck },
            { id: 'workflows', label: 'Workflows', icon: Settings },
            { id: 'audit', label: 'Audit Log', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'approvals' && pendingApprovals.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Team Yet */}
      {!teamData?.team && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">You're on the Solo Plan</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Upgrade to a Team plan to invite team members and collaborate on jobs, quotes, and inventory.
          </p>
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Users className="w-5 h-5" />
            Create a Team
          </button>
        </div>
      )}

      {/* Members Tab */}
      {teamData?.team && activeTab === 'members' && (
        <TeamDashboard
          teamInfo={teamData.team}
          members={teamData.members}
          currentUserRole={teamData.user.role}
          invitations={invitations}
          canManageMembers={!!canManageMembers}
          showRoleDropdown={showRoleDropdown}
          onToggleRoleDropdown={setShowRoleDropdown}
          onUpdateRole={handleUpdateRole}
          onRemoveMember={handleRemoveMember}
          onCancelInvitation={handleCancelInvitation}
        />
      )}

      {/* Roles Tab */}
      {teamData?.team && activeTab === 'roles' && (
        <RoleEditor
          roleTemplates={roleTemplates}
          customRoles={customRoles}
          usersWithRoles={usersWithRoles}
          canManageMembers={!!canManageMembers}
          onSetSelectedRole={setSelectedRole}
          onDeleteCustomRole={handleDeleteCustomRole}
          onAssignRole={handleAssignRole}
          onShowCreateRoleModal={() => setShowCreateRoleModal(true)}
        />
      )}

      {/* Approvals Tab */}
      {teamData?.team && activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
              <p className="text-sm text-gray-500 mt-1">Items waiting for your approval</p>
            </div>
            {pendingApprovals.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                            {approval.entityType.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium text-gray-900">{approval.entityReference || approval.entityId}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Requested by <span className="font-medium">{approval.requestedByName}</span>
                          {approval.amount && (
                            <span className="ml-2 text-gray-500">• ${Number(approval.amount).toLocaleString()}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(approval.requestedAt).toLocaleString()}
                          {approval.expiresAt && (
                            <span className="ml-2 text-orange-600">
                              Expires: {new Date(approval.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                        {approval.notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">"{approval.notes}"</p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-gray-500">
                            {approval.approvalCount} / {approval.requiredApprovals} approvals
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(approval.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No pending approvals</p>
                <p className="text-sm text-gray-400 mt-1">Items requiring approval will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workflows Tab */}
      {teamData?.team && activeTab === 'workflows' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Approval Workflows</h2>
              <p className="text-sm text-gray-500 mt-1">Configure when approvals are required</p>
            </div>
            {workflows.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="capitalize">{workflow.entityType.replace(/_/g, ' ')}</span>
                        {workflow.thresholdMin !== null && (
                          <span>Min: ${Number(workflow.thresholdMin).toLocaleString()}</span>
                        )}
                        {workflow.thresholdMax !== null && (
                          <span>Max: ${Number(workflow.thresholdMax).toLocaleString()}</span>
                        )}
                        <span>Requires Level {workflow.requiredRoleLevel}+</span>
                        {workflow.requireMultipleApprovers && (
                          <span>{workflow.minApprovers}+ approvers</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleWorkflow(workflow.id, workflow.isActive)}
                        className={`p-2 rounded-lg transition-colors ${
                          workflow.isActive
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={workflow.isActive ? 'Disable workflow' : 'Enable workflow'}
                      >
                        {workflow.isActive ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => permissionsAPI.deleteWorkflow(workflow.id).then(loadWorkflowsData)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Settings className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No approval workflows configured</p>
                <button
                  onClick={() => setShowCreateWorkflowModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Create your first workflow
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {teamData?.team && activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Permission Audit Log</h2>
              <p className="text-sm text-gray-500 mt-1">Track all permission and role changes</p>
            </div>
            {auditLog.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        entry.action.includes('assign') ? 'bg-blue-100' :
                        entry.action.includes('create') ? 'bg-green-100' :
                        entry.action.includes('delete') ? 'bg-red-100' :
                        entry.action.includes('approve') ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        <Key className={`w-4 h-4 ${
                          entry.action.includes('assign') ? 'text-blue-600' :
                          entry.action.includes('create') ? 'text-green-600' :
                          entry.action.includes('delete') ? 'text-red-600' :
                          entry.action.includes('approve') ? 'text-purple-600' :
                          'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{entry.userName}</span>
                          {' '}
                          <span className="text-gray-600">{entry.action.replace(/_/g, ' ')}</span>
                          {entry.targetUserName && (
                            <>
                              {' for '}
                              <span className="font-medium">{entry.targetUserName}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(entry.createdAt).toLocaleString()}
                          {entry.ipAddress && <span className="ml-2">• {entry.ipAddress}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No audit log entries yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            setSuccess('Invitation sent successfully');
            loadTeamData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <CreateTeamModal
          onClose={() => setShowCreateTeamModal(false)}
          onSuccess={() => {
            setShowCreateTeamModal(false);
            setSuccess('Team created successfully');
            loadTeamData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <CreateRoleModal
          roleTemplates={roleTemplates}
          onClose={() => setShowCreateRoleModal(false)}
          onSuccess={() => {
            setShowCreateRoleModal(false);
            setSuccess('Custom role created successfully');
            loadRolesData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Create Workflow Modal */}
      {showCreateWorkflowModal && (
        <CreateWorkflowModal
          roleTemplates={roleTemplates}
          onClose={() => setShowCreateWorkflowModal(false)}
          onSuccess={() => {
            setShowCreateWorkflowModal(false);
            setSuccess('Workflow created successfully');
            loadWorkflowsData();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Role Details Modal */}
      {selectedRole && (
        <RoleDetailsModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={() => confirmModal?.onConfirm()}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
}
