/**
 * TeamMemberCard
 * Table row (<tr>) displaying a single team member with role dropdown and remove action.
 */

import React from 'react';
import { Crown, Clock, ChevronDown, Trash2 } from 'lucide-react';
import { roleLabels } from './sharedTeamConstants';

export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  lastActiveAt?: string;
  createdAt: string;
  isCurrentUser: boolean;
}

interface TeamMemberCardProps {
  member: TeamMember;
  canManageMembers: boolean;
  showRoleDropdown: string | null;
  onToggleRoleDropdown: (memberId: string | null) => void;
  onUpdateRole: (memberId: string, newRole: string) => void;
  onRemoveMember: (memberId: string, memberName: string) => void;
}

export function TeamMemberCard({
  member,
  canManageMembers,
  showRoleDropdown,
  onToggleRoleDropdown,
  onUpdateRole,
  onRemoveMember,
}: TeamMemberCardProps) {
  const canEdit = canManageMembers && member.role !== 'owner' && !member.isCurrentUser;

  return (
    <tr className={member.isCurrentUser ? 'bg-blue-50' : ''}>
      {/* Member info */}
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

      {/* Role badge / dropdown */}
      <td className="px-6 py-4">
        <div className="relative">
          <button
            onClick={() => {
              if (canEdit) {
                onToggleRoleDropdown(showRoleDropdown === member.id ? null : member.id);
              }
            }}
            disabled={!canEdit}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              roleLabels[member.role]?.color || 'bg-gray-100 text-gray-800'
            } ${canEdit ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {member.role === 'owner' && <Crown className="w-3 h-3" />}
            {roleLabels[member.role]?.label || member.role}
            {canEdit && <ChevronDown className="w-3 h-3" />}
          </button>

          {showRoleDropdown === member.id && (
            <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              {Object.entries(roleLabels)
                .filter(([key]) => key !== 'owner')
                .map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateRole(member.id, key)}
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

      {/* Last active */}
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

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        {canEdit && (
          <button
            onClick={() => onRemoveMember(member.id, member.fullName)}
            className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
