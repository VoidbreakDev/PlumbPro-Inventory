// components/analytics/DeliveryCosts.tsx
import React, { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { purchaseAnalyticsAPI, type PADeliveryMonth, type PADeliverySummary } from '../../lib/purchaseAnalyticsAPI';

interface Props { refreshKey: number; }

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export function DeliveryCosts({ refreshKey }: Props) {
  const [months, setMonths] = useState<PADeliveryMonth[]>([]);
  const [summary, setSummary] = useState<PADeliverySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getDeliveryMonthly(),
      purchaseAnalyticsAPI.getDeliverySummary(),
    ]).then(([m, s]) => {
      setMonths(m.months);
      setSummary(s);
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const chartData = months.map(m => ({
    month: m.month.slice(5, 7) + '/' + m.month.slice(2, 4),
    cost: m.totalExGST,
    count: m.deliveryCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Dual-axis chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Monthly Delivery Cost & Count</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="cost" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="cost" dataKey="cost" name="Cost (ex GST)" fill="#f87171" radius={[3, 3, 0, 0]} />
            <Line yAxisId="count" dataKey="count" name="Deliveries" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Delivery Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total delivery charges</dt><dd className="font-medium">{fmtMoney(summary.totalExGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total charges (inc GST)</dt><dd className="font-medium">{fmtMoney(summary.totalIncGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Avg monthly</dt><dd className="font-medium">{fmtMoney(summary.avgMonthlyExGST)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total line items</dt><dd className="font-medium">{summary.totalCharges}</dd></div>
            </dl>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Billable vs Absorbed</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Absorbed (business cost)</dt><dd className="font-medium text-amber-600">{summary.absorbedPct}%</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Billable (passed through)</dt><dd className="font-medium text-emerald-600">{summary.billablePct}%</dd></div>
            </dl>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${summary.billablePct}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
