import React, { useState, useEffect } from 'react';
import { X, Star, TrendingUp, TrendingDown, Award, Clock, Package, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { ItemSupplier, SupplierComparison, ContractStatus } from '../types';
import { supplierAnalyticsAPI, itemSuppliersAPI } from '../lib/supplierAPI';
import { Badge } from './Shared';

interface SupplierComparisonModalProps {
  itemId: string;
  itemName: string;
  onClose: () => void;
  onSelectSupplier?: (supplier: ItemSupplier) => void;
}

export const SupplierComparisonModal: React.FC<SupplierComparisonModalProps> = ({
  itemId,
  itemName,
  onClose,
  onSelectSupplier
}) => {
  const [comparison, setComparison] = useState<SupplierComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComparison();
  }, [itemId]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supplierAnalyticsAPI.getComparison(itemId);
      setComparison(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load supplier comparison');
      console.error('Load comparison error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPreferred = async (supplierId: string) => {
    try {
      await itemSuppliersAPI.setPreferred(supplierId);
      await loadComparison(); // Reload to show updated preferred status
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set preferred supplier');
      console.error('Set preferred error:', err);
    }
  };

  const getContractStatusBadge = (status: ContractStatus) => {
    if (!status) return null;

    const badges: Record<string, { variant: 'green' | 'yellow' | 'red'; label: string }> = {
      active: { variant: 'green', label: 'Contract Active' },
      expiring_soon: { variant: 'yellow', label: 'Expiring Soon' },
      expired: { variant: 'red', label: 'Expired' }
    };

    const config = badges[status];
    if (!config) return null;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Supplier Comparison</h2>
            <p className="text-sm text-gray-600 mt-1">{itemName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && comparison && (
            <>
              {/* Summary Stats */}
              {comparison.suppliers.length > 1 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Suppliers</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">
                      {comparison.summary.totalSuppliers}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600">Lowest Price</p>
                    <p className="text-2xl font-semibold text-green-900 mt-1">
                      ${comparison.summary.lowestPrice}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600">Average Price</p>
                    <p className="text-2xl font-semibold text-blue-900 mt-1">
                      ${comparison.summary.avgPrice}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Price Range</p>
                    <p className="text-2xl font-semibold text-purple-900 mt-1">
                      ${comparison.summary.priceDifference}
                    </p>
                  </div>
                </div>
              )}

              {/* Supplier Cards */}
              {comparison.suppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No suppliers configured for this item</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Add suppliers to compare prices and performance
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comparison.suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className={`bg-white border-2 rounded-lg p-6 transition-all ${
                        supplier.isPreferred
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Supplier Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {supplier.supplierName}
                            </h3>
                            {supplier.isPreferred && (
                              <Badge variant="blue" className="flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                Preferred
                              </Badge>
                            )}
                            {supplier.priceRank === 1 && (
                              <Badge variant="green" className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                Lowest Price
                              </Badge>
                            )}
                          </div>
                          {supplier.supplierCompany && (
                            <p className="text-sm text-gray-600 mt-1">{supplier.supplierCompany}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Supplier Code: {supplier.supplierCode}
                          </p>
                        </div>

                        {!supplier.isPreferred && (
                          <button
                            onClick={() => handleSetPreferred(supplier.id)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Set as Preferred
                          </button>
                        )}
                      </div>

                      {/* Supplier Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {/* Price */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Price (Excl GST)</p>
                          <p className="text-xl font-semibold text-gray-900">
                            ${parseFloat(supplier.unitPriceExclGst.toString()).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Incl GST: ${parseFloat(supplier.unitPriceInclGst.toString()).toFixed(2)}
                          </p>
                        </div>

                        {/* Lead Time */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Lead Time
                          </p>
                          <p className="text-xl font-semibold text-gray-900">
                            {supplier.leadTimeDays} days
                          </p>
                        </div>

                        {/* Rating */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Supplier Rating</p>
                          {supplier.averageRating ? (
                            <>
                              {renderStars(Math.round(parseFloat(supplier.averageRating.toString())))}
                              <p className="text-xs text-gray-500 mt-1">
                                {parseFloat(supplier.averageRating.toString()).toFixed(1)} ({supplier.totalRatings} reviews)
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">No ratings yet</p>
                          )}
                        </div>

                        {/* Delivery Performance */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">On-Time Delivery</p>
                          {supplier.totalDeliveries && supplier.totalDeliveries > 0 ? (
                            <>
                              <p className="text-xl font-semibold text-gray-900">
                                {supplier.onTimePercentage}%
                              </p>
                              <p className="text-xs text-gray-500">
                                {supplier.totalDeliveries} deliveries
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">No history</p>
                          )}
                        </div>
                      </div>

                      {/* Contract Status & Order History */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          {supplier.hasContract && getContractStatusBadge(supplier.contractStatus)}
                          {supplier.timesOrdered > 0 && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Package className="w-4 h-4" />
                              <span>Ordered {supplier.timesOrdered} times</span>
                            </div>
                          )}
                          {supplier.lastOrderedDate && (
                            <span className="text-xs text-gray-500">
                              Last: {new Date(supplier.lastOrderedDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {onSelectSupplier && (
                          <button
                            onClick={() => onSelectSupplier(supplier)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Select Supplier
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
