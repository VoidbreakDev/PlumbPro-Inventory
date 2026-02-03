/**
 * Kit/BOM Management View
 * Comprehensive interface for managing kits and bill of materials
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  Archive,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Wrench,
  Zap,
  Settings,
  Layers,
  Grid,
  List,
  Tag,
  Clock,
  DollarSign,
  TrendingUp,
  Download,
  Upload,
  Sparkles,
  Lightbulb,
  ArrowRight,
  Info,
  Boxes,
} from 'lucide-react';
import type {
  Kit,
  KitType,
  KitStatus,
  KitCategory,
  KitFilterOptions,
  CreateKitInput,
  KitItem,
  KitVariation,
} from '../types';
import { kitAPI } from '../lib/kitAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { Badge } from '../components/Shared';

// ==================== Types ====================

type ViewMode = 'grid' | 'list';
type ActiveTab = 'all' | 'active' | 'draft' | 'archived';

// ==================== Mock Data (for development) ====================

const MOCK_CATEGORIES: KitCategory[] = [
  { id: '1', name: 'Bathroom', description: 'Bathroom plumbing kits', color: '#3B82F6', icon: 'Bath', sortOrder: 1, kitCount: 12 },
  { id: '2', name: 'Kitchen', description: 'Kitchen plumbing kits', color: '#10B981', icon: 'Utensils', sortOrder: 2, kitCount: 8 },
  { id: '3', name: 'Hot Water', description: 'Hot water system kits', color: '#F59E0B', icon: 'Flame', sortOrder: 3, kitCount: 6 },
  { id: '4', name: 'Drainage', description: 'Blocked drain and sewer kits', color: '#6366F1', icon: 'Pipeline', sortOrder: 4, kitCount: 5 },
  { id: '5', name: 'Gas Fitting', description: 'Gas installation and repair', color: '#EF4444', icon: 'Fuel', sortOrder: 5, kitCount: 4 },
  { id: '6', name: 'Roofing', description: 'Roof plumbing and gutters', color: '#8B5CF6', icon: 'Home', sortOrder: 6, kitCount: 3 },
];

const MOCK_KITS: Kit[] = [
  {
    id: '1',
    name: 'Standard Tap Replacement',
    description: 'Complete kit for replacing kitchen or bathroom taps',
    kitType: 'repair',
    category: 'Kitchen',
    status: 'active',
    color: '#10B981',
    icon: 'Droplet',
    applicableJobTypes: ['Tap Repair', 'Kitchen Renovation'],
    items: [
      { id: 'i1', itemType: 'inventory', inventoryItemId: '1', itemName: 'Flexi Hose 500mm', quantity: 2, unit: 'EA', unitCost: 12.5, unitSellPrice: 25, lineCostTotal: 25, lineSellTotal: 50, isOptional: false, isConsumable: true, sortOrder: 1 },
      { id: 'i2', itemType: 'inventory', inventoryItemId: '2', itemName: 'Thread Seal Tape', quantity: 1, unit: 'ROLL', unitCost: 2.5, unitSellPrice: 5, lineCostTotal: 2.5, lineSellTotal: 5, isOptional: false, isConsumable: true, sortOrder: 2 },
      { id: 'i3', itemType: 'labor', laborType: 'Licensed Plumber', itemName: 'Labor - Tap Replacement', quantity: 1, unit: 'HR', unitCost: 45, unitSellPrice: 95, lineCostTotal: 45, lineSellTotal: 95, isOptional: false, isConsumable: true, sortOrder: 3 },
    ],
    totalCostPrice: 72.5,
    totalSellPrice: 150,
    totalLaborHours: 1,
    defaultMarkupPercentage: 50,
    usageCount: 45,
    lastUsedAt: '2026-01-28T10:00:00Z',
    averageJobProfit: 77.5,
    tags: ['common', 'quick', 'tapware'],
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Hot Water System Install - Electric 250L',
    description: 'Full installation kit for 250L electric hot water system',
    kitType: 'installation',
    category: 'Hot Water',
    status: 'active',
    color: '#F59E0B',
    icon: 'Flame',
    applicableJobTypes: ['Hot Water Installation', 'Replacement'],
    items: [
      { id: 'i1', itemType: 'inventory', itemName: 'HWC 250L Electric', quantity: 1, unit: 'EA', unitCost: 850, unitSellPrice: 1200, lineCostTotal: 850, lineSellTotal: 1200, isOptional: false, isConsumable: true, sortOrder: 1 },
      { id: 'i2', itemType: 'inventory', itemName: 'Cold Water Isolator', quantity: 1, unit: 'EA', unitCost: 25, unitSellPrice: 45, lineCostTotal: 25, lineSellTotal: 45, isOptional: false, isConsumable: true, sortOrder: 2 },
      { id: 'i3', itemType: 'inventory', itemName: 'TPR Valve', quantity: 1, unit: 'EA', unitCost: 65, unitSellPrice: 110, lineCostTotal: 65, lineSellTotal: 110, isOptional: false, isConsumable: true, sortOrder: 3 },
      { id: 'i4', itemType: 'labor', laborType: 'Licensed Plumber', itemName: 'Labor - HWC Install', quantity: 3, unit: 'HR', unitCost: 45, unitSellPrice: 95, lineCostTotal: 135, lineSellTotal: 285, isOptional: false, isConsumable: true, sortOrder: 4 },
      { id: 'i5', itemType: 'labor', laborType: 'Electrician', itemName: 'Electrical Connection', quantity: 1, unit: 'HR', unitCost: 85, unitSellPrice: 150, lineCostTotal: 85, lineSellTotal: 150, isOptional: true, isConsumable: true, sortOrder: 5 },
    ],
    variations: [
      { id: 'v1', name: 'Standard', description: 'Standard installation', costMultiplier: 1.0 },
      { id: 'v2', name: 'Premium', description: 'Premium valve and fittings', costMultiplier: 1.15 },
    ],
    totalCostPrice: 1160,
    totalSellPrice: 1790,
    totalLaborHours: 4,
    defaultMarkupPercentage: 35,
    usageCount: 23,
    lastUsedAt: '2026-01-25T14:30:00Z',
    averageJobProfit: 630,
    tags: ['hot-water', 'installation', 'electric'],
    version: 2,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-11-15T00:00:00Z',
  },
  {
    id: '3',
    name: 'Blocked Drain - Standard Clear',
    description: 'Standard drain clearing kit for minor blockages',
    kitType: 'repair',
    category: 'Drainage',
    status: 'active',
    color: '#6366F1',
    icon: 'Pipeline',
    applicableJobTypes: ['Blocked Drain', 'Emergency Callout'],
    items: [
      { id: 'i1', itemType: 'inventory', itemName: 'Drain Machine - Small', quantity: 1, unit: 'HR', unitCost: 25, unitSellPrice: 45, lineCostTotal: 25, lineSellTotal: 45, isOptional: false, isConsumable: false, sortOrder: 1 },
      { id: 'i2', itemType: 'inventory', itemName: 'Drain Camera Inspection', quantity: 1, unit: 'EA', unitCost: 85, unitSellPrice: 150, lineCostTotal: 85, lineSellTotal: 150, isOptional: true, isConsumable: true, sortOrder: 2 },
      { id: 'i3', itemType: 'labor', laborType: 'Licensed Plumber', itemName: 'Labor - Drain Clear', quantity: 1.5, unit: 'HR', unitCost: 45, unitSellPrice: 95, lineCostTotal: 67.5, lineSellTotal: 142.5, isOptional: false, isConsumable: true, sortOrder: 3 },
    ],
    totalCostPrice: 177.5,
    totalSellPrice: 337.5,
    totalLaborHours: 1.5,
    defaultMarkupPercentage: 60,
    usageCount: 67,
    lastUsedAt: '2026-02-01T09:15:00Z',
    averageJobProfit: 160,
    tags: ['drainage', 'emergency', 'common'],
    version: 1,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-10-20T00:00:00Z',
  },
  {
    id: '4',
    name: 'Bathroom Renovation - Full',
    description: 'Complete plumbing package for full bathroom renovation',
    kitType: 'installation',
    category: 'Bathroom',
    status: 'active',
    color: '#3B82F6',
    icon: 'Bath',
    applicableJobTypes: ['Bathroom Renovation', 'New Build'],
    items: [
      { id: 'i1', itemType: 'inventory', itemName: 'Shower Mixer', quantity: 1, unit: 'EA', unitCost: 180, unitSellPrice: 280, lineCostTotal: 180, lineSellTotal: 280, isOptional: false, isConsumable: true, sortOrder: 1 },
      { id: 'i2', itemType: 'inventory', itemName: 'Vanity Basin Set', quantity: 1, unit: 'EA', unitCost: 220, unitSellPrice: 350, lineCostTotal: 220, lineSellTotal: 350, isOptional: false, isConsumable: true, sortOrder: 2 },
      { id: 'i3', itemType: 'inventory', itemName: 'Toilet Suite', quantity: 1, unit: 'EA', unitCost: 350, unitSellPrice: 550, lineCostTotal: 350, lineSellTotal: 550, isOptional: false, isConsumable: true, sortOrder: 3 },
      { id: 'i4', itemType: 'inventory', itemName: 'Floor Waste Grate', quantity: 1, unit: 'EA', unitCost: 45, unitSellPrice: 75, lineCostTotal: 45, lineSellTotal: 75, isOptional: false, isConsumable: true, sortOrder: 4 },
      { id: 'i5', itemType: 'labor', laborType: 'Licensed Plumber', itemName: 'Rough-in Labor', quantity: 8, unit: 'HR', unitCost: 45, unitSellPrice: 95, lineCostTotal: 360, lineSellTotal: 760, isOptional: false, isConsumable: true, sortOrder: 5 },
      { id: 'i6', itemType: 'labor', laborType: 'Licensed Plumber', itemName: 'Fit-off Labor', quantity: 6, unit: 'HR', unitCost: 45, unitSellPrice: 95, lineCostTotal: 270, lineSellTotal: 570, isOptional: false, isConsumable: true, sortOrder: 6 },
    ],
    variations: [
      { id: 'v1', name: 'Basic', description: 'Standard fixtures', costMultiplier: 0.85 },
      { id: 'v2', name: 'Standard', description: 'Mid-range fixtures', costMultiplier: 1.0 },
      { id: 'v3', name: 'Luxury', description: 'Premium fixtures', costMultiplier: 1.4 },
    ],
    totalCostPrice: 1425,
    totalSellPrice: 2585,
    totalLaborHours: 14,
    defaultMarkupPercentage: 40,
    usageCount: 12,
    lastUsedAt: '2026-01-20T08:00:00Z',
    averageJobProfit: 1160,
    tags: ['renovation', 'bathroom', 'large-job'],
    version: 3,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-12-10T00:00:00Z',
  },
  {
    id: '5',
    name: 'Gas Cooktop Installation',
    description: 'Gas cooktop installation with compliance certificate',
    kitType: 'installation',
    category: 'Gas Fitting',
    status: 'active',
    color: '#EF4444',
    icon: 'Fuel',
    applicableJobTypes: ['Gas Installation', 'Kitchen Renovation'],
    items: [
      { id: 'i1', itemType: 'inventory', itemName: 'Gas Isolator Cock', quantity: 1, unit: 'EA', unitCost: 35, unitSellPrice: 65, lineCostTotal: 35, lineSellTotal: 65, isOptional: false, isConsumable: true, sortOrder: 1 },
      { id: 'i2', itemType: 'inventory', itemName: 'Copper Tube 15mm x 3m', quantity: 2, unit: 'LN', unitCost: 25, unitSellPrice: 45, lineCostTotal: 50, lineSellTotal: 90, isOptional: false, isConsumable: true, sortOrder: 2 },
      { id: 'i3', itemType: 'inventory', itemName: 'Compliance Certificate', quantity: 1, unit: 'EA', unitCost: 25, unitSellPrice: 45, lineCostTotal: 25, lineSellTotal: 45, isOptional: false, isConsumable: true, sortOrder: 3 },
      { id: 'i4', itemType: 'labor', laborType: 'Gas Fitter', itemName: 'Labor - Gas Install', quantity: 2, unit: 'HR', unitCost: 55, unitSellPrice: 110, lineCostTotal: 110, lineSellTotal: 220, isOptional: false, isConsumable: true, sortOrder: 4 },
    ],
    totalCostPrice: 220,
    totalSellPrice: 420,
    totalLaborHours: 2,
    defaultMarkupPercentage: 55,
    usageCount: 31,
    lastUsedAt: '2026-01-30T11:00:00Z',
    averageJobProfit: 200,
    tags: ['gas', 'kitchen', 'compliance'],
    version: 1,
    createdAt: '2025-04-01T00:00:00Z',
    updatedAt: '2025-09-15T00:00:00Z',
  },
];

// ==================== Components ====================

interface KitCardProps {
  kit: Kit;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const KitCard: React.FC<KitCardProps> = ({ kit, onClick, onEdit, onDuplicate, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const profitMargin = ((kit.totalSellPrice - kit.totalCostPrice) / kit.totalSellPrice * 100).toFixed(0);
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${kit.color}20` }}
          >
            <Package className="w-6 h-6" style={{ color: kit.color }} />
          </div>
          <div className="relative">
            <button 
              className="p-2 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
                >
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(); setShowMenu(false); }}
                >
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        <h3 className="font-semibold text-slate-800 mb-1 truncate">{kit.name}</h3>
        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{kit.description}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          <Badge variant="blue">{kit.category}</Badge>
          <Badge variant="slate">{kit.kitType}</Badge>
          {kit.tags.slice(0, 2).map((tag, index) => (
            <span key={tag + index}><Badge variant="gray">{tag}</Badge></span>
          ))}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Items</p>
            <p className="font-semibold text-slate-700">{kit.items.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Sell Price</p>
            <p className="font-semibold text-slate-700">${kit.totalSellPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Margin</p>
            <p className="font-semibold text-green-600">{profitMargin}%</p>
          </div>
        </div>
        
        {/* Usage */}
        {kit.usageCount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle className="w-3 h-3" />
            Used {kit.usageCount} times
            {kit.lastUsedAt && (
              <span>• Last used {new Date(kit.lastUsedAt).toLocaleDateString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface KitListRowProps {
  kit: Kit;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const KitListRow: React.FC<KitListRowProps> = ({ kit, onClick, onEdit, onDuplicate, onDelete }) => {
  const profitMargin = ((kit.totalSellPrice - kit.totalCostPrice) / kit.totalSellPrice * 100).toFixed(0);
  
  return (
    <tr 
      className="hover:bg-slate-50 cursor-pointer border-b border-slate-100"
      onClick={onClick}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${kit.color}20` }}
          >
            <Package className="w-5 h-5" style={{ color: kit.color }} />
          </div>
          <div>
            <p className="font-medium text-slate-800">{kit.name}</p>
            <p className="text-sm text-slate-500">{kit.category}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <Badge variant="slate">{kit.kitType}</Badge>
      </td>
      <td className="px-4 py-4 text-center">{kit.items.length}</td>
      <td className="px-4 py-4">
        <div className="text-right">
          <p className="font-medium text-slate-800">${kit.totalSellPrice.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Cost: ${kit.totalCostPrice.toLocaleString()}</p>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <span className="text-green-600 font-medium">{profitMargin}%</span>
      </td>
      <td className="px-4 py-4 text-center">
        <span className="text-slate-600">{kit.usageCount}</span>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-1">
          <button 
            className="p-2 hover:bg-slate-200 rounded-lg"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Edit3 className="w-4 h-4 text-slate-400" />
          </button>
          <button 
            className="p-2 hover:bg-slate-200 rounded-lg"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          >
            <Copy className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ==================== Main View Component ====================

export const KitManagementView: React.FC = () => {
  const setError = useStore((state) => state.setError);
  
  // State
  const [kits, setKits] = useState<Kit[]>(MOCK_KITS);
  const [categories] = useState<KitCategory[]>(MOCK_CATEGORIES);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedKitType, setSelectedKitType] = useState<KitType | ''>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Stats
  const stats = useMemo(() => ({
    total: kits.length,
    active: kits.filter(k => k.status === 'active').length,
    draft: kits.filter(k => k.status === 'draft').length,
    archived: kits.filter(k => k.status === 'archived').length,
    totalUsage: kits.reduce((sum, k) => sum + k.usageCount, 0),
    avgMargin: kits.length > 0 
      ? (kits.reduce((sum, k) => sum + ((k.totalSellPrice - k.totalCostPrice) / k.totalSellPrice * 100), 0) / kits.length).toFixed(0)
      : 0,
  }), [kits]);
  
  // Filtered kits
  const filteredKits = useMemo(() => {
    return kits.filter(kit => {
      // Tab filter
      if (activeTab !== 'all' && kit.status !== activeTab) return false;
      
      // Search filter
      if (searchQuery && !kit.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !kit.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !kit.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      
      // Category filter
      if (selectedCategory && kit.category !== selectedCategory) return false;
      
      // Type filter
      if (selectedKitType && kit.kitType !== selectedKitType) return false;
      
      return true;
    });
  }, [kits, activeTab, searchQuery, selectedCategory, selectedKitType]);
  
  // Handlers
  const handleCreateKit = () => {
    setSelectedKit(null);
    setIsCreateModalOpen(true);
  };
  
  const handleEditKit = (kit: Kit) => {
    setSelectedKit(kit);
    setIsCreateModalOpen(true);
  };
  
  const handleDuplicateKit = async (kit: Kit) => {
    try {
      // const newKit = await kitAPI.duplicateKit(kit.id, `${kit.name} (Copy)`);
      // setKits([...kits, newKit]);
      alert(`Duplicated: ${kit.name} (Copy)`);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to duplicate kit'));
    }
  };
  
  const handleDeleteKit = async (kit: Kit) => {
    if (!confirm(`Are you sure you want to delete "${kit.name}"?`)) return;
    
    try {
      // await kitAPI.deleteKit(kit.id);
      setKits(kits.filter(k => k.id !== kit.id));
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete kit'));
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Boxes className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Kits</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Kits</p>
              <p className="text-2xl font-bold text-slate-800">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Uses</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalUsage}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Margin</p>
              <p className="text-2xl font-bold text-slate-800">{stats.avgMargin}%</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search kits by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              
              {/* Import/Export */}
              <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-600" />
              </button>
              <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Download className="w-4 h-4 text-slate-600" />
              </button>
              
              {/* Create Button */}
              <button
                onClick={handleCreateKit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Kit
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              {(['all', 'active', 'draft', 'archived'] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                    activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            
            {/* Type Filter */}
            <select
              value={selectedKitType}
              onChange={(e) => setSelectedKitType(e.target.value as KitType | '')}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="service">Service</option>
              <option value="installation">Installation</option>
              <option value="repair">Repair</option>
              <option value="maintenance">Maintenance</option>
              <option value="emergency">Emergency</option>
              <option value="inspection">Inspection</option>
            </select>
            
            {/* Results count */}
            <span className="text-sm text-slate-500 ml-auto">
              Showing {filteredKits.length} of {kits.length} kits
            </span>
          </div>
        </div>
        
        {/* Kit Grid/List */}
        {viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredKits.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                onClick={() => handleEditKit(kit)}
                onEdit={() => handleEditKit(kit)}
                onDuplicate={() => handleDuplicateKit(kit)}
                onDelete={() => handleDeleteKit(kit)}
              />
            ))}
            {filteredKits.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No kits found matching your filters</p>
                <button 
                  onClick={handleCreateKit}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Create your first kit
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Kit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Items</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Price</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Margin</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Used</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKits.map(kit => (
                  <KitListRow
                    key={kit.id}
                    kit={kit}
                    onClick={() => handleEditKit(kit)}
                    onEdit={() => handleEditKit(kit)}
                    onDuplicate={() => handleDuplicateKit(kit)}
                    onDelete={() => handleDeleteKit(kit)}
                  />
                ))}
                {filteredKits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p>No kits found matching your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">Pro Tip: Use Kits to Save Time</p>
          <p className="text-blue-700 mt-1">
            Create kits for your most common jobs (tap repairs, hot water installs, drain clears). 
            Apply them to jobs with one click and automatically generate stock picks and quotes.
          </p>
        </div>
      </div>
      
      {/* Create/Edit Modal would go here */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedKit ? 'Edit Kit' : 'Create New Kit'}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedKit ? 'Modify your existing kit' : 'Build a new kit for common jobs'}
                </p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-center text-slate-400 py-12">
                Kit Editor Component - To be implemented
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Kit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitManagementView;
