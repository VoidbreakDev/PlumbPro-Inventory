
import React, { useState } from 'react';
import { Search, FileUp, Plus, Eye, SlidersHorizontal, Edit2, ChevronUp, ChevronDown, ArrowRightLeft, X, Trash2, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { InventoryItem, Contact } from '../types';
import { Badge, StockMeter, getStockStatus } from '../components/Shared';
import { EmptyState } from '../components/LoadingStates';
import { HelpIcon, KeyboardHint } from '../components/ContextualHelp';

interface InventoryViewProps {
  inventory: InventoryItem[];
  contacts: Contact[];
  search: string;
  onSearchChange: (val: string) => void;
  sortConfig: { key: keyof InventoryItem; direction: 'asc' | 'desc' } | null;
  onSort: (key: keyof InventoryItem) => void;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onViewDetails: (item: InventoryItem) => void;
  onAdjustStock: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onAddItem: () => void;
  onDeleteItem: (item: InventoryItem) => void;
  onDeleteAll: () => void;
  onTransferStock?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  contacts,
  search,
  onSearchChange,
  sortConfig,
  onSort,
  onImportCSV,
  onViewDetails,
  onAdjustStock,
  onEditItem,
  onAddItem,
  onDeleteItem,
  onDeleteAll,
  onTransferStock,
}) => {
  // Pricing display state
  const [priceType, setPriceType] = useState<'buy' | 'sell'>('buy');
  const [priceGST, setPriceGST] = useState<'excl' | 'incl'>('excl');
  const [showPriceSettings, setShowPriceSettings] = useState(false);

  // Filter state
  const [abcFilter, setAbcFilter] = useState<'All' | 'A' | 'B' | 'C'>('All');
  const [showDeadStockOnly, setShowDeadStockOnly] = useState(false);

  // Apply filters to inventory
  const filteredInventory = inventory.filter(item => {
    if (abcFilter !== 'All' && item.abcClassification !== abcFilter) return false;
    if (showDeadStockOnly && !item.isDeadStock) return false;
    return true;
  });

  // Helper to get the correct price based on display settings
  const getDisplayPrice = (item: InventoryItem): number | null => {
    let price: number | undefined;

    if (priceType === 'buy') {
      if (priceGST === 'excl') {
        // Try buy excl GST, then calculate from incl GST, then legacy price
        price = item.buyPriceExclGST
          ?? (item.buyPriceInclGST ? item.buyPriceInclGST / 1.1 : undefined)
          ?? (item.price > 0 ? item.price : undefined);
      } else {
        // Try buy incl GST, then calculate from excl GST, then legacy price with GST
        price = item.buyPriceInclGST
          ?? (item.buyPriceExclGST ? item.buyPriceExclGST * 1.1 : undefined)
          ?? (item.price > 0 ? item.price * 1.1 : undefined);
      }
    } else {
      if (priceGST === 'excl') {
        // Try sell excl GST, then calculate from incl GST, then legacy price
        price = item.sellPriceExclGST
          ?? (item.sellPriceInclGST ? item.sellPriceInclGST / 1.1 : undefined)
          ?? (item.price > 0 ? item.price : undefined);
      } else {
        // Try sell incl GST, then calculate from excl GST, then legacy price with GST
        price = item.sellPriceInclGST
          ?? (item.sellPriceExclGST ? item.sellPriceExclGST * 1.1 : undefined)
          ?? (item.price > 0 ? item.price * 1.1 : undefined);
      }
    }

    return price ?? null;
  };

  const getPriceLabel = (): string => {
    const typeLabel = priceType === 'buy' ? 'Buy' : 'Sell';
    const gstLabel = priceGST === 'excl' ? 'Excl GST' : 'Incl GST';
    return `${typeLabel} Price (${gstLabel})`;
  };

  // Helper to get ABC badge color
  const getABCBadgeVariant = (classification?: 'A' | 'B' | 'C'): 'red' | 'blue' | 'gray' | 'slate' => {
    if (!classification) return 'slate';
    switch (classification) {
      case 'A': return 'red';
      case 'B': return 'blue';
      case 'C': return 'gray';
      default: return 'slate';
    }
  };

  // Helper to get ABC icon
  const getABCIcon = (classification?: 'A' | 'B' | 'C') => {
    switch (classification) {
      case 'A': return <TrendingUp className="w-3 h-3" />;
      case 'B': return <Minus className="w-3 h-3" />;
      case 'C': return <TrendingDown className="w-3 h-3" />;
      default: return null;
    }
  };

  const InventoryTableHeader = ({ label, column }: { label: string, column?: keyof InventoryItem }) => {
    const isSortable = !!column;
    const isSorted = sortConfig?.key === column;
    
    return (
      <th 
        className={`px-6 py-4 text-xs font-semibold text-slate-500 uppercase ${isSortable ? 'cursor-pointer hover:bg-slate-100 transition-colors select-none' : ''}`}
        onClick={() => isSortable && column && onSort(column)}
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {isSortable && (
            <div className="flex flex-col opacity-60">
              {isSorted ? (
                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />
              ) : (
                <ArrowRightLeft className="w-3 h-3 rotate-90 scale-75 opacity-30" />
              )}
            </div>
          )}
        </div>
      </th>
    );
  };

  // Show empty state if no inventory
  if (inventory.length === 0 && !search && abcFilter === 'All' && !showDeadStockOnly) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No Inventory Items</h3>
          <p className="text-slate-600 mb-6">Start by adding your first inventory item or importing from CSV</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onAddItem}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Item
            </button>
            <label className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              <FileUp className="w-4 h-4 mr-2" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={onImportCSV}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header - Mobile Optimized */}
      <div className="p-4 md:p-6 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-slate-800">Inventory</h3>
            <HelpIcon content="Search, sort, and manage your inventory items here." />
          </div>
          <div className="flex items-center gap-2">
            {onTransferStock && (
              <button
                onClick={onTransferStock}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Transfer stock between locations"
              >
                <ArrowRightLeft className="w-4 h-4 md:mr-2" />
                <span className="text-sm font-semibold hidden md:inline">Transfer</span>
              </button>
            )}
            <button onClick={onAddItem} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="text-sm font-semibold hidden md:inline">Add Item</span>
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 text-sm"
            />
            {search && (
              <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ABC Filter */}
          <select
            value={abcFilter}
            onChange={(e) => setAbcFilter(e.target.value as 'All' | 'A' | 'B' | 'C')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 text-sm font-medium text-slate-700"
          >
            <option value="All">All Items</option>
            <option value="A">A Items (High Value)</option>
            <option value="B">B Items (Medium)</option>
            <option value="C">C Items (Low)</option>
          </select>

          {/* Dead Stock Filter */}
          <button
            onClick={() => setShowDeadStockOnly(!showDeadStockOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-semibold ${
              showDeadStockOnly
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
            title="Show only dead stock items (180+ days no movement)"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden lg:inline">Dead Stock</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowPriceSettings(!showPriceSettings)}
              className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              title="Price display settings"
            >
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-semibold hidden md:inline md:ml-2">Pricing</span>
            </button>
            {showPriceSettings && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-10">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Price Display Options</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600 font-medium mb-1 block">Price Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPriceType('buy')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          priceType === 'buy'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Buy Price
                      </button>
                      <button
                        onClick={() => setPriceType('sell')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          priceType === 'sell'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Sell Price
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-medium mb-1 block">GST</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPriceGST('excl')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          priceGST === 'excl'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Excl GST
                      </button>
                      <button
                        onClick={() => setPriceGST('incl')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          priceGST === 'incl'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Incl GST
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <label className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
            <FileUp className="w-4 h-4" />
            <span className="text-sm font-semibold hidden md:inline md:ml-2">Import</span>
            <input type="file" accept=".csv" onChange={onImportCSV} className="hidden" />
          </label>
          {inventory.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              title="Delete all inventory items"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-semibold hidden md:inline md:ml-2">Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <InventoryTableHeader label="Item Name" column="name" />
              <InventoryTableHeader label="Category" column="category" />
              <InventoryTableHeader label="Supplier / Code" />
              <InventoryTableHeader label={getPriceLabel()} column="price" />
              <InventoryTableHeader label="In Stock" column="quantity" />
              <InventoryTableHeader label="Locations" />
              <InventoryTableHeader label="ABC" />
              <InventoryTableHeader label="Status" />
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <p className="text-slate-500 font-medium">No items found matching "{search}"</p>
                  <button
                    onClick={() => onSearchChange('')}
                    className="mt-3 text-blue-600 hover:text-blue-700 font-semibold text-sm"
                  >
                    Clear search
                  </button>
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => {
                const status = getStockStatus(item.quantity, item.reorderLevel);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">ID: {item.id}</p>
                        </div>
                        {item.isDeadStock && (
                          <div className="flex-shrink-0" title="Dead stock: 180+ days no movement">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm font-medium">{item.category}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-700">{contacts.find(c => c.id === item.supplierId)?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.supplierCode}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {getDisplayPrice(item) !== null ? `$${getDisplayPrice(item)!.toFixed(2)}` : <span className="text-slate-400 text-sm">No price</span>}
                    </td>
                    <td className="px-6 py-4">
                      <p className={`font-bold ${status.variant !== 'green' ? 'text-amber-600' : 'text-slate-800'}`}>{item.quantity}</p>
                      <p className="text-xs text-slate-400 tracking-tighter">MIN: {item.reorderLevel}</p>
                      <StockMeter quantity={item.quantity} reorderLevel={item.reorderLevel} />
                    </td>
                    <td className="px-6 py-4">
                      {item.locationStock && item.locationStock.length > 0 ? (
                        <div className="space-y-1">
                          {item.locationStock.map((loc) => (
                            <div key={loc.locationId || loc.locationName} className="flex items-center gap-1.5 text-xs">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600 font-medium">{loc.locationName}:</span>
                              <span className="text-slate-800 font-bold">{loc.quantity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No locations</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.abcClassification ? (
                        <Badge variant={getABCBadgeVariant(item.abcClassification)}>
                          <div className="flex items-center gap-1">
                            {getABCIcon(item.abcClassification)}
                            <span>{item.abcClassification}</span>
                          </div>
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button title="View Details" onClick={() => onViewDetails(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button title="Adjust Stock" onClick={() => onAdjustStock(item)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                        {onTransferStock && (
                          <button title="Transfer Stock" onClick={onTransferStock} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}
                        <button title="Edit Item" onClick={() => onEditItem(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button title="Delete Item" onClick={() => onDeleteItem(item)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredInventory.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-slate-500 font-medium">No items found matching "{search}"</p>
            <button
              onClick={() => onSearchChange('')}
              className="mt-3 text-blue-600 hover:text-blue-700 font-semibold text-sm"
            >
              Clear search
            </button>
          </div>
        ) : (
          filteredInventory.map(item => {
            const status = getStockStatus(item.quantity, item.reorderLevel);
            return (
              <div key={item.id} className="p-4 active:bg-slate-50 transition-colors">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                      {item.isDeadStock && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" title="Dead stock: 180+ days no movement" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{item.category}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {item.abcClassification && (
                      <Badge variant={getABCBadgeVariant(item.abcClassification)}>
                        <div className="flex items-center gap-1">
                          {getABCIcon(item.abcClassification)}
                          <span>{item.abcClassification}</span>
                        </div>
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Stock</p>
                    <p className={`font-bold ${status.variant !== 'green' ? 'text-amber-600' : 'text-slate-800'}`}>
                      {item.quantity} <span className="text-xs text-slate-400 font-normal">/ {item.reorderLevel}</span>
                    </p>
                    <StockMeter quantity={item.quantity} reorderLevel={item.reorderLevel} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">{getPriceLabel()}</p>
                    <p className="font-bold text-slate-700">
                      {getDisplayPrice(item) !== null ? `$${getDisplayPrice(item)!.toFixed(2)}` : <span className="text-slate-400 text-sm">No price</span>}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-0.5">Supplier</p>
                    <p className="text-sm font-medium text-slate-700">
                      {contacts.find(c => c.id === item.supplierId)?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{item.supplierCode}</p>
                  </div>
                  {item.locationStock && item.locationStock.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Locations</p>
                      <div className="space-y-1">
                        {item.locationStock.map((loc) => (
                          <div key={loc.locationId || loc.locationName} className="flex items-center gap-1.5 text-xs">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-600 font-medium">{loc.locationName}:</span>
                            <span className="text-slate-800 font-bold">{loc.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewDetails(item)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <Eye className="w-4 h-4" />
                    Details
                  </button>
                  <button
                    onClick={() => onAdjustStock(item)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-amber-600 bg-amber-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Adjust
                  </button>
                  <button
                    onClick={() => onEditItem(item)}
                    className="flex items-center justify-center px-3 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteItem(item)}
                    className="flex items-center justify-center px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-lg active:scale-95 transition-transform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard hints at bottom - Desktop only */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="hidden md:flex items-center space-x-4">
          <KeyboardHint keys={['⌘', 'K']} description="Open command palette" />
          <KeyboardHint keys={['⌘', 'F']} description="Quick search" />
        </div>
        <span className="mx-auto md:mx-0">
          {filteredInventory.length} item{filteredInventory.length !== 1 ? 's' : ''} shown
          {(abcFilter !== 'All' || showDeadStockOnly) && ` (${inventory.length} total)`}
        </span>
      </div>
    </div>
  );
};
