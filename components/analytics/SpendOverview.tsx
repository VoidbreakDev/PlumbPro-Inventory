// components/analytics/SpendOverview.tsx
import React, { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { purchaseAnalyticsAPI, type PAMonthlySpend, type PAAnnualSpend, type PACategory } from '../../lib/purchaseAnalyticsAPI';

const CATEGORY_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899',
  '#14b8a6','#f97316','#64748b','#0ea5e9','#a855f7','#84cc16',
];

const YEAR_COLORS: Record<string, string> = { '2024': '#3b82f6', '2025': '#10b981', '2026': '#8b5cf6' };

interface Props { dateRange: { from: string; to: string }; refreshKey: number; }

function fmtK(v: number) { return `$${(v / 1000).toFixed(0)}k`; }

export function SpendOverview({ refreshKey }: Props) {
  const [monthly, setMonthly] = useState<PAMonthlySpend[]>([]);
  const [annual, setAnnual] = useState<PAAnnualSpend[]>([]);
  const [categories, setCategories] = useState<PACategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getMonthlySpend(),
      purchaseAnalyticsAPI.getAnnualSpend(),
      purchaseAnalyticsAPI.getCategories(),
    ]).then(([m, a, c]) => {
      setMonthly(m.months);
      setAnnual(a.years);
      setCategories(c.categories);
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const monthlyData = monthly.map(m => ({
    month: m.month.slice(5, 7) + '/' + m.month.slice(2, 4),
    gross: m.grossExGST,
    net: m.netExGST,
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Monthly bar + line */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Monthly Spend (ex GST)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            <Legend />
            <Bar dataKey="gross" name="Gross" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Line dataKey="net" name="Net (after credits)" stroke="#10b981" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Category donut + legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Spend by Category</h2>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <ResponsiveContainer width={240} height={240}>
            <PieChart>
              <Pie data={categories} dataKey="totalExGST" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-y-2 gap-x-4 flex-1">
            {categories.map((cat, i) => (
              <div key={cat.category} className="flex items-center gap-2 min-w-[160px]">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                <span className="text-xs text-slate-600 truncate">{cat.category}</span>
                <span className="text-xs font-medium text-slate-800 ml-auto">{cat.percentOfTotal}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annual comparison */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Annual Comparison</h2>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={annual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`} />
            <Bar dataKey="grossExGST" name="Gross ex GST" radius={[4, 4, 0, 0]}>
              {annual.map(row => (
                <Cell key={row.year} fill={YEAR_COLORS[row.year] || '#64748b'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
