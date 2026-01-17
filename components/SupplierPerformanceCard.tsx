import React, { useState, useEffect } from 'react';
import { Star, Package, Clock, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { SupplierPerformance } from '../types';
import { supplierAnalyticsAPI } from '../lib/supplierAPI';
import { Badge } from './Shared';

interface SupplierPerformanceCardProps {
  supplierId: string;
  onViewDetails?: () => void;
}

export const SupplierPerformanceCard: React.FC<SupplierPerformanceCardProps> = ({
  supplierId,
  onViewDetails
}) => {
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPerformance();
  }, [supplierId]);

  const loadPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supplierAnalyticsAPI.getPerformance(supplierId);
      setPerformance(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load performance data');
      console.error('Load performance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getReliabilityBadge = (percentage: number | null) => {
    if (percentage === null) return <Badge variant="gray">No Data</Badge>;
    if (percentage >= 90) return <Badge variant="green">Excellent</Badge>;
    if (percentage >= 75) return <Badge variant="blue">Good</Badge>;
    if (percentage >= 60) return <Badge variant="yellow">Fair</Badge>;
    return <Badge variant="red">Poor</Badge>;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading performance data</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!performance) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {performance.supplier.name}
            </h3>
            {performance.supplier.company && (
              <p className="text-sm text-gray-600 mt-0.5">{performance.supplier.company}</p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-2 mt-2">
              {renderStars(parseFloat(performance.supplier.averageRating.toString()))}
              <span className="text-sm text-gray-600">
                {parseFloat(performance.supplier.averageRating.toString()).toFixed(1)}
                ({performance.supplier.totalRatings} {performance.supplier.totalRatings === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </div>

          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              View Details
            </button>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="p-6 space-y-6">
        {/* Orders Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Purchase Orders</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {performance.performance.orders.totalOrders}
              </p>
              <p className="text-sm text-gray-600">Total Orders</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                ${parseFloat(performance.performance.orders.totalSpent.toString()).toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Total Spent</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {performance.performance.orders.completedOrders}
              </p>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                ${parseFloat(performance.performance.orders.avgOrderValue.toString()).toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">Avg Value</p>
            </div>
          </div>
        </div>

        {/* Delivery Performance */}
        {performance.performance.delivery.totalDeliveries > 0 && (
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-900">Delivery Performance</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">On-Time Delivery Rate</span>
                {performance.performance.delivery.reliabilityPercentage !== null ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {performance.performance.delivery.reliabilityPercentage}%
                    </span>
                    {getReliabilityBadge(
                      parseFloat(performance.performance.delivery.reliabilityPercentage.toString())
                    )}
                  </div>
                ) : (
                  <Badge variant="gray">No Data</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-lg font-semibold text-green-600">
                    {performance.performance.delivery.onTimeDeliveries}
                  </p>
                  <p className="text-xs text-green-700">On Time</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-lg font-semibold text-red-600">
                    {performance.performance.delivery.lateDeliveries}
                  </p>
                  <p className="text-xs text-red-700">Late</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-lg font-semibold text-blue-600">
                    {performance.performance.delivery.earlyDeliveries}
                  </p>
                  <p className="text-xs text-blue-700">Early</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Items & Pricing */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Items & Pricing</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-lg font-medium text-gray-900">
                {performance.performance.items.totalItems}
              </p>
              <p className="text-xs text-gray-600">Items Supplied</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {performance.performance.items.preferredItems}
              </p>
              <p className="text-xs text-gray-600">Preferred Items</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                ${parseFloat(performance.performance.items.avgPrice.toString()).toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">Avg Price</p>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {parseFloat(performance.performance.items.avgLeadTime.toString()).toFixed(0)} days
              </p>
              <p className="text-xs text-gray-600">Avg Lead Time</p>
            </div>
          </div>
        </div>

        {/* Price Changes */}
        {performance.performance.pricing.totalPriceChanges > 0 && (
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">Price Changes</h4>
              </div>
              <span className="text-sm text-gray-600">
                {performance.performance.pricing.totalPriceChanges} changes
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                <span className="text-sm text-red-700">Increases</span>
                <span className="font-semibold text-red-600">
                  {performance.performance.pricing.priceIncreases}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <span className="text-sm text-green-700">Decreases</span>
                <span className="font-semibold text-green-600">
                  {performance.performance.pricing.priceDecreases}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>{performance.supplier.email}</span>
          <span>{performance.supplier.phone}</span>
        </div>
      </div>
    </div>
  );
};
