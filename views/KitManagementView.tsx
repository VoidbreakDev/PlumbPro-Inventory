import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Copy,
  DollarSign,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { kitAPI } from '../lib/kitAPI';
import { getErrorMessage } from '../lib/errors';
import { Badge } from '../components/Shared';
import { useStore } from '../store/useStore';
import type { CreateKitInput, Kit, KitItem, KitStatus, KitType } from '../types';

type ViewMode = 'grid' | 'list';
type ActiveTab = 'all' | 'active' | 'draft' | 'archived';

interface ItemForm {
  id: string;
  itemType: KitItem['itemType'];
  itemName: string;
  quantity: string;
  unit: string;
  unitCost: string;
  unitSellPrice: string;
}

interface KitFormState {
  id?: string;
  name: string;
  description: string;
  kitType: KitType;
  category: string;
  status: KitStatus;
  color: string;
  applicableJobTypes: string;
  tags: string;
  items: ItemForm[];
}

const defaultItem = (): ItemForm => ({
  id: crypto.randomUUID(),
  itemType: 'inventory',
  itemName: '',
  quantity: '1',
  unit: 'EA',
  unitCost: '0',
  unitSellPrice: '0'
});

const defaultForm: KitFormState = {
  name: '',
  description: '',
  kitType: 'service',
  category: '',
  status: 'draft',
  color: '#2563EB',
  applicableJobTypes: '',
  tags: '',
  items: [defaultItem()]
};

