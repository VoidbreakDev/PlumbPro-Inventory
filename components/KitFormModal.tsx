import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type { CreateKitInput, Kit, KitItemType, KitStatus, KitType } from '../types';

interface KitFormModalProps {
  isOpen: boolean;
  kit?: Kit | null;
  onClose: () => void;
  onSave: (payload: CreateKitInput & { status: KitStatus }) => Promise<void>;
}

type DraftItem = {
  itemName: string;
  itemType: KitItemType;
  quantity: number;
  unit: string;
  unitCost: number;
  unitSellPrice: number;
  isOptional: boolean;
  isConsumable: boolean;
};

const emptyItem = (): DraftItem => ({
  itemName: '',
  itemType: 'inventory',
  quantity: 1,
  unit: 'EA',
  unitCost: 0,
  unitSellPrice: 0,
  isOptional: false,
  isConsumable: true,
});

const toDraftItems = (kit?: Kit | null): DraftItem[] => {
  if (!kit || kit.items.length === 0) {
    return [emptyItem()];
  }

  return kit.items.map((item) => ({
    itemName: item.itemName,
    itemType: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    unitSellPrice: item.unitSellPrice,
    isOptional: item.isOptional,
    isConsumable: item.isConsumable,
  }));
};

export function KitFormModal({ isOpen, kit, onClose, onSave }: KitFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [kitType, setKitType] = useState<KitType>('service');
  const [status, setStatus] = useState<KitStatus>('draft');
  const [color, setColor] = useState('#2563EB');
  const [tags, setTags] = useState('');
  const [applicableJobTypes, setApplicableJobTypes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  useEffect(() => {
    if (!isOpen) return;

    setName(kit?.name || '');
    setDescription(kit?.description || '');
    setCategory(kit?.category || '');
    setKitType(kit?.kitType || 'service');
    setStatus(kit?.status || 'draft');
    setColor(kit?.color || '#2563EB');
    setTags((kit?.tags || []).join(', '));
    setApplicableJobTypes((kit?.applicableJobTypes || []).join(', '));
    setItems(toDraftItems(kit));
  }, [isOpen, kit]);

  if (!isOpen) {
    return null;
  }

  const updateItem = <K extends keyof DraftItem>(index: number, key: K, value: DraftItem[K]) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  };

  const handleSave = async () => {
    await onSave({
      name,
      description,
      category,
      kitType,
      status,
      color,
      applicableJobTypes: applicableJobTypes.split(',').map((value) => value.trim()).filter(Boolean),
      tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
      items: items
        .filter((item) => item.itemName.trim())
        .map((item, index) => ({
          itemType: item.itemType,
          itemName: item.itemName,
          quantity: Number(item.quantity || 0),
          unit: item.unit || 'EA',
          unitCost: Number(item.unitCost || 0),
          unitSellPrice: Number(item.unitSellPrice || 0),
          isOptional: item.isOptional,
          isConsumable: item.isConsumable,
          sortOrder: index + 1,
        })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{kit ? 'Edit Kit' : 'Create Kit'}</h2>
            <p className="text-sm text-slate-500">Build a real server-backed kit and its bill of materials.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-slate-600">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </label>
            <label className="text-sm text-slate-600">
              Category
              <input value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </label>
            <label className="text-sm text-slate-600">
              Type
              <select value={kitType} onChange={(event) => setKitType(event.target.value as KitType)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg">
                {['service', 'installation', 'repair', 'maintenance', 'emergency', 'inspection'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as KitStatus)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg">
                {['draft', 'active', 'archived'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Color
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1 h-11 w-full border border-slate-200 rounded-lg" />
            </label>
            <label className="text-sm text-slate-600">
              Applicable Job Types
              <input value={applicableJobTypes} onChange={(event) => setApplicableJobTypes(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Hot Water Install, Drain Clear" />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2">
              Tags
              <input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="common, install" />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2">
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[100px]" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Kit Items</h3>
              <button onClick={() => setItems((current) => [...current, emptyItem()])} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {items.map((item, index) => (
              <div key={`${item.itemName}-${index}`} className="rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
                <input value={item.itemName} onChange={(event) => updateItem(index, 'itemName', event.target.value)} placeholder="Item name" className="md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg" />
                <select value={item.itemType} onChange={(event) => updateItem(index, 'itemType', event.target.value as KitItemType)} className="px-3 py-2 border border-slate-200 rounded-lg">
                  {['inventory', 'labor', 'subcontractor', 'sub-kit'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input type="number" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value) || 0)} placeholder="Qty" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <input value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} placeholder="Unit" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <input type="number" value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', Number(event.target.value) || 0)} placeholder="Cost" className="px-3 py-2 border border-slate-200 rounded-lg" />
                <div className="flex gap-2">
                  <input type="number" value={item.unitSellPrice} onChange={(event) => updateItem(index, 'unitSellPrice', Number(event.target.value) || 0)} placeholder="Sell" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg" />
                  <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-2 border border-slate-200 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={() => void handleSave()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Kit
          </button>
        </div>
      </div>
    </div>
  );
}

export default KitFormModal;
