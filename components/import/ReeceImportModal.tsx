// components/import/ReeceImportModal.tsx
import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, ClipboardList } from 'lucide-react';
import { purchaseAnalyticsAPI, type ImportSummary } from '../../lib/purchaseAnalyticsAPI';
import { InvoiceReviewModal } from './InvoiceReviewModal';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ReeceImportModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { setError('Only CSV files are accepted'); return; }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await purchaseAnalyticsAPI.importReece(file);
      setResult(summary);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Import failed. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Import Reece Invoices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            Invoice (Cash) rows will be automatically excluded.
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Upload size={28} className="mx-auto text-slate-400 mb-2" />
              {file ? (
                <p className="text-sm font-medium text-slate-700">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Drag & drop or click to select</p>
                  <p className="text-xs text-slate-400 mt-1">Reece "Detailed with Full Codes" CSV, max 10 MB</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Success summary */}
          {result && (
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-700 font-medium mb-3">
                  <CheckCircle size={16} /> Import complete
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-slate-500">Invoices imported</dt><dd className="font-medium text-slate-800">{result.invoiceCount}</dd>
                  <dt className="text-slate-500">Credits found</dt><dd className="font-medium text-slate-800">{result.creditCount}</dd>
                  <dt className="text-slate-500">Rows skipped</dt><dd className="font-medium text-slate-800">{result.skippedCount}</dd>
                  <dt className="text-slate-500">Total spend (ex GST)</dt>
                  <dd className="font-medium text-slate-800">${result.grossTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</dd>
                </dl>
              </div>
              {result.unconfirmedCount > 0 && (
                <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2 text-amber-700">
                    <ClipboardList size={16} className="mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      {result.unconfirmedCount} invoice{result.unconfirmedCount !== 1 ? 's' : ''} need order type review
                    </span>
                  </div>
                  <button
                    onClick={() => setShowReview(true)}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap underline"
                  >
                    Review now →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          {result ? (
            <button onClick={onSuccess} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!file || loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing…' : 'Import invoices'}
              </button>
            </>
          )}
        </div>
      </div>

      {showReview && result && (
        <InvoiceReviewModal
          batchId={result.batchId}
          onClose={() => setShowReview(false)}
          onComplete={() => { setShowReview(false); onSuccess(); }}
        />
      )}
    </div>
  );
}
