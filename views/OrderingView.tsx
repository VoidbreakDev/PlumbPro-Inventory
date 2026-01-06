
import React, { useState } from 'react';
import { ShoppingCart, TrendingUp, ChevronRight, Truck, AlertCircle } from 'lucide-react';
import { InventoryItem, Job, SmartOrderSuggestion } from '../types';
import { Badge } from '../components/Shared';
import { smartOrderingAPI } from '../lib/api';

interface OrderingViewProps {
  inventory: InventoryItem[];
  jobs: Job[];
}

export const OrderingView: React.FC<OrderingViewProps> = ({ inventory, jobs }) => {
  const [suggestions, setSuggestions] = useState<SmartOrderSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const result = await smartOrderingAPI.getSuggestions();
      setSuggestions(result.suggestions || []);
    } catch (err: any) {
      console.error('Failed to fetch suggestions:', err);
      setError(err.response?.data?.details || 'Failed to generate suggestions. Please check your Gemini API key in Settings.');
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
         <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-2">Smart Inventory Assistant</h3>
          <p className="opacity-90 max-w-xl mb-6">Our AI analyzes your upcoming schedule and current stock levels to suggest the perfect purchase order.</p>
          <button 
            onClick={fetchSuggestions}
            disabled={isSuggesting}
            className="px-6 py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50 flex items-center"
          >
            {isSuggesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent mr-2" />
                Analyzing Schedule...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 mr-2" />
                Generate Order Suggestions
              </>
            )}
          </button>
         </div>
         <div className="absolute right-0 bottom-0 opacity-10">
            <ShoppingCart className="w-64 h-64 -mb-20 -mr-20" />
         </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border-2 border-red-200 dark:border-red-700 rounded-xl p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-300 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-900 dark:text-red-100 mb-1">Unable to Generate Suggestions</h4>
              <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
              <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                To enable Smart Ordering, add your Gemini API key in Settings → AI Integration
              </p>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-bold text-slate-800">Suggested Purchase Order</h4>
            <button className="flex items-center text-blue-600 font-bold hover:underline">
              <Truck className="w-4 h-4 mr-2" />
              Place All Orders
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {suggestions.map((s, idx) => (
              <div key={idx} className="p-6 flex items-start justify-between hover:bg-slate-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                     <p className="font-bold text-slate-800">{s.itemName}</p>
                     <Badge variant="blue">+{s.suggestedQuantity}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 flex items-center italic">
                    <ChevronRight className="w-4 h-4 text-slate-400 mr-1" />
                    {s.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
