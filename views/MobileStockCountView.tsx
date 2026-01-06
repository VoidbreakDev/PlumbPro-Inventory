import React, { useState } from 'react';
import { Package, Search, Plus, Minus, Check, X, Camera, Barcode, ArrowLeft } from 'lucide-react';
import { InventoryItem } from '../types';
import { Badge, getStockStatus } from '../components/Shared';

interface MobileStockCountViewProps {
  inventory: InventoryItem[];
  onUpdateStock: (itemId: string, newQuantity: number) => void;
  onClose: () => void;
}

export const MobileStockCountView: React.FC<MobileStockCountViewProps> = ({
  inventory,
  onUpdateStock,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [countValue, setCountValue] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase()) ||
    item.supplierCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleQuickAdjust = (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    onUpdateStock(item.id, newQty);
  };

  const handleSetCount = () => {
    if (selectedItem && countValue) {
      const newQty = parseInt(countValue);
      if (!isNaN(newQty) && newQty >= 0) {
        onUpdateStock(selectedItem.id, newQty);
        setSelectedItem(null);
        setCountValue('');
      }
    }
  };

  // Item detail modal for counting
  if (selectedItem) {
    return (
      <div className="fixed inset-0 bg-slate-900 dark:bg-black z-50 flex flex-col">
        <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 safe-area-top">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSelectedItem(null)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold">Update Count</h2>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-4 shadow-lg">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {selectedItem.name}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-1">{selectedItem.category}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mb-4">
              Code: {selectedItem.supplierCode}
            </p>

            <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Current Stock</p>
                <p className="text-4xl font-black text-slate-800 dark:text-slate-100">
                  {selectedItem.quantity}
                </p>
              </div>
              <Badge variant={getStockStatus(selectedItem.quantity, selectedItem.reorderLevel).variant}>
                {getStockStatus(selectedItem.quantity, selectedItem.reorderLevel).label}
              </Badge>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                New Count
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={countValue}
                onChange={(e) => setCountValue(e.target.value)}
                className="w-full text-4xl font-bold text-center py-4 px-6 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500 focus:outline-none"
                placeholder="0"
                autoFocus
              />
            </div>

            {/* Quick adjustment buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[-10, -5, -1, +1, +5, +10].map(delta => (
                <button
                  key={delta}
                  onClick={() => setCountValue(String(Math.max(0, (parseInt(countValue) || selectedItem.quantity) + delta)))}
                  className={`py-3 px-4 font-bold rounded-xl shadow-sm transition-all active:scale-95 ${
                    delta < 0
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  }`}
                >
                  {delta > 0 ? '+' : ''}{delta}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-700 safe-area-bottom">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setSelectedItem(null); setCountValue(''); }}
              className="py-4 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              onClick={handleSetCount}
              disabled={!countValue}
              className="py-4 px-6 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              Update Count
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-40 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 shadow-lg safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Stock Count</h1>
          <button onClick={() => setShowScanner(true)} className="p-2 -mr-2">
            <Barcode className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
          <input
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-blue-700 dark:bg-blue-800 text-white placeholder-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-white"
            placeholder="Search items..."
          />
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">
              {search ? 'No items found' : 'No inventory items'}
            </p>
          </div>
        ) : (
          filteredInventory.map(item => {
            const status = getStockStatus(item.quantity, item.reorderLevel);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-98 transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                      {item.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.category}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">
                      {item.supplierCode}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleQuickAdjust(item, -1)}
                      className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg active:scale-90 transition-transform"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-[60px]">
                      <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {item.quantity}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">in stock</p>
                    </div>
                    <button
                      onClick={() => handleQuickAdjust(item, 1)}
                      className="w-10 h-10 flex items-center justify-center bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-lg active:scale-90 transition-transform"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setCountValue(String(item.quantity));
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg active:scale-95 transition-transform"
                  >
                    Set Count
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Scanner placeholder */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-20 h-20 text-white mx-auto mb-4" />
            <p className="text-white mb-6">Barcode scanner coming soon</p>
            <button
              onClick={() => setShowScanner(false)}
              className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
