import React, { useState } from 'react';
import {
  Star,
  Phone,
  Mail,
  Package,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Contact, ItemSupplier } from '../types';
import { Badge } from './Shared';

interface MobileSupplierCardProps {
  supplier: Contact;
  itemSuppliers?: ItemSupplier[];
  onRate?: () => void;
  onViewPerformance?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
}

export const MobileSupplierCard: React.FC<MobileSupplierCardProps> = ({
  supplier,
  itemSuppliers = [],
  onRate,
  onViewPerformance,
  onCall,
  onEmail
}) => {
  const [expanded, setExpanded] = useState(false);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const averagePrice = itemSuppliers.length > 0
    ? itemSuppliers.reduce((sum, is) => sum + parseFloat(is.unitPriceExclGst.toString()), 0) / itemSuppliers.length
    : 0;

  const preferredItems = itemSuppliers.filter(is => is.isPreferred).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header - Always Visible */}
      <div
        className="p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{supplier.name}</h3>
            {supplier.company && (
              <p className="text-sm text-gray-600 truncate mt-0.5">{supplier.company}</p>
            )}

            {/* Rating */}
            {supplier.averageRating && supplier.averageRating > 0 ? (
              <div className="flex items-center gap-2 mt-2">
                {renderStars(parseFloat(supplier.averageRating.toString()))}
                <span className="text-sm text-gray-600">
                  {parseFloat(supplier.averageRating.toString()).toFixed(1)}
                  <span className="text-gray-400 ml-1">
                    ({supplier.totalRatings})
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">No ratings yet</p>
            )}
          </div>

          {/* Expand Icon */}
          <button className="ml-3 p-1 text-gray-400">
            {expanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Quick Stats - Always Visible */}
        {itemSuppliers.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center p-2 bg-blue-50 rounded">
              <p className="text-lg font-semibold text-blue-600">{itemSuppliers.length}</p>
              <p className="text-xs text-blue-700">Items</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <p className="text-lg font-semibold text-green-600">{preferredItems}</p>
              <p className="text-xs text-green-700">Preferred</p>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded">
              <p className="text-lg font-semibold text-purple-600">
                ${averagePrice.toFixed(0)}
              </p>
              <p className="text-xs text-purple-700">Avg Price</p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <>
          {/* Contact Info */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="space-y-2">
              {supplier.email && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEmail) onEmail();
                    else window.location.href = `mailto:${supplier.email}`;
                  }}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors w-full"
                >
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{supplier.email}</span>
                </button>
              )}
              {supplier.phone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCall) onCall();
                    else window.location.href = `tel:${supplier.phone}`;
                  }}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors w-full"
                >
                  <Phone className="w-4 h-4" />
                  <span>{supplier.phone}</span>
                </button>
              )}
            </div>
          </div>

          {/* Items List */}
          {itemSuppliers.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Supplied Items ({itemSuppliers.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {itemSuppliers.slice(0, 5).map((is) => (
                  <div
                    key={is.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {/* We'd need the item name here - could be passed or fetched */}
                        Item: {is.supplierCode}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {is.leadTimeDays}d
                        </span>
                        {is.isPreferred && (
                          <Badge variant="blue" className="text-xs">
                            <Award className="w-2 h-2 mr-1" />
                            Preferred
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-semibold text-gray-900">
                        ${parseFloat(is.unitPriceExclGst.toString()).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Excl GST</p>
                    </div>
                  </div>
                ))}
                {itemSuppliers.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    + {itemSuppliers.length - 5} more items
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
            {onRate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRate();
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Star className="w-4 h-4" />
                Rate
              </button>
            )}
            {onViewPerformance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewPerformance();
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <TrendingUp className="w-4 h-4" />
                Performance
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Mobile List View
interface MobileSupplierListProps {
  suppliers: Contact[];
  itemSuppliersMap?: Map<string, ItemSupplier[]>;
  onRateSupplier?: (supplier: Contact) => void;
  onViewPerformance?: (supplier: Contact) => void;
  searchQuery?: string;
}

export const MobileSupplierList: React.FC<MobileSupplierListProps> = ({
  suppliers,
  itemSuppliersMap = new Map(),
  onRateSupplier,
  onViewPerformance,
  searchQuery = ''
}) => {
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredSuppliers.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No suppliers found</p>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-1">
            Try adjusting your search
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {filteredSuppliers.map(supplier => (
        <MobileSupplierCard
          key={supplier.id}
          supplier={supplier}
          itemSuppliers={itemSuppliersMap.get(supplier.id) || []}
          onRate={onRateSupplier ? () => onRateSupplier(supplier) : undefined}
          onViewPerformance={onViewPerformance ? () => onViewPerformance(supplier) : undefined}
        />
      ))}
    </div>
  );
};
