// components/analytics/PriceTrends.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { purchaseAnalyticsAPI, type PAProduct, type PAPriceTrend, type PAPriceAlert } from '../../lib/purchaseAnalyticsAPI';

interface Props { refreshKey: number; }

export function PriceTrends({ refreshKey }: Props) {
  const [products, setProducts] = useState<PAProduct[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [trend, setTrend] = useState<PAPriceTrend | null>(null);
  const [alerts, setAlerts] = useState<PAPriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      purchaseAnalyticsAPI.getTopProducts({ limit: 20, sortBy: 'orders' }),
      purchaseAnalyticsAPI.getPriceAlerts(10),
    ]).then(([p, a]) => {
      setProducts(p.products);
      setAlerts(a.alerts);
      if (p.products.length && !selectedCode) {
        setSelectedCode(p.products[0].productCode);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedCode) return;
    purchaseAnalyticsAPI.getPriceTrends(selectedCode).then(setTrend).catch(console.error);
  }, [selectedCode]);

  const lineColor = () => {
    if (!trend || trend.points.length < 2) return '#64748b';
    const first = trend.points[0].avgPriceExGST;
    const last = trend.points[trend.points.length - 1].avgPriceExGST;
    const pct = ((last - first) / first) * 100;
    if (pct > 10) return '#ef4444';
    if (pct > 5) return '#f59e0b';
    return '#10b981';
  };

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Product selector + chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-600">Price Trend</h2>
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            className="ml-auto text-sm border border-slate-200 rounded-lg px-3 py-1.5 max-w-sm"
          >
            {products.map(p => (
              <option key={p.productCode} value={p.productCode}>
                {p.productDescription.slice(0, 60)}
              </option>
            ))}
          </select>
        </div>
        {trend && trend.points.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v.toFixed(2)}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Line dataKey="avgPriceExGST" name="Unit Price (ex GST)" stroke={lineColor()} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-400 text-sm py-8 text-center">No price history for this product yet.</div>
        )}
      </div>

      {/* Price alerts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-600">Price Alerts (≥10% change)</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center">No significant price changes detected.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">First Price</th>
                <th className="px-3 py-2 text-right">Latest Price</th>
                <th className="px-3 py-2 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.productCode} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{a.productDescription}</div>
                    <div className="text-xs text-slate-400">{a.productCode}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{a.category}</td>
                  <td className="px-3 py-2 text-right text-slate-500">${a.firstPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">${a.lastPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      a.flag === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.changePercent > 0 ? '+' : ''}{a.changePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
