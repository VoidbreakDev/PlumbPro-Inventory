/**
 * Team Management View
 * Manage team members, roles, permissions, and approval workflows
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Settings,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Crown,
  Clock,
  ChevronDown,
  Copy,
  ExternalLink,
  Key,
  FileCheck,
  History,
  Plus,
  Edit2,
  Eye,
  Lock,
  Unlock,
  Check,
  AlertTriangle
} from 'lucide-react';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import {
  permissionsAPI,
  RoleTemplate,
  CustomRole,
  UserWithRole,
  ApprovalWorkflow,
  PendingApproval,
  AuditLogEntry
} from '../lib/permissionsAPI';

interface TeamMember {
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

const roleLabels: Record<string, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Full access to all features and settings'
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-800',
    description: 'Full access except billing and team settings'
  },
  manager: {
    label: 'Manager',
    color: 'bg-blue-100 text-blue-800',
    description: 'Can manage jobs, quotes, invoices and team members'
  },
  member: {
    label: 'Member',
    color: 'bg-green-100 text-green-800',
    description: 'Can create and edit jobs, quotes, and inventory'
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-800',
    description: 'Read-only access to all data'
  }
};

// Role level colors
const roleLevelColors: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',      // Apprentice
  1: 'bg-green-100 text-green-700',    // Technician
  2: 'bg-blue-100 text-blue-700',      // Senior Tech
  3: 'bg-purple-100 text-purple-700',  // Supervisor
  4: 'bg-orange-100 text-orange-700',  // Manager
  5: 'bg-yellow-100 text-yellow-700',  // Owner
};

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

  const handleDeleteCustomRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this custom role?')) return;
    try {
      await permissionsAPI.deleteCustomRole(roleId);
      setSuccess('Role deleted successfully');
      loadRolesData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete role'));
    }
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

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }

    try {
      await api.delete(`/team/members/${memberId}`);
      setSuccess('Member removed successfully');
      loadTeamData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove member'));
    }
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

      {/* Team Info */}
      {teamData?.team && activeTab === 'members' && (
        <>
          {/* Team Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Team Members</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {teamData.members.length}
                <span className="text-lg font-normal text-gray-500">
                  {' '}/ {teamData.team.maxUsers}
                </span>
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-6 h-6 text-purple-500" />
                <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{invitations.length}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6 text-green-500" />
                <h3 className="font-semibold text-gray-900">Your Role</h3>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                roleLabels[teamData.user.role]?.color || 'bg-gray-100 text-gray-800'
              }`}>
                {teamData.user.role === 'owner' && <Crown className="w-4 h-4 mr-1" />}
                {roleLabels[teamData.user.role]?.label || teamData.user.role}
              </span>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {teamData.members.map((member) => (
                    <tr key={member.id} className={member.isCurrentUser ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-lg font-medium text-gray-600">
                              {member.fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900">
                              {member.fullName}
                              {member.isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600">(You)</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => {
                              if (canManageMembers && member.role !== 'owner' && !member.isCurrentUser) {
                                setShowRoleDropdown(showRoleDropdown === member.id ? null : member.id);
                              }
                            }}
                            disabled={!canManageMembers || member.role === 'owner' || member.isCurrentUser}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                              roleLabels[member.role]?.color || 'bg-gray-100 text-gray-800'
                            } ${
                              canManageMembers && member.role !== 'owner' && !member.isCurrentUser
                                ? 'cursor-pointer hover:opacity-80'
                                : ''
                            }`}
                          >
                            {member.role === 'owner' && <Crown className="w-3 h-3" />}
                            {roleLabels[member.role]?.label || member.role}
                            {canManageMembers && member.role !== 'owner' && !member.isCurrentUser && (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {showRoleDropdown === member.id && (
                            <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              {Object.entries(roleLabels)
                                .filter(([key]) => key !== 'owner')
                                .map(([key, value]) => (
                                  <button
                                    key={key}
                                    onClick={() => handleUpdateRole(member.id, key)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                                      key === member.role ? 'bg-blue-50' : ''
                                    }`}
                                  >
                                    <p className="font-medium">{value.label}</p>
                                    <p className="text-xs text-gray-500">{value.description}</p>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {member.lastActiveAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(member.lastActiveAt).toLocaleDateString()}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canManageMembers && member.role !== 'owner' && !member.isCurrentUser && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.fullName)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{invitation.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          roleLabels[invitation.role]?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {roleLabels[invitation.role]?.label || invitation.role}
                        </span>
                        <span>Invited by {invitation.invitedBy}</span>
                        <span>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Cancel invitation"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Roles Tab */}
      {teamData?.team && activeTab === 'roles' && (
        <div className="space-y-6">
          {/* System Role Templates */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Role Templates</h2>
              <p className="text-sm text-gray-500 mt-1">Pre-configured role templates with standard permissions</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {roleTemplates.map((role) => (
                <div
                  key={role.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleLevelColors[role.level] || 'bg-gray-100 text-gray-700'}`}>
                        Level {role.level}
                      </span>
                      {role.level === 5 && <Crown className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <button
                      onClick={() => setSelectedRole(role)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="View permissions"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900">{role.displayName}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{role.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    {role.quoteApprovalThreshold && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">
                        Quotes: ${Number(role.quoteApprovalThreshold).toLocaleString()}
                      </span>
                    )}
                    {role.poApprovalThreshold && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                        PO: ${Number(role.poApprovalThreshold).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Roles */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Custom Roles</h2>
                <p className="text-sm text-gray-500 mt-1">Create custom roles tailored to your business needs</p>
              </div>
            </div>
            {customRoles.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {customRoles.map((role) => (
                  <div key={role.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{role.displayName}</h3>
                        {role.baseTemplateName && (
                          <span className="text-xs text-gray-500">
                            (based on {role.baseTemplateName})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{role.userCount} users assigned</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRole(role)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                        title="View/Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomRole(role.id)}
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
                <Shield className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No custom roles created yet</p>
                <button
                  onClick={() => setShowCreateRoleModal(true)}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Create your first custom role
                </button>
              </div>
            )}
          </div>

          {/* User Role Assignments */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">User Role Assignments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usersWithRoles.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.roleDisplayName ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.roleDisplayName || 'No role assigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleLevelColors[user.roleLevel] || 'bg-gray-100'}`}>
                          {user.roleLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.assignedAt ? new Date(user.assignedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select
                          value={user.roleId || ''}
                          onChange={(e) => {
                            const [type, id] = e.target.value.split(':');
                            if (id) handleAssignRole(user.id, id, type as 'template' | 'custom');
                          }}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select role...</option>
                          <optgroup label="Templates">
                            {roleTemplates.map((r) => (
                              <option key={r.id} value={`template:${r.id}`}>{r.displayName}</option>
                            ))}
                          </optgroup>
                          {customRoles.length > 0 && (
                            <optgroup label="Custom">
                              {customRoles.map((r) => (
                                <option key={r.id} value={`custom:${r.id}`}>{r.displayName}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
    </div>
  );
}

// Invite Modal Component
function InviteModal({
  onClose,
  onSuccess,
  onError
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/team/invite', { email, role, message: message || undefined });
      onSuccess();
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to send invitation'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="colleague@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="admin">Admin - Full access except billing</option>
              <option value="manager">Manager - Manage jobs and team</option>
              <option value="member">Member - Create and edit content</option>
              <option value="viewer">Viewer - Read-only access</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add a personal message to the invitation..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Team Modal Component
function CreateTeamModal({
  onClose,
  onSuccess,
  onError
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/team', { name });
      onSuccess();
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create team'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Your Team</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Plumbing Company"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Team Plan Features</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>Up to 5 team members</li>
              <li>Role-based permissions</li>
              <li>Team collaboration on jobs</li>
              <li>Shared inventory and contacts</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Custom Role Modal
function CreateRoleModal({
  roleTemplates,
  onClose,
  onSuccess,
  onError
}: {
  roleTemplates: RoleTemplate[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [baseTemplateId, setBaseTemplateId] = useState('');
  const [quoteThreshold, setQuoteThreshold] = useState('');
  const [poThreshold, setPoThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await permissionsAPI.createCustomRole({
        name: name.toLowerCase().replace(/\s+/g, '_'),
        displayName,
        description: description || undefined,
        baseTemplateId: baseTemplateId || undefined,
        permissions: {},
        quoteApprovalThreshold: quoteThreshold ? parseFloat(quoteThreshold) : undefined,
        poApprovalThreshold: poThreshold ? parseFloat(poThreshold) : undefined,
      });
      onSuccess();
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create custom role'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Custom Role</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Senior Technician"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                placeholder="senior_technician"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Role description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Template (optional)</label>
            <select
              value={baseTemplateId}
              onChange={(e) => setBaseTemplateId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Start from scratch</option>
              {roleTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.displayName} (Level {template.level})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Inherit permissions from an existing template</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote Approval Limit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={quoteThreshold}
                  onChange={(e) => setQuoteThreshold(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Approval Limit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={poThreshold}
                  onChange={(e) => setPoThreshold(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Workflow Modal
function CreateWorkflowModal({
  roleTemplates,
  onClose,
  onSuccess,
  onError
}: {
  roleTemplates: RoleTemplate[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<'quote' | 'purchase_order' | 'invoice'>('quote');
  const [thresholdMin, setThresholdMin] = useState('');
  const [thresholdMax, setThresholdMax] = useState('');
  const [requiredLevel, setRequiredLevel] = useState('3');
  const [requireMultiple, setRequireMultiple] = useState(false);
  const [minApprovers, setMinApprovers] = useState('2');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await permissionsAPI.createWorkflow({
        name,
        description: description || undefined,
        entityType,
        thresholdMin: thresholdMin ? parseFloat(thresholdMin) : undefined,
        thresholdMax: thresholdMax ? parseFloat(thresholdMax) : undefined,
        requiredRoleLevel: parseInt(requiredLevel),
        requireMultipleApprovers: requireMultiple,
        minApprovers: requireMultiple ? parseInt(minApprovers) : undefined,
      });
      onSuccess();
    } catch (err) {
      onError(getErrorMessage(err, 'Failed to create workflow'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Approval Workflow</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Large Quote Approval"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="When this workflow should trigger..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="quote">Quotes</option>
              <option value="purchase_order">Purchase Orders</option>
              <option value="invoice">Invoices</option>
              <option value="stock_adjustment">Stock Adjustments</option>
              <option value="expense">Expenses</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={thresholdMin}
                  onChange={(e) => setThresholdMin(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={thresholdMax}
                  onChange={(e) => setThresholdMax(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Role Level</label>
            <select
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1">Level 1+ (Technician)</option>
              <option value="2">Level 2+ (Senior Tech)</option>
              <option value="3">Level 3+ (Supervisor)</option>
              <option value="4">Level 4+ (Manager)</option>
              <option value="5">Level 5 (Owner only)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireMultiple}
                onChange={(e) => setRequireMultiple(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Require multiple approvers</span>
            </label>
            {requireMultiple && (
              <div className="ml-7">
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Approvers</label>
                <input
                  type="number"
                  value={minApprovers}
                  onChange={(e) => setMinApprovers(e.target.value)}
                  min="2"
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Role Details Modal
function RoleDetailsModal({
  role,
  onClose
}: {
  role: RoleTemplate | CustomRole;
  onClose: () => void;
}) {
  const permissions = role.permissions;

  const renderPermissionGroup = (groupName: string, perms: Record<string, boolean>) => (
    <div key={groupName} className="border border-gray-200 rounded-lg p-3">
      <h4 className="font-medium text-gray-900 capitalize mb-2">{groupName}</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(perms).map(([key, value]) => (
          <span
            key={key}
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {value ? '✓' : '✗'} {key.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{role.displayName}</h2>
              <p className="text-sm text-gray-500 mt-1">{role.description}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {'level' in role && (
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <span className="text-sm text-gray-500">Level:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleLevelColors[role.level] || 'bg-gray-100'}`}>
                  Level {role.level}
                </span>
                {role.quoteApprovalThreshold && (
                  <>
                    <span className="text-sm text-gray-500">Quote Limit:</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${Number(role.quoteApprovalThreshold).toLocaleString()}
                    </span>
                  </>
                )}
                {role.poApprovalThreshold && (
                  <>
                    <span className="text-sm text-gray-500">PO Limit:</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${Number(role.poApprovalThreshold).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            )}

            <h3 className="font-semibold text-gray-900">Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(permissions).map(([groupName, perms]) =>
                typeof perms === 'object' && perms !== null
                  ? renderPermissionGroup(groupName, perms as Record<string, boolean>)
                  : null
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
