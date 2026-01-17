/**
 * Stock Returns View
 * Manage stock returns from jobs back to warehouse
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  TrendingDown,
  RotateCcw,
  FileText
} from 'lucide-react';
import stockReturnsAPI, { StockReturn, StockReturnStats, CreateStockReturnRequest, AllocatedItem } from '../lib/stockReturnsAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type { Job } from '../types';

export function StockReturnsView() {
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [stats, setStats] = useState<StockReturnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const setError = useStore((state) => state.setError);
  const jobs = useStore((state) => state.jobs);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [returnsData, statsData] = await Promise.all([
        stockReturnsAPI.getAll({ status: filterStatus as any }),
        stockReturnsAPI.getStats()
      ]);

      setReturns(returnsData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load stock returns'));
      setReturns([]);
      setStats({
        total_returns: 0,
        pending_returns: 0,
        confirmed_returns: 0,
        total_items_used: 0,
        total_items_returned: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReturn = async (returnId: string) => {
    try {
      const returnData = await stockReturnsAPI.getById(returnId);
      setSelectedReturn(returnData);
      setShowDetailModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load stock return details'));
    }
  };

  const handleConfirmReturn = async (returnId: string) => {
    if (!confirm('Confirm this stock return? Items will be added back to inventory.')) return;

    try {
      await stockReturnsAPI.confirm(returnId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to confirm stock return'));
    }
  };

  const handleCancelReturn = async (returnId: string) => {
    if (!confirm('Cancel this stock return?')) return;

    try {
      await stockReturnsAPI.cancel(returnId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to cancel stock return'));
    }
  };

  const handleDeleteReturn = async (returnId: string) => {
    if (!confirm('Delete this stock return? This cannot be undone.')) return;

    try {
      await stockReturnsAPI.delete(returnId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete stock return'));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      confirmed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get picked jobs for creating new returns
  const pickedJobs = jobs.filter(job => job.isPicked && job.status !== 'Completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading stock returns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Returns</h1>
          <p className="text-gray-600 mt-1">Track stock returned from job sites</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={pickedJobs.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={pickedJobs.length === 0 ? 'No picked jobs available' : 'Create stock return'}
        >
          <Plus className="w-5 h-5" />
          Create Return
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-600 text-sm">Total Returns</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.total_returns}
                </div>
              </div>
              <RotateCcw className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-yellow-50 p-6 rounded-lg shadow border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-yellow-600 text-sm">Pending</div>
                <div className="text-3xl font-bold text-yellow-900 mt-2">
                  {stats.pending_returns}
                </div>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm">Confirmed</div>
                <div className="text-3xl font-bold text-green-900 mt-2">
                  {stats.confirmed_returns}
                </div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm">Items Returned</div>
                <div className="text-3xl font-bold text-blue-900 mt-2">
                  {stats.total_items_returned}
                </div>
              </div>
              <Package className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg shadow border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-600 text-sm">Items Used</div>
                <div className="text-3xl font-bold text-purple-900 mt-2">
                  {stats.total_items_used}
                </div>
              </div>
              <TrendingDown className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <button
            onClick={() => setFilterStatus(undefined)}
            className={`px-3 py-1 rounded ${
              filterStatus === undefined ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'confirmed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Confirmed
          </button>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Returned
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <RotateCcw className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No stock returns found</p>
                  {pickedJobs.length > 0 && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Create your first stock return
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              returns.map((stockReturn) => {
                const totalReturned = stockReturn.items?.reduce((sum, item) => sum + item.quantity_returned, 0) || 0;
                const totalUsed = stockReturn.items?.reduce((sum, item) => sum + item.quantity_used, 0) || 0;

                return (
                  <tr key={stockReturn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{stockReturn.job_title}</div>
                          {stockReturn.job_builder && (
                            <div className="text-xs text-gray-500">{stockReturn.job_builder}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(stockReturn.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{stockReturn.items?.length || 0} items</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-900">{totalReturned}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-purple-900">{totalUsed}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDate(stockReturn.returned_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewReturn(stockReturn.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {stockReturn.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmReturn(stockReturn.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Confirm return"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteReturn(stockReturn.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {stockReturn.status === 'confirmed' && (
                          <span className="text-xs text-gray-500 italic">Confirmed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Return Modal */}
      {showCreateModal && (
        <CreateStockReturnModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
          pickedJobs={pickedJobs}
          setError={setError}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReturn && (
        <StockReturnDetailModal
          stockReturn={selectedReturn}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReturn(null);
          }}
          onConfirm={() => {
            handleConfirmReturn(selectedReturn.id);
            setShowDetailModal(false);
            setSelectedReturn(null);
          }}
        />
      )}
    </div>
  );
}

// Create Stock Return Modal Component
interface CreateStockReturnModalProps {
  onClose: () => void;
  onSuccess: () => void;
  pickedJobs: Job[];
  setError: (error: string | null) => void;
}

