
import React from 'react';
import { Search, FileUp, Plus, Eye, SlidersHorizontal, Edit2, ChevronUp, ChevronDown, ArrowRightLeft, X } from 'lucide-react';
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
}) => {
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
  if (inventory.length === 0 && !search) {
    return (
      <EmptyState
        icon="📦"
        title="No Inventory Items"
        description="Start by adding your first inventory item or importing from CSV"
        action={{
          label: 'Add First Item',
          onClick: onAddItem
        }}
      />
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
          <button onClick={onAddItem} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="text-sm font-semibold hidden md:inline">Add Item</span>
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
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
          <label className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
            <FileUp className="w-4 h-4" />
            <span className="text-sm font-semibold hidden md:inline md:ml-2">Import</span>
            <input type="file" accept=".csv" onChange={onImportCSV} className="hidden" />
          </label>
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
              <InventoryTableHeader label="Price" column="price" />
              <InventoryTableHeader label="In Stock" column="quantity" />
              <InventoryTableHeader label="Status" />
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
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
              inventory.map(item => {
                const status = getStockStatus(item.quantity, item.reorderLevel);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">ID: {item.id}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm font-medium">{item.category}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-700">{contacts.find(c => c.id === item.supplierId)?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.supplierCode}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">${item.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <p className={`font-bold ${status.variant !== 'green' ? 'text-amber-600' : 'text-slate-800'}`}>{item.quantity}</p>
                      <p className="text-xs text-slate-400 tracking-tighter">MIN: {item.reorderLevel}</p>
                      <StockMeter quantity={item.quantity} reorderLevel={item.reorderLevel} />
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
                        <button title="Edit Item" onClick={() => onEditItem(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
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
        {inventory.length === 0 ? (
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
          inventory.map(item => {
            const status = getStockStatus(item.quantity, item.reorderLevel);
            return (
              <div key={item.id} className="p-4 active:bg-slate-50 transition-colors">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
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
                    <p className="text-xs text-slate-500 mb-0.5">Price</p>
                    <p className="font-bold text-slate-700">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-0.5">Supplier</p>
                    <p className="text-sm font-medium text-slate-700">
                      {contacts.find(c => c.id === item.supplierId)?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{item.supplierCode}</p>
                  </div>
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
        <span className="mx-auto md:mx-0">{inventory.length} item{inventory.length !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
};
