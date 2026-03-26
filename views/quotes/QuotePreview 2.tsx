/**
 * QuotePreview
 * Modal for viewing quote details, history, and performing workflow actions
 * (send, approve, reject, duplicate, revise).
 */

import React, { useState } from 'react';
import {
  XCircle,
  Clock,
  Send,
  CheckCircle,
  RefreshCw,
  Copy,
  Briefcase
} from 'lucide-react';
import { quotesAPI } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { Quote, QuoteStatus } from '../../types';

export interface QuotePreviewProps {
  quote: Quote;
  onClose: () => void;
  onAction: () => void;
  setError: (error: string | null) => void;
}

export function QuotePreview({ quote, onClose, onAction, setError }: QuotePreviewProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: 'send' | 'approve' | 'reject' | 'duplicate' | 'revise') => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'send':
          await quotesAPI.send(quote.id);
          break;
        case 'approve':
          await quotesAPI.approve(quote.id);
          break;
        case 'reject':
          const reason = prompt('Rejection reason (optional):');
          await quotesAPI.reject(quote.id, reason || undefined);
          break;
        case 'duplicate':
          await quotesAPI.duplicate(quote.id);
          break;
        case 'revise':
          await quotesAPI.revise(quote.id);
          break;
      }
      onAction();
    } catch (error) {
      setError(getErrorMessage(error, `Failed to ${action} quote`));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    const badges: Record<QuoteStatus, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      viewed: { color: 'bg-purple-100 text-purple-800', label: 'Viewed' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      expired: { color: 'bg-yellow-100 text-yellow-800', label: 'Expired' },
      converted: { color: 'bg-teal-100 text-teal-800', label: 'Converted' }
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-900">{quote.quoteNumber}</h3>
                {getStatusBadge(quote.status)}
              </div>
              <p className="text-gray-600 mt-1">{quote.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Customer</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 text-gray-900">{quote.customerName}</span>
              </div>
              {quote.customerEmail && (
                <div>
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2 text-gray-900">{quote.customerEmail}</span>
                </div>
              )}
              {quote.customerPhone && (
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <span className="ml-2 text-gray-900">{quote.customerPhone}</span>
                </div>
              )}
              {quote.customerAddress && (
                <div className="col-span-2">
                  <span className="text-gray-500">Address:</span>
                  <span className="ml-2 text-gray-900">{quote.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job Link */}
          {quote.jobTitle && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Linked Job:</span>
              <span className="text-blue-600 font-medium">{quote.jobTitle}</span>
            </div>
          )}

          {/* Line Items */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Line Items</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{item.itemName}</div>
                        {item.itemDescription && (
                          <div className="text-xs text-gray-500">{item.itemDescription}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 capitalize">
                          {item.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="text-right space-y-2 min-w-[300px]">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(quote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST ({quote.taxRate}%):</span>
                  <span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Notes */}
          {(quote.terms || quote.customerNotes) && (
            <div className="grid grid-cols-2 gap-4">
              {quote.terms && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{quote.customerNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Validity */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Created: {new Date(quote.createdAt).toLocaleDateString()}</span>
            {quote.validUntil && (
              <span>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</span>
            )}
            {quote.sentAt && (
              <span>Sent: {new Date(quote.sentAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* History */}
          {quote.history && quote.history.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">History</h4>
              <div className="space-y-2">
                {quote.history.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 capitalize">{entry.action}</span>
                    {entry.userName && <span className="text-gray-600">by {entry.userName}</span>}
                    {entry.notes && <span className="text-gray-500">- {entry.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => handleAction('duplicate')}
              disabled={!!actionLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>

            {quote.status === 'draft' && (
              <button
                onClick={() => handleAction('send')}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'send' ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Quote
              </button>
            )}

            {(quote.status === 'sent' || quote.status === 'viewed') && (
              <>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'approve' ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'reject' ? <Clock className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
                <button
                  onClick={() => handleAction('revise')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Create Revision
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuotePreview;
