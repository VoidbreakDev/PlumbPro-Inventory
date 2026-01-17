
import React, { useState, useMemo } from 'react';
import { Filter, RotateCcw, ArrowRight, MapPin } from 'lucide-react';
import { StockMovement, InventoryItem } from '../types';
import { Badge } from '../components/Shared';

interface HistoryViewProps {
  movements: StockMovement[];
  inventory: InventoryItem[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ movements, inventory }) => {
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('All');
  const [historyItemFilter, setHistoryItemFilter] = useState<string>('All');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (historyTypeFilter !== 'All' && m.type !== historyTypeFilter) return false;
      if (historyItemFilter !== 'All' && m.itemId !== historyItemFilter) return false;
      if (historyStartDate) {
        const start = new Date(historyStartDate).getTime();
        if (m.timestamp < start) return false;
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate).setHours(23, 59, 59, 999);
        if (m.timestamp > end) return false;
      }
      return true;
    });
  }, [movements, historyTypeFilter, historyItemFilter, historyStartDate, historyEndDate]);

  const clearHistoryFilters = () => {
    setHistoryTypeFilter('All');
    setHistoryItemFilter('All');
    setHistoryStartDate('');
    setHistoryEndDate('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-bold text-slate-600 uppercase tracking-widest">Filter Log</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Movement Type</label>
            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Types</option>
              <option value="In">In (Stock Increase)</option>
              <option value="Out">Out (Stock Decrease)</option>
              <option value="Adjustment">Adjustment</option>
              <option value="Allocation">Allocation (To Job)</option>
              <option value="Transfer">Transfer (Between Locations)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Specific Item</label>
            <select 
              value={historyItemFilter}
              onChange={(e) => setHistoryItemFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Items</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">From Date</label>
            <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">To Date</label>
            <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={clearHistoryFilters} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-bold">
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Item</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Quantity</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Location</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Reference / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMovements.map(m => {
              const isTransfer = m.type === 'Transfer';
              const badgeVariant =
                m.type === 'In' ? 'green' :
                m.type === 'Out' ? 'red' :
                m.type === 'Allocation' ? 'blue' :
                m.type === 'Transfer' ? 'purple' :
                'slate';

              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(m.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{inventory.find(i => i.id === m.itemId)?.name || 'Deleted'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={badgeVariant}>{m.type}</Badge>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">
                    {m.type === 'In' || (m.type === 'Adjustment' && m.reference?.includes('Added')) ? '+' : '-'}
                    {Math.abs(m.quantity)}
                  </td>
                  <td className="px-6 py-4">
                    {isTransfer && m.locationName && m.destinationLocationName ? (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1 text-red-600">
                          <MapPin className="w-3 h-3" />
                          <span className="font-medium">{m.locationName}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <div className="flex items-center gap-1 text-green-600">
                          <MapPin className="w-3 h-3" />
                          <span className="font-medium">{m.destinationLocationName}</span>
                        </div>
                      </div>
                    ) : m.locationName ? (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{m.locationName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{m.reference || '--'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
