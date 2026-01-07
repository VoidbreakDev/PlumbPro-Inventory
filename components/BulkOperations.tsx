/**
 * Bulk Operations Component
 * Select multiple items and perform batch actions
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';

export interface BulkAction {
  id: string;
  label: string;
  icon?: string;
  action: (selectedIds: string[]) => Promise<void>;
  confirm?: {
    title: string;
    message: string;
  };
  variant?: 'default' | 'danger';
}

interface BulkOperationsProps<T> {
  items: T[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  actions: BulkAction[];
  getItemId: (item: T) => string;
  renderItem: (item: T, isSelected: boolean, onToggle: () => void) => ReactNode;
  emptyMessage?: string;
}

function BulkOperations<T>({
  items,
  selectedIds,
  onSelectionChange,
  actions,
  getItemId,
  renderItem,
  emptyMessage = 'No items to display'
}: BulkOperationsProps<T>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const setError = useStore((state) => state.setError);

  const allIds = items.map(getItemId);
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const handleToggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleAction = async (action: BulkAction) => {
    if (action.confirm) {
      setPendingAction(action);
      setShowConfirmDialog(true);
    } else {
      await executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction) => {
    setIsProcessing(true);
    setShowConfirmDialog(false);
    setPendingAction(null);

    try {
      await action.action(selectedIds);
      onSelectionChange([]); // Clear selection after action
    } catch (error) {
      setError(getErrorMessage(error, 'Bulk action failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allSelected]);

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => onSelectionChange([])}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {actions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  disabled={isProcessing}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${action.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {isProcessing ? 'Processing...' : action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Select All Header */}
      <div className="flex items-center space-x-3 mb-4 px-4 py-2 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          checked={allSelected}
          ref={input => {
            if (input) {
              input.indeterminate = someSelected;
            }
          }}
          onChange={handleSelectAll}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">
          {allSelected ? 'Deselect All' : 'Select All'} ({items.length} items)
        </span>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {items.map(item => {
          const id = getItemId(item);
          const isSelected = selectedIds.includes(id);

          return (
            <div
              key={id}
              className={`
                transition-all duration-150
                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
              `}
            >
              {renderItem(item, isSelected, () => handleToggleItem(id))}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingAction && (
        <ConfirmDialog
          title={pendingAction.confirm!.title}
          message={pendingAction.confirm!.message}
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          variant={pendingAction.variant || 'default'}
          onConfirm={() => executeAction(pendingAction)}
          onCancel={() => {
            setShowConfirmDialog(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

// Confirmation Dialog Component
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}) => {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`
                px-4 py-2 rounded-lg font-medium text-white
                ${variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Bulk Operation Checkbox (for use in row components)
interface BulkSelectCheckboxProps {
  isSelected: boolean;
  onToggle: () => void;
  className?: string;
}

export const BulkSelectCheckbox: React.FC<BulkSelectCheckboxProps> = ({
  isSelected,
  onToggle,
  className = ''
}) => {
  return (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={onToggle}
      onClick={(e) => e.stopPropagation()} // Prevent row click
      className={`w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${className}`}
    />
  );
};

// Example usage hook
export function useBulkSelection<T>(items: T[], getItemId: (item: T) => string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectAll = () => {
    setSelectedIds(items.map(getItemId));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  const selectedItems = items.filter(item => selectedIds.includes(getItemId(item)));

  return {
    selectedIds,
    setSelectedIds,
    selectAll,
    clearSelection,
    toggleItem,
    isSelected,
    selectedItems,
    hasSelection: selectedIds.length > 0,
    selectionCount: selectedIds.length
  };
}

export default BulkOperations;
