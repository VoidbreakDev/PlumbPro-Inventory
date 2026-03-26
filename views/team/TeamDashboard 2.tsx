/**
 * TeamDashboard
 * Stats overview (member count, pending invitations, current user role) plus
 * the full members table and the pending-invitations list.
 */

import React from 'react';
import { Users, Mail, Shield, Crown, X } from 'lucide-react';
import { roleLabels } from './sharedTeamConstants';
import { TeamMemberCard, TeamMember } from './TeamMemberCard';

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

interface TeamDashboardProps {
  teamInfo: TeamInfo;
  members: TeamMember[];
  currentUserRole: string;
  invitations: Invitation[];
  canManageMembers: boolean;
  showRoleDropdown: string | null;
  onToggleRoleDropdown: (memberId: string | null) => void;
  onUpdateRole: (memberId: string, newRole: string) => void;
  onRemoveMember: (memberId: string, memberName: string) => void;
  onCancelInvitation: (invitationId: string) => void;
}

export function TeamDashboard({
  teamInfo,
  members,
  currentUserRole,
  invitations,
  canManageMembers,
  showRoleDropdown,
  onToggleRoleDropdown,
  onUpdateRole,
  onRemoveMember,
  onCancelInvitation,
}: TeamDashboardProps) {
  return (
    <>
      {/* Team Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-blue-500" />
            <h3 className="font-semibold text-gray-900">Team Members</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {members.length}
            <span className="text-lg font-normal text-gray-500">
              {' '}/ {teamInfo.maxUsers}
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
            roleLabels[currentUserRole]?.color || 'bg-gray-100 text-gray-800'
          }`}>
            {currentUserRole === 'owner' && <Crown className="w-4 h-4 mr-1" />}
            {roleLabels[currentUserRole]?.label || currentUserRole}
          </span>
        </div>
      </div>

      {/* Team Members Table */}
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
              {members.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  canManageMembers={canManageMembers}
                  showRoleDropdown={showRoleDropdown}
                  onToggleRoleDropdown={onToggleRoleDropdown}
                  onUpdateRole={onUpdateRole}
                  onRemoveMember={onRemoveMember}
                />
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
                  onClick={() => onCancelInvitation(invitation.id)}
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
  );
}
