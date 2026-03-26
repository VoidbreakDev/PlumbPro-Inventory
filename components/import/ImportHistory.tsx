// components/import/ImportHistory.tsx
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { purchaseAnalyticsAPI, type ImportBatch } from '../../lib/purchaseAnalyticsAPI';

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    purchaseAnalyticsAPI.getBatches()
      .then(r => setBatches(r.batches))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this import batch and all its invoice data?')) return;
    await purchaseAnalyticsAPI.deleteBatch(id);
    load();
  };

  if (loading) return <div className="text-slate-400 text-sm py-4 text-center">Loading…</div>;

  if (!batches.length) return <div className="text-slate-400 text-sm py-4 text-center">No imports yet.</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-600">Import History</h3>
        <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw size={14} /></button>
      </div>
      {batches.map(b => (
        <div key={b.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <div>
            <div className="font-medium text-slate-700">{b.filename}</div>
            <div className="text-xs text-slate-400">
              {new Date(b.imported_at).toLocaleDateString('en-AU')} · {b.invoice_count} invoices · ${Number(b.gross_total_ex_gst).toLocaleString('en-AU', { maximumFractionDigits: 0 })} ex GST
            </div>
          </div>
          <button onClick={() => handleDelete(b.id)} className="text-slate-300 hover:text-red-500 ml-3">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
