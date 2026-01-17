import React, { useState, useMemo } from 'react';
import { X, ArrowRight, MapPin, Package, AlertCircle } from 'lucide-react';
import { InventoryItem, Location } from '../types';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  locations: Location[];
  onTransfer: (itemId: string, fromLocationId: string, toLocationId: string, quantity: number, reason: string) => Promise<void>;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  inventory,
  locations,
  onTransfer
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [fromLocationId, setFromLocationId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedItem = useMemo(
    () => inventory.find(item => item.id === selectedItemId),
    [inventory, selectedItemId]
  );

  const availableStock = useMemo(() => {
    if (!selectedItem || !fromLocationId) return 0;
    const locationStock = selectedItem.locationStock?.find(ls => ls.locationId === fromLocationId);
    return locationStock?.quantity || 0;
  }, [selectedItem, fromLocationId]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.supplierCode.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  const availableToLocations = useMemo(() => {
    return locations.filter(loc => loc.id !== fromLocationId);
  }, [locations, fromLocationId]);

  const handleSubmit = async () => {
    if (!selectedItemId || !fromLocationId || !toLocationId || quantity <= 0) {
      return;
    }

    if (quantity > availableStock) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onTransfer(selectedItemId, fromLocationId, toLocationId, quantity, reason);
      handleReset();
      onClose();
    } catch (error) {
      console.error('Transfer failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedItemId('');
    setFromLocationId('');
    setToLocationId('');
    setQuantity(1);
    setReason('');
    setSearchTerm('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  const isValid = selectedItemId && fromLocationId && toLocationId && quantity > 0 && quantity <= availableStock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Stock Transfer</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Select Item
            </label>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 mb-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setFromLocationId('');
                setToLocationId('');
                setQuantity(1);
              }}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-700"
            >
              <option value="">-- Select an item --</option>
              {filteredInventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.category} (Total: {item.quantity})
                </option>
              ))}
            </select>
          </div>

          {/* Location Stock Breakdown */}
          {selectedItem && selectedItem.locationStock && selectedItem.locationStock.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">Stock by Location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedItem.locationStock.map((loc) => (
                  <div key={loc.locationId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{loc.locationName}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{loc.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* From Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1 text-red-500" />
              From Location (Source)
            </label>
            <select
              value={fromLocationId}
              onChange={(e) => {
                setFromLocationId(e.target.value);
                setToLocationId('');
                setQuantity(1);
              }}
              disabled={!selectedItemId}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Select source location --</option>
              {selectedItem?.locationStock?.map(ls => (
                <option key={ls.locationId} value={ls.locationId}>
                  {ls.locationName} (Available: {ls.quantity})
                </option>
              ))}
            </select>
          </div>

          {/* To Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1 text-green-500" />
              To Location (Destination)
            </label>
            <select
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              disabled={!fromLocationId}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Select destination location --</option>
              {availableToLocations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Quantity to Transfer
            </label>
            {fromLocationId && (
              <p className="text-xs text-slate-500 mb-2">
                Available at source: <span className="font-bold text-slate-700">{availableStock}</span>
              </p>
            )}
            <input
              type="number"
              min="1"
              max={availableStock}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(availableStock, parseInt(e.target.value) || 1)))}
              disabled={!fromLocationId}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            {quantity > availableStock && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Quantity exceeds available stock at source location</span>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Restocking, Job requirement, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700"
            />
          </div>

          {/* Transfer Summary */}
          {selectedItem && fromLocationId && toLocationId && quantity > 0 && quantity <= availableStock && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-3">Transfer Summary</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white rounded-lg px-3 py-2 border border-green-200">
                    <p className="text-xs text-slate-500">From</p>
                    <p className="font-bold text-slate-800">
                      {selectedItem.locationStock?.find(ls => ls.locationId === fromLocationId)?.locationName}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-green-600" />
                  <div className="bg-white rounded-lg px-3 py-2 border border-green-200">
                    <p className="text-xs text-slate-500">To</p>
                    <p className="font-bold text-slate-800">
                      {locations.find(l => l.id === toLocationId)?.name}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg px-4 py-2 border border-green-200">
                  <p className="text-xs text-slate-500">Quantity</p>
                  <p className="text-xl font-bold text-green-600">{quantity}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer Stock'}
          </button>
        </div>
      </div>
    </div>
  );
};
