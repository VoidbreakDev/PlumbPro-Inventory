// components/analytics/InventoryInsights.tsx
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { purchaseAnalyticsAPI, type PAProduct } from '../../lib/purchaseAnalyticsAPI';

interface Props { dateRange: { from: string; to: string }; refreshKey: number; }

type SortKey = 'timesOrdered' | 'totalSpendExGST';

export function InventoryInsights({ refreshKey }: Props) {
  const [products, setProducts] = useState<PAProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('timesOrdered');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    purchaseAnalyticsAPI.getTopProducts({ limit: 100, sortBy: sortKey })
      .then(r => setProducts(r.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey, sortKey]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;

  const barData = products.slice(0, 15).map(p => ({
    name: p.productDescription.slice(0, 38),
    orders: p.timesOrdered,
  }));

  const maxSpend = Math.max(...products.map(p => p.totalSpendExGST), 1);
  const paged = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Top 15 horizontal bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Top 15 Products by Order Frequency</h2>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Product table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-600">All Products</h2>
          <div className="flex gap-2 text-xs text-slate-500">
            Sort by:
            <button onClick={() => setSortKey('timesOrdered')} className={`px-2 py-0.5 rounded ${sortKey === 'timesOrdered' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:text-slate-700'}`}>Orders</button>
            <button onClick={() => setSortKey('totalSpendExGST')} className={`px-2 py-0.5 rounded ${sortKey === 'totalSpendExGST' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:text-slate-700'}`}>Spend</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Spend ex GST</th>
                <th className="px-3 py-2 text-right">Latest Price</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.productCode} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{p.productDescription}</div>
                    <div className="text-xs text-slate-400">{p.productCode}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.category}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{p.timesOrdered}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{p.totalQty.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 bg-blue-100 rounded-full w-16 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(p.totalSpendExGST / maxSpend) * 100}%` }} />
                      </div>
                      <span className="text-slate-700 tabular-nums">${p.totalSpendExGST.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {p.latestUnitPriceExGST !== null ? `$${p.latestUnitPriceExGST.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">‹ Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">Next ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
