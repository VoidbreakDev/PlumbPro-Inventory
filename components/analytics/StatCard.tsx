// components/analytics/StatCard.tsx
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string; // e.g. '+12%' or '-5%'
}

export function StatCard({ label, value, sub, trend }: StatCardProps) {
  const isPositive = trend?.startsWith('+');
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      <div className="flex items-center gap-2 mt-1">
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
        {trend && (
          <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>
    </div>
  );
}
