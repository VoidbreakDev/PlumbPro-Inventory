/**
 * RoleEditor
 * Renders the "Roles" tab content: system role templates, custom roles,
 * and user-role assignment table.
 *
 * Also exports the three modals that belong to this domain:
 *   - CreateRoleModal
 *   - CreateWorkflowModal
 *   - RoleDetailsModal
 */

import React, { useState } from 'react';
import { Shield, Crown, Eye, Edit2, Trash2, X } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';
import {
  permissionsAPI,
  RoleTemplate,
  CustomRole,
  UserWithRole,
} from '../../lib/permissionsAPI';
import { roleLabels, roleLevelColors } from './sharedTeamConstants';

// ---------------------------------------------------------------------------
// RoleEditor (roles tab content)
// ---------------------------------------------------------------------------

interface RoleEditorProps {
  roleTemplates: RoleTemplate[];
  customRoles: CustomRole[];
  usersWithRoles: UserWithRole[];
  canManageMembers: boolean;
  onSetSelectedRole: (role: RoleTemplate | CustomRole) => void;
  onDeleteCustomRole: (roleId: string) => void;
  onAssignRole: (userId: string, roleId: string, roleType: 'template' | 'custom') => void;
  onShowCreateRoleModal: () => void;
}

export function RoleEditor({
  roleTemplates,
  customRoles,
  usersWithRoles,
  canManageMembers,
  onSetSelectedRole,
  onDeleteCustomRole,
  onAssignRole,
  onShowCreateRoleModal,
}: RoleEditorProps) {
  return (
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
                  onClick={() => onSetSelectedRole(role)}
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
                    onClick={() => onSetSelectedRole(role)}
                    className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                    title="View/Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteCustomRole(role.id)}
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
              onClick={onShowCreateRoleModal}
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
                        if (id) onAssignRole(user.id, id, type as 'template' | 'custom');
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
  );
}

// ---------------------------------------------------------------------------
// CreateRoleModal
// ---------------------------------------------------------------------------

interface CreateRoleModalProps {
  roleTemplates: RoleTemplate[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function CreateRoleModal({
  roleTemplates,
  onClose,
  onSuccess,
  onError,
}: CreateRoleModalProps) {
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

// ---------------------------------------------------------------------------
// CreateWorkflowModal
// ---------------------------------------------------------------------------

interface CreateWorkflowModalProps {
  roleTemplates: RoleTemplate[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function CreateWorkflowModal({
  roleTemplates,
  onClose,
  onSuccess,
  onError,
}: CreateWorkflowModalProps) {
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

// ---------------------------------------------------------------------------
// RoleDetailsModal
// ---------------------------------------------------------------------------

interface RoleDetailsModalProps {
  role: RoleTemplate | CustomRole;
  onClose: () => void;
}

export function RoleDetailsModal({ role, onClose }: RoleDetailsModalProps) {
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
