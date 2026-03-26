// components/analytics/AnalyticsDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Upload, RefreshCw, ClipboardList } from 'lucide-react';
import { StatCard } from './StatCard';
import { SpendOverview } from './SpendOverview';
import { InventoryInsights } from './InventoryInsights';
import { PriceTrends } from './PriceTrends';
import { DeliveryCosts } from './DeliveryCosts';
import { ReeceImportModal } from '../import/ReeceImportModal';
import { InvoiceReviewModal } from '../import/InvoiceReviewModal';
import { purchaseAnalyticsAPI, type PASummary, type PendingBatch } from '../../lib/purchaseAnalyticsAPI';
import { format, subMonths } from 'date-fns';

type Tab = 'spend' | 'inventory' | 'price-trends' | 'delivery';

const TABS: { id: Tab; label: string }[] = [
  { id: 'spend', label: 'Spend Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'price-trends', label: 'Price Trends' },
  { id: 'delivery', label: 'Delivery Costs' },
];

function getTabFromUrl(): Tab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as Tab;
  return TABS.some(t => t.id === tab) ? tab : 'spend';
}

function setTabInUrl(tab: Tab) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState(null, '', url.toString());
}

function fmtMoney(n?: number) {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromUrl);
  const [summary, setSummary] = useState<PASummary | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange] = useState({
    from: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const loadSummary = useCallback(async () => {
    try {
      const [s, pending] = await Promise.all([
        purchaseAnalyticsAPI.getSummary(),
        purchaseAnalyticsAPI.getPendingReview(),
      ]);
      setSummary(s);
      setPendingBatches(pending.batches);
    } catch (_) {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setTabInUrl(tab);
  };

  const handleImportSuccess = () => {
    setShowImport(false);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Analytics</h1>
          {summary?.dateFrom && (
            <p className="text-sm text-slate-500 mt-0.5">
              Data from {summary.dateFrom} to {summary.dateTo}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Upload size={14} /> Import Invoices
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Gross Spend" value={fmtMoney(summary?.totalGrossExGST)} sub="ex GST" />
        <StatCard label="Net Spend" value={fmtMoney(summary?.totalNetExGST)} sub="after credits" />
        <StatCard label="Total Invoices" value={summary?.totalInvoices?.toString() ?? '—'} />
        <StatCard label="Avg Monthly" value={fmtMoney(summary?.avgMonthlyGross)} sub="ex GST" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'spend' && <SpendOverview dateRange={dateRange} refreshKey={refreshKey} />}
      {activeTab === 'inventory' && <InventoryInsights dateRange={dateRange} refreshKey={refreshKey} />}
      {activeTab === 'price-trends' && <PriceTrends refreshKey={refreshKey} />}
      {activeTab === 'delivery' && <DeliveryCosts refreshKey={refreshKey} />}

      {/* Global pending review badge */}
      {pendingBatches.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-amber-700">
            <ClipboardList size={16} />
            <span className="text-sm font-medium">
              {pendingBatches.length} batch{pendingBatches.length !== 1 ? 'es' : ''} need order type review
              ({pendingBatches.reduce((sum, b) => sum + (b.unconfirmed_count || 0), 0)} invoices)
            </span>
          </div>
          <button
            onClick={() => setReviewBatchId(pendingBatches[0].id)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
          >
            Review now →
          </button>
        </div>
      )}

      {showImport && (
        <ReeceImportModal
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {reviewBatchId && (
        <InvoiceReviewModal
          batchId={reviewBatchId}
          onClose={() => setReviewBatchId(null)}
          onComplete={() => { setReviewBatchId(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
