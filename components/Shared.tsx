
import React from 'react';
import { 
  AlertTriangle, 
  ChevronUp, 
  ChevronDown, 
  ArrowRightLeft 
} from 'lucide-react';
import { InventoryItem } from '../types';

export const Badge = ({ children, variant = 'blue' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[variant]}`}>{children}</span>;
};

export const getStockStatus = (quantity: number, reorderLevel: number) => {
  if (quantity <= 0) return { label: 'Out of Stock', variant: 'red' };
  if (quantity <= reorderLevel) return { label: 'Low Stock', variant: 'yellow' };
  return { label: 'Healthy', variant: 'green' };
};

export const StockMeter = ({ quantity, reorderLevel }: { quantity: number, reorderLevel: number }) => {
  const percentage = Math.min(100, (quantity / (reorderLevel * 2 || 1)) * 100);
  const status = getStockStatus(quantity, reorderLevel);
  const barColor = status.variant === 'red' ? 'bg-red-500' : status.variant === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
      <div 
        className={`${barColor} h-full transition-all duration-500`} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export const NavItem = ({ icon: Icon, label, active, onClick, collapsed }: { icon: any, label: string, active: boolean, onClick: () => void, collapsed: boolean }) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center px-6 py-4 transition-all relative ${active ? 'text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />}
      <Icon className={`w-6 h-6 shrink-0 ${active ? 'text-blue-400' : ''}`} />
      {!collapsed && <span className="ml-4 font-bold text-sm tracking-wide">{label}</span>}
    </button>
  );
};