function CreateStockReturnModal({ onClose, onSuccess, pickedJobs, setError }: CreateStockReturnModalProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [allocatedItems, setAllocatedItems] = useState<AllocatedItem[]>([]);
  const [returnItems, setReturnItems] = useState<Map<string, { returned: number; condition: string; notes: string }>>(new Map());
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadJobAllocation = async (jobId: string) => {
    setLoadingJob(true);
    try {
      const data = await stockReturnsAPI.getJobAllocation(jobId);
      setAllocatedItems(data.allocated_items);

      // Initialize return items with remaining quantities
      const initialReturns = new Map();
      data.allocated_items.forEach(item => {
        initialReturns.set(item.item_id, {
          returned: item.quantity_remaining,
          condition: 'good',
          notes: ''
        });
      });
      setReturnItems(initialReturns);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load job allocation'));
    } finally {
      setLoadingJob(false);
    }
  };

  const updateReturnItem = (itemId: string, field: 'returned' | 'condition' | 'notes', value: any) => {
    const updated = new Map(returnItems);
    const current = updated.get(itemId) || { returned: 0, condition: 'good', notes: '' };
    updated.set(itemId, { ...current, [field]: value });
    setReturnItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const items = allocatedItems
        .map(item => {
          const returnData = returnItems.get(item.item_id);
          if (!returnData || returnData.returned <= 0) return null;

          return {
            inventory_item_id: item.item_id,
            quantity_allocated: item.quantity_allocated,
            quantity_returned: returnData.returned,
            condition: returnData.condition as 'good' | 'damaged' | 'lost',
            notes: returnData.notes || undefined
          };
        })
        .filter(item => item !== null) as CreateStockReturnRequest['items'];

      if (items.length === 0) {
        setError('Please enter return quantities for at least one item');
        setSaving(false);
        return;
      }

      await stockReturnsAPI.create({
        job_id: selectedJobId,
        items,
        notes: notes || undefined
      });

      onSuccess();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create stock return'));
      setSaving(false);
    }
  };

  const getTotalReturned = () => {
    let total = 0;
    returnItems.forEach(item => {
      total += item.returned || 0;
    });
    return total;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Create Stock Return</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Job Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Job *
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  if (e.target.value) {
                    loadJobAllocation(e.target.value);
                  } else {
                    setAllocatedItems([]);
                    setReturnItems(new Map());
                  }
                }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a picked job...</option>
                {pickedJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} {job.builder && `- ${job.builder}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Return Items */}
            {loadingJob ? (
              <div className="text-center py-8 text-gray-500">
                Loading allocated items...
              </div>
            ) : allocatedItems.length > 0 ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Return Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Allocated</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prev. Returned</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Returning</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Condition</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allocatedItems.map(item => {
                        const returnData = returnItems.get(item.item_id) || { returned: 0, condition: 'good', notes: '' };

                        return (
                          <tr key={item.item_id}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity_allocated}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.quantity_previously_returned}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={returnData.returned}
                                onChange={(e) => updateReturnItem(item.item_id, 'returned', parseFloat(e.target.value) || 0)}
                                min="0"
                                max={item.quantity_remaining}
                                step="1"
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={returnData.condition}
                                onChange={(e) => updateReturnItem(item.item_id, 'condition', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="good">Good</option>
                                <option value="damaged">Damaged</option>
                                <option value="lost">Lost</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={returnData.notes}
                                onChange={(e) => updateReturnItem(item.item_id, 'notes', e.target.value)}
                                placeholder="Optional notes..."
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900">Total Items Returning:</span>
                    <span className="text-lg font-bold text-blue-900">{getTotalReturned()}</span>
                  </div>
                </div>
              </div>
            ) : selectedJobId ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No allocated items found for this job</p>
              </div>
            ) : null}

            {/* Notes */}
            {allocatedItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any general notes about this stock return..."
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || allocatedItems.length === 0 || getTotalReturned() === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Return
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Stock Return Detail Modal Component
interface StockReturnDetailModalProps {
  stockReturn: StockReturn;
  onClose: () => void;
  onConfirm?: () => void;
}

function StockReturnDetailModal({ stockReturn, onClose, onConfirm }: StockReturnDetailModalProps) {
  const totalReturned = stockReturn.items?.reduce((sum, item) => sum + item.quantity_returned, 0) || 0;
  const totalUsed = stockReturn.items?.reduce((sum, item) => sum + item.quantity_used, 0) || 0;

  const getConditionBadge = (condition: string) => {
    const badges = {
      good: 'bg-green-100 text-green-800',
      damaged: 'bg-orange-100 text-orange-800',
      lost: 'bg-red-100 text-red-800'
    };
    return badges[condition as keyof typeof badges] || badges.good;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Stock Return Details</h3>
            <p className="text-sm text-gray-600">Job: {stockReturn.job_title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status & Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="mt-1">
                {stockReturn.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-4 h-4" />
                    PENDING
                  </span>
                )}
                {stockReturn.status === 'confirmed' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    CONFIRMED
                  </span>
                )}
                {stockReturn.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <XCircle className="w-4 h-4" />
                    CANCELLED
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Returned Date</div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {new Date(stockReturn.returned_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Items</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Allocated</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Returned</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Used</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockReturn.items?.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity_allocated}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-900 text-center">{item.quantity_returned}</td>
                      <td className="px-4 py-3 text-sm font-medium text-purple-900 text-center">{item.quantity_used}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getConditionBadge(item.condition)}`}>
                          {item.condition.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-600">Total Returned</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{totalReturned}</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm text-purple-600">Total Used</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">{totalUsed}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {stockReturn.notes && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                {stockReturn.notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
          {stockReturn.status === 'pending' && onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Return
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StockReturnsView;
