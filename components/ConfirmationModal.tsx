import React from 'react';
import { X } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isProcessing?: boolean;
  processingLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'danger',
  isProcessing = false,
  processingLabel,
  onConfirm,
  onClose
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  const confirmButtonClasses = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300'
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300';

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="confirmation-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <div className="mt-1 text-sm text-gray-600">{description}</div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Close ${title}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-3 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmButtonClasses}`}
          >
            {isProcessing ? processingLabel || confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
