
import React, { useState } from 'react';
import { ShoppingCart, TrendingUp, ChevronRight, Truck, FileText, CheckCircle } from 'lucide-react';
import { InventoryItem, Job, SmartOrderSuggestion } from '../types';
import { Badge } from '../components/Shared';
import { smartOrderingAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import purchaseOrdersAPI from '../lib/purchaseOrdersAPI';

interface OrderingViewProps {
  inventory: InventoryItem[];
  jobs: Job[];
}

export const OrderingView: React.FC<OrderingViewProps> = ({ inventory, jobs }) => {
  const [suggestions, setSuggestions] = useState<SmartOrderSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCreatingPOs, setIsCreatingPOs] = useState(false);
  const setError = useStore((state) => state.setError);
  const contacts = useStore((state) => state.contacts);

  const fetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const result = await smartOrderingAPI.getSuggestions();
      setSuggestions(result.suggestions || []);
    } catch (err) {
      const message = getErrorMessage(
        err,
        'Failed to generate suggestions. Please check your Gemini API key in Settings.'
      );
      setError(message);
    } finally {
      setIsSuggesting(false);
    }
  };

  const createPOsFromSuggestions = async () => {
    if (!confirm(`Create purchase orders for ${suggestions.length} suggested items?`)) {
      return;
    }

    setIsCreatingPOs(true);
    try {
      // Group suggestions by supplier
      const itemsBySupplier = new Map<string, typeof suggestions>();

      suggestions.forEach(suggestion => {
        // Find the inventory item to get supplier
        const invItem = inventory.find(i => i.name === suggestion.itemName);
        const supplierId = invItem?.supplierId || 'no-supplier';

        if (!itemsBySupplier.has(supplierId)) {
          itemsBySupplier.set(supplierId, []);
        }
        itemsBySupplier.get(supplierId)!.push(suggestion);
      });

      // Create one PO per supplier
      const createdPOs = [];
      for (const [supplierId, items] of itemsBySupplier.entries()) {
        const poItems = items.map(suggestion => {
          const invItem = inventory.find(i => i.name === suggestion.itemName);
          return {
            inventory_item_id: invItem?.id,
            item_name: suggestion.itemName,
            quantity_ordered: suggestion.suggestedQuantity,
            unit_price: invItem?.price || 0
          };
        });

        const poData = {
          supplier_id: supplierId !== 'no-supplier' ? supplierId : undefined,
          items: poItems,
          notes: 'Created from Smart Ordering suggestions'
        };

        const newPO = await purchaseOrdersAPI.create(poData);
        createdPOs.push(newPO);
      }

      // Show success message
      alert(`Successfully created ${createdPOs.length} purchase order(s)!\n\nPO Numbers:\n${createdPOs.map(po => po.po_number).join('\n')}`);

      // Clear suggestions
      setSuggestions([]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create purchase orders from suggestions'));
    } finally {
      setIsCreatingPOs(false);
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

      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-bold text-slate-800">Suggested Purchase Order ({suggestions.length} items)</h4>
            <button
              onClick={createPOsFromSuggestions}
              disabled={isCreatingPOs}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingPOs ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
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
