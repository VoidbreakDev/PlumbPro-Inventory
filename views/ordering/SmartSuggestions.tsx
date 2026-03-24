import React from 'react';
import {
  TrendingUp,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { SmartOrderSuggestion } from '../../types';
import { Badge } from '../../components/Shared';

interface SmartSuggestionsProps {
  suggestions: SmartOrderSuggestion[];
  isSuggesting: boolean;
  isCreatingPOs: boolean;
  onFetchSuggestions: () => void;
  onCreatePOs: () => void;
}

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  suggestions,
  isSuggesting,
  isCreatingPOs,
  onFetchSuggestions,
  onCreatePOs,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-bold text-slate-800 mb-2">AI-Powered Order Suggestions</h4>
            <p className="text-slate-600">
              Our AI analyzes your upcoming jobs, usage patterns, and current stock levels to suggest optimal purchase orders.
            </p>
          </div>
          <button
            onClick={onFetchSuggestions}
            disabled={isSuggesting}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isSuggesting ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 mr-2" />
                Generate Suggestions
              </>
            )}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-bold text-slate-800">Suggested Purchase Order ({suggestions.length} items)</h4>
            <button
              onClick={onCreatePOs}
              disabled={isCreatingPOs}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {isCreatingPOs ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating POs...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Purchase Orders
                </>
              )}
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
