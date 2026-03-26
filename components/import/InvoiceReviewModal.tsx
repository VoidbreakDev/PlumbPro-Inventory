// components/import/InvoiceReviewModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Truck, CheckCircle } from 'lucide-react';
import { purchaseAnalyticsAPI, type ReviewInvoice, type OrderType } from '../../lib/purchaseAnalyticsAPI';

interface Props {
  batchId: string;
  onClose: () => void;
  onComplete: () => void;
}

const ORDER_TYPES: OrderType[] = ['Job Delivery', 'Stock Order', 'Pickup', 'Unknown'];

const JOB_PO_PATTERN = /^\d{6,}$/;

export function InvoiceReviewModal({ batchId, onClose, onComplete }: Props) {
  const [invoices, setInvoices] = useState<ReviewInvoice[]>([]);
  const [localTypes, setLocalTypes] = useState<Record<string, OrderType>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ confirmed: 0, total: 0 });

  useEffect(() => {
    setLoading(true);
    purchaseAnalyticsAPI.getBatchReview(batchId)
      .then(r => {
        setInvoices(r.invoices);
        const init: Record<string, OrderType> = {};
        for (const inv of r.invoices) init[inv.invoiceNumber] = inv.currentOrderType;
        setLocalTypes(init);
        setProgress({ confirmed: 0, total: r.invoices.length });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [batchId]);

  // Recompute progress: count rows where type !== 'Unknown'
  useEffect(() => {
    const confirmed = Object.values(localTypes).filter(t => t !== 'Unknown').length;
    setProgress(p => ({ ...p, confirmed }));
  }, [localTypes]);

  const toggleSelect = (invNo: string) => {
    setSelected(s => {
      const next = new Set(s);
      next.has(invNo) ? next.delete(invNo) : next.add(invNo);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(invoices.map(i => i.invoiceNumber)));
  const deselectAll = () => setSelected(new Set());

  const applyBulk = (type: OrderType) => {
    if (!selected.size) return;
    setLocalTypes(prev => {
      const next = { ...prev };
      for (const invNo of selected) next[invNo] = type;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(localTypes).map(([invoiceNumber, orderType]) => ({ invoiceNumber, orderType }));
      const result = await purchaseAnalyticsAPI.submitBatchReview(batchId, updates);
      if (result.remainingUnconfirmed === 0) {
        setDone(true);
        setTimeout(() => { onComplete(); }, 1500);
      } else {
        // Refresh remaining
        const r = await purchaseAnalyticsAPI.getBatchReview(batchId);
        setInvoices(r.invoices);
        const init: Record<string, OrderType> = {};
        for (const inv of r.invoices) init[inv.invoiceNumber] = inv.currentOrderType;
        setLocalTypes(init);
        setSelected(new Set());
        setProgress({ confirmed: 0, total: r.invoices.length });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Review invoice order types</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} could not be automatically classified.
              Select invoices and assign an order type.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5"><X size={20} /></button>
        </div>

        {done ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-lg font-semibold text-slate-700">All invoices classified</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 flex-shrink-0 flex-wrap">
              <button onClick={selectAll} className="text-xs px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50">Select all</button>
              <button onClick={deselectAll} className="text-xs px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50">Deselect all</button>
              <span className="text-slate-300 mx-1">|</span>
              {ORDER_TYPES.map(type => (
                <button
                  key={type}
                  disabled={!selected.size}
                  onClick={() => applyBulk(type)}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                    selected.size
                      ? type === 'Job Delivery' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : type === 'Stock Order' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : type === 'Pickup' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex-1 text-slate-400 py-16 text-center">Loading…</div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" checked={selected.size === invoices.length && invoices.length > 0} onChange={e => e.target.checked ? selectAll() : deselectAll()} />
                      </th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-left">Order No</th>
                      <th className="px-3 py-2 text-left">Products</th>
                      <th className="px-3 py-2 text-right">Lines</th>
                      <th className="px-3 py-2 text-right">Total ex GST</th>
                      <th className="px-3 py-2 text-left">Order Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const type = localTypes[inv.invoiceNumber] ?? inv.currentOrderType;
                      const isSelected = selected.has(inv.invoiceNumber);
                      const looksLikeJob = JOB_PO_PATTERN.test(inv.orderNo || '');
                      return (
                        <tr
                          key={inv.invoiceNumber}
                          onClick={() => toggleSelect(inv.invoiceNumber)}
                          className={`border-t border-slate-50 cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inv.invoiceNumber)} />
                          </td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{inv.invoiceDate}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 text-xs">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-mono text-xs">{inv.orderNo || '—'}</span>
                              {looksLikeJob && (
                                <span className="text-xs text-blue-400" title="Looks like a job PO">PO?</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <div className="text-slate-600 text-xs max-w-[200px]">
                                {inv.topProducts.slice(0, 2).map((p, i) => (
                                  <div key={i} className="truncate">{p}</div>
                                ))}
                                {inv.topProducts.length > 2 && <div className="text-slate-400">+{inv.topProducts.length - 2} more</div>}
                              </div>
                              {inv.hasDeliveryCharge && (
                                <span title="Has cartage charge">
                                  <Truck size={12} className="text-amber-400 flex-shrink-0 ml-1" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{inv.lineCount}</td>
                          <td className="px-3 py-2 text-right text-slate-700">${inv.totalExGST.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <select
                              value={type}
                              onChange={e => setLocalTypes(prev => ({ ...prev, [inv.invoiceNumber]: e.target.value as OrderType }))}
                              className={`text-xs border rounded px-2 py-1 ${type === 'Unknown' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                            >
                              {ORDER_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <span className="text-sm text-slate-500">
                <span className={progress.confirmed === progress.total ? 'text-emerald-600 font-medium' : ''}>
                  {progress.confirmed}
                </span> of {progress.total} invoices classified
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Skip for now
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