const toItemInput = (item: ItemForm, index: number) => ({
  itemType: item.itemType,
  itemName: item.itemName.trim() || `Item ${index + 1}`,
  quantity: Number(item.quantity || 0),
  unit: item.unit.trim() || 'EA',
  unitCost: Number(item.unitCost || 0),
  unitSellPrice: Number(item.unitSellPrice || 0),
  isOptional: false,
  isConsumable: true,
  sortOrder: index
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);

export const KitManagementView: React.FC = () => {
  const setError = useStore((state) => state.setError);
  const kits = useStore((state) => state.kits);
  const setKitsState = useStore((state) => state.setKitsState);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedKitType, setSelectedKitType] = useState<KitType | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<KitFormState>(defaultForm);

  const loadKits = async () => {
    setLoading(true);
    try {
      const response = await kitAPI.getKits({ pageSize: 500 });
      setKitsState(response.kits);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load kits'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKits();
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(kits.map((kit) => kit.category).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [kits]);

  const stats = useMemo(() => ({
    total: kits.length,
    active: kits.filter((kit) => kit.status === 'active').length,
    totalUsage: kits.reduce((sum, kit) => sum + kit.usageCount, 0),
    averageMargin: kits.length > 0
      ? kits.reduce((sum, kit) => {
          const margin = kit.totalSellPrice > 0 ? ((kit.totalSellPrice - kit.totalCostPrice) / kit.totalSellPrice) * 100 : 0;
          return sum + margin;
        }, 0) / kits.length
      : 0
  }), [kits]);

  const filteredKits = useMemo(() => {
    return kits.filter((kit) => {
      if (activeTab !== 'all' && kit.status !== activeTab) return false;
      if (selectedCategory && kit.category !== selectedCategory) return false;
      if (selectedKitType && kit.kitType !== selectedKitType) return false;
      if (searchQuery) {
        const normalized = searchQuery.toLowerCase();
        return (
          kit.name.toLowerCase().includes(normalized) ||
          (kit.description || '').toLowerCase().includes(normalized) ||
          kit.tags.some((tag) => tag.toLowerCase().includes(normalized))
        );
      }
      return true;
    });
  }, [activeTab, kits, searchQuery, selectedCategory, selectedKitType]);

  const openCreateModal = () => {
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (kit: Kit) => {
    setForm({
      id: kit.id,
      name: kit.name,
      description: kit.description || '',
      kitType: kit.kitType,
      category: kit.category,
      status: kit.status,
      color: kit.color || '#2563EB',
      applicableJobTypes: kit.applicableJobTypes.join(', '),
      tags: kit.tags.join(', '),
      items: kit.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        itemName: item.itemName,
        quantity: String(item.quantity),
        unit: item.unit,
        unitCost: String(item.unitCost),
        unitSellPrice: String(item.unitSellPrice)
      }))
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) {
      setError('Kit name and category are required');
      return;
    }

    const items = form.items.filter((item) => item.itemName.trim());
    if (items.length === 0) {
      setError('Add at least one kit item');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateKitInput & { status?: KitStatus } = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kitType: form.kitType,
        category: form.category.trim(),
        color: form.color,
        applicableJobTypes: form.applicableJobTypes.split(',').map((value) => value.trim()).filter(Boolean),
        tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean),
        items: items.map(toItemInput),
        status: form.status
      };

      if (form.id) {
        await kitAPI.updateKit(form.id, payload as any);
      } else {
        await kitAPI.createKit(payload as any);
      }

      setShowModal(false);
      await loadKits();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to save kit'));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (kit: Kit) => {
    try {
      await kitAPI.duplicateKit(kit.id, `${kit.name} (Copy)`);
      await loadKits();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to duplicate kit'));
    }
  };

  const handleDelete = async (kit: Kit) => {
    if (!confirm(`Delete ${kit.name}?`)) {
      return;
    }
    try {
      await kitAPI.deleteKit(kit.id);
      await loadKits();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete kit'));
    }
  };

  const handleCreateCategory = async () => {
    const name = window.prompt('New category name');
    if (!name) return;
    try {
      await kitAPI.createCategory(name.trim(), '#64748B');
      await loadKits();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to create category'));
    }
  };

  const updateItem = (itemId: string, updates: Partial<ItemForm>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...updates } : item)
    }));
  };

  const removeItem = (itemId: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== itemId)
    }));
  };

  const formTotals = useMemo(() => {
    return form.items.reduce((totals, item) => {
      const quantity = Number(item.quantity || 0);
      const cost = Number(item.unitCost || 0);
      const sell = Number(item.unitSellPrice || 0);
      return {
        cost: totals.cost + (quantity * cost),
        sell: totals.sell + (quantity * sell)
      };
    }, { cost: 0, sell: 0 });
  }, [form.items]);

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Kits</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active Kits</p>
          <p className="text-2xl font-bold text-slate-800">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Uses</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalUsage}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Avg Margin</p>
          <p className="text-2xl font-bold text-slate-800">{stats.averageMargin.toFixed(0)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search kits..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Grid</button>
                <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>List</button>
              </div>
              <button onClick={handleCreateCategory} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-100">
                New Category
              </button>
              <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Create Kit
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              {(['all', 'active', 'draft', 'archived'] as ActiveTab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-md text-sm capitalize ${activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value={selectedKitType} onChange={(event) => setSelectedKitType(event.target.value as KitType | '')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">All Types</option>
              <option value="service">Service</option>
              <option value="installation">Installation</option>
              <option value="repair">Repair</option>
              <option value="maintenance">Maintenance</option>
              <option value="emergency">Emergency</option>
              <option value="inspection">Inspection</option>
            </select>
            <span className="text-sm text-slate-500 ml-auto">Showing {filteredKits.length} of {kits.length} kits</span>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredKits.map((kit) => (
              <div key={kit.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-slate-800">{kit.name}</h3>
                    <p className="text-sm text-slate-500">{kit.description || 'No description'}</p>
                  </div>
                  <Badge variant={kit.status === 'active' ? 'green' : kit.status === 'draft' ? 'yellow' : 'slate'}>
                    {kit.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="blue">{kit.category}</Badge>
                  <Badge variant="slate">{kit.kitType}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">Items</p>
                    <p className="font-medium text-slate-800">{kit.items.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sell</p>
                    <p className="font-medium text-slate-800">{formatCurrency(kit.totalSellPrice)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Used</p>
                    <p className="font-medium text-slate-800">{kit.usageCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(kit)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-white">Edit</button>
                  <button onClick={() => handleDuplicate(kit)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-white"><Copy className="w-4 h-4" />Duplicate</button>
                  <button onClick={() => handleDelete(kit)} className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50"><Trash2 className="w-4 h-4" />Delete</button>
                </div>
              </div>
            ))}

            {filteredKits.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No kits found for the current filters.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Kit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Items</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Sell Price</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-600">Usage</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKits.map((kit) => (
                  <tr key={kit.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{kit.name}</p>
                      <p className="text-sm text-slate-500">{kit.category}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{kit.kitType}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-600">{kit.items.length}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-slate-800">{formatCurrency(kit.totalSellPrice)}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-600">{kit.usageCount}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(kit)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-white">Edit</button>
                        <button onClick={() => handleDuplicate(kit)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-white">Duplicate</button>
                        <button onClick={() => handleDelete(kit)} className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{form.id ? 'Edit Kit' : 'Create Kit'}</h2>
                <p className="text-sm text-slate-500">Server-backed kit editor for your common job packages.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Kit name" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <select value={form.kitType} onChange={(event) => setForm((current) => ({ ...current, kitType: event.target.value as KitType }))} className="px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="service">Service</option>
                  <option value="installation">Installation</option>
                  <option value="repair">Repair</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="emergency">Emergency</option>
                  <option value="inspection">Inspection</option>
                </select>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as KitStatus }))} className="px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
                <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} placeholder="Color hex" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <input value={form.applicableJobTypes} onChange={(event) => setForm((current) => ({ ...current, applicableJobTypes: event.target.value }))} placeholder="Applicable job types (comma separated)" className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-2" />
                <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags (comma separated)" className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-2" />
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="px-3 py-2 border border-slate-200 rounded-lg min-h-[90px] md:col-span-2" />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Kit Items</h3>
                    <p className="text-sm text-slate-500">These line items feed the live availability and recommendation endpoints.</p>
                  </div>
                  <button onClick={() => setForm((current) => ({ ...current, items: [...current.items, defaultItem()] }))} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm">
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {form.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                      <select value={item.itemType} onChange={(event) => updateItem(item.id, { itemType: event.target.value as KitItem['itemType'] })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                        <option value="inventory">Inventory</option>
                        <option value="labor">Labor</option>
                        <option value="subcontractor">Subcontractor</option>
                        <option value="sub-kit">Sub-Kit</option>
                      </select>
                      <input value={item.itemName} onChange={(event) => updateItem(item.id, { itemName: event.target.value })} placeholder="Item name" className="px-3 py-2 border border-slate-200 rounded-lg text-sm md:col-span-2" />
                      <input value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="Qty" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} placeholder="Unit" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <input value={item.unitCost} onChange={(event) => updateItem(item.id, { unitCost: event.target.value })} placeholder="Cost" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <div className="flex gap-2">
                        <input value={item.unitSellPrice} onChange={(event) => updateItem(item.id, { unitSellPrice: event.target.value })} placeholder="Sell" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        <button onClick={() => removeItem(item.id)} className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Total Cost</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(formTotals.cost)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Total Sell</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(formTotals.sell)}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Kit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="font-medium text-blue-900">Server-backed kits are now the authenticated source of truth.</p>
        <p className="text-sm text-blue-700 mt-1">
          Creating or editing a kit here immediately feeds the live selector, deterministic recommendations, availability checks, and sync cache.
        </p>
      </div>
    </div>
  );
};

export default KitManagementView;
