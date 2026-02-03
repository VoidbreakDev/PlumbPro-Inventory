/**
 * Kit Selector Component
 * Used when creating/editing jobs to quickly apply pre-defined kits
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Search,
  X,
  Check,
  Package,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Loader2,
  Info,
  Plus,
  Minus,
} from 'lucide-react';
import type { Kit, KitAvailability, KitRecommendation } from '../types';
import { kitAPI } from '../lib/kitAPI';
import { useStore } from '../store/useStore';
import { Badge } from './Shared';

interface KitSelectorProps {
  jobType?: string;
  jobDescription?: string;
  onSelectKit: (kit: Kit, variationId?: string, customization?: { itemOverrides: any[] }) => void;
  onCancel: () => void;
}

export const KitSelector: React.FC<KitSelectorProps> = ({
  jobType,
  jobDescription,
  onSelectKit,
  onCancel,
}) => {
  const setError = useStore((state) => state.setError);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [availability, setAvailability] = useState<KitAvailability | null>(null);
  const [recommendations, setRecommendations] = useState<KitRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  
  // Load kits
  useEffect(() => {
    loadKits();
  }, []);
  
  // Load AI recommendations when description changes
  useEffect(() => {
    if (jobDescription && jobDescription.length > 10) {
      loadRecommendations();
    }
  }, [jobDescription, jobType]);
  
  // Check availability when kit is selected
  useEffect(() => {
    if (selectedKit) {
      checkAvailability();
    }
  }, [selectedKit, selectedVariation]);
  
  const loadKits = async () => {
    try {
      setLoading(true);
      const response = await kitAPI.getKits({ status: 'active' });
      setKits(response.kits);
    } catch (error) {
      setError('Failed to load kits');
    } finally {
      setLoading(false);
    }
  };
  
  const loadRecommendations = async () => {
    try {
      const recs = await kitAPI.getRecommendations(jobDescription || '', jobType);
      setRecommendations(recs.filter(r => r.matchScore > 60).slice(0, 3));
    } catch (error) {
      // Silently fail - recommendations are optional
    }
  };
  
  const checkAvailability = async () => {
    if (!selectedKit) return;
    try {
      const avail = await kitAPI.checkAvailability(selectedKit.id, selectedVariation || undefined);
      setAvailability(avail);
    } catch (error) {
      console.error('Failed to check availability');
    }
  };
  
  // Filtered kits
  const filteredKits = useMemo(() => {
    return kits.filter(kit => {
      if (searchQuery && !kit.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCategory && kit.category !== selectedCategory) return false;
      if (jobType && !kit.applicableJobTypes.includes(jobType)) return false;
      return true;
    });
  }, [kits, searchQuery, selectedCategory, jobType]);
  
  // Categories
  const categories = useMemo(() => {
    const cats = new Set(kits.map(k => k.category));
    return Array.from(cats).sort();
  }, [kits]);
  
  const handleSelectKit = (kit: Kit) => {
    setSelectedKit(kit);
    setSelectedVariation(kit.variations?.[0]?.id || '');
    // Initialize custom quantities
    const quantities: Record<string, number> = {};
    kit.items.forEach(item => {
      quantities[item.id] = item.quantity;
    });
    setCustomQuantities(quantities);
  };
  
  const handleConfirm = () => {
    if (!selectedKit) return;
    
    const customization = customizing ? {
      itemOverrides: selectedKit.items.map(item => ({
        kitItemId: item.id,
        quantity: customQuantities[item.id] || item.quantity,
      })),
    } : undefined;
    
    onSelectKit(selectedKit, selectedVariation || undefined, customization);
  };
  
  const updateQuantity = (itemId: string, delta: number) => {
    setCustomQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta),
    }));
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  // Kit Detail View
  if (selectedKit) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedKit(null)}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to kits
          </button>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Kit Info */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${selectedKit.color}30` }}
            >
              <Package className="w-7 h-7" style={{ color: selectedKit.color }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-slate-800">{selectedKit.name}</h3>
              <p className="text-sm text-slate-500">{selectedKit.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="blue">{selectedKit.category}</Badge>
                <Badge variant="slate">{selectedKit.kitType}</Badge>
                <span className="text-xs text-slate-400">
                  {selectedKit.items.length} items
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Variation Selector */}
        {selectedKit.variations && selectedKit.variations.length > 0 && (
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Select Variation
            </label>
            <div className="flex gap-2">
              {selectedKit.variations.map(variation => (
                <button
                  key={variation.id}
                  onClick={() => setSelectedVariation(variation.id)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                    selectedVariation === variation.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {variation.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Availability Warning */}
        {availability && availability.availabilityStatus !== 'available' && (
          <div className={`rounded-lg p-3 flex items-start gap-2 ${
            availability.availabilityStatus === 'unavailable' 
              ? 'bg-red-50 text-red-700' 
              : 'bg-amber-50 text-amber-700'
          }`}>
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">
                {availability.availabilityStatus === 'unavailable' 
                  ? 'Insufficient Stock' 
                  : 'Partial Stock Availability'}
              </p>
              <p className="text-sm">
                {availability.shortageItems} items short. 
                {availability.alternativesAvailable && ' Some alternatives available.'}
              </p>
            </div>
          </div>
        )}
        
        {/* Items List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              Kit Items
            </label>
            <button
              onClick={() => setCustomizing(!customizing)}
              className="text-sm text-blue-600 hover:underline"
            >
              {customizing ? 'Done customizing' : 'Customize quantities'}
            </button>
          </div>
          
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {selectedKit.items.map(item => (
              <div key={item.id} className="p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{item.itemName}</span>
                    {item.isOptional && (
                      <Badge variant="gray">Optional</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {item.itemType === 'inventory' ? 'Material' : item.itemType}
                    {item.itemCode && ` • ${item.itemCode}`}
                  </p>
                </div>
                
                {customizing ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-medium">
                      {customQuantities[item.id] || 0}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                    <p className="text-sm text-slate-500">
                      ${item.lineSellTotal.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Pricing Summary */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Cost:</span>
            <span className="font-medium">${selectedKit.totalCostPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sell Price:</span>
            <span className="font-medium">${selectedKit.totalSellPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Est. Labor:</span>
            <span className="font-medium">{selectedKit.totalLaborHours} hrs</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <span className="text-slate-700 font-medium">Est. Profit:</span>
            <span className="font-bold text-green-600">
              ${(selectedKit.totalSellPrice - selectedKit.totalCostPrice).toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedKit(null)}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Apply Kit to Job
          </button>
        </div>
      </div>
    );
  }
  
  // Kit List View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Boxes className="w-5 h-5 text-blue-600" />
          Select a Kit
        </h3>
        <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      
      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="flex items-center gap-2 w-full"
          >
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-900">
              AI Recommended Kits ({recommendations.length})
            </span>
            <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${showRecommendations ? 'rotate-90' : ''}`} />
          </button>
          
          {showRecommendations && (
            <div className="mt-3 space-y-2">
              {recommendations.map(rec => (
                <button
                  key={rec.kit.id}
                  onClick={() => handleSelectKit(rec.kit)}
                  className="w-full bg-white rounded-lg p-3 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{rec.kit.name}</p>
                      <p className="text-sm text-slate-500">{rec.matchReason}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="purple">{rec.matchScore}% match</Badge>
                      <p className="text-sm text-slate-500 mt-1">
                        Est. profit: ${rec.estimatedProfit.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search kits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${
            selectedCategory === '' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${
              selectedCategory === cat 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {/* Kits Grid */}
      <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
        {filteredKits.map(kit => (
          <button
            key={kit.id}
            onClick={() => handleSelectKit(kit)}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${kit.color}20` }}
            >
              <Package className="w-5 h-5" style={{ color: kit.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 truncate">{kit.name}</p>
              <p className="text-sm text-slate-500 truncate">{kit.category} • {kit.items.length} items</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-medium text-slate-800">${kit.totalSellPrice.toFixed(0)}</p>
              <p className="text-xs text-slate-400">{kit.totalLaborHours}h labor</p>
            </div>
          </button>
        ))}
        
        {filteredKits.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-2" />
            <p>No kits found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitSelector;
