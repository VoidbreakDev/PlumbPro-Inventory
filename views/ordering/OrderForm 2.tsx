import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  InventoryItem,
  ReorderRule,
  CreateReorderRuleInput,
} from '../../types';
import { useToast } from '../../components/ToastNotification';

interface OrderFormProps {
  rule: ReorderRule | null;
  inventory: InventoryItem[];
  contacts: any[];
  onSave: (data: CreateReorderRuleInput) => void;
  onClose: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ rule, inventory, contacts, onSave, onClose }) => {
  const toast = useToast();
  const [formData, setFormData] = useState<CreateReorderRuleInput>({
    itemId: rule?.itemId || '',
    reorderPoint: rule?.reorderPoint || 10,
    reorderQuantity: rule?.reorderQuantity || 20,
    maxStockLevel: rule?.maxStockLevel || undefined,
    leadTimeDays: rule?.leadTimeDays || 7,
    safetyStockDays: rule?.safetyStockDays || 3,
    preferredSupplierId: rule?.preferredSupplierId || undefined,
    autoCreatePo: rule?.autoCreatePo || false,
    isActive: rule?.isActive ?? true,
  });

  const suppliers = contacts.filter((c: any) => c.type === 'Supplier');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId) {
      toast.warning('Please select an item');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {rule ? 'Edit Reorder Rule' : 'Add Reorder Rule'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item *</label>
            <select
              value={formData.itemId}
              onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
              disabled={!!rule}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
              required
            >
              <option value="">Select an item...</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
              <input
                type="number"
                value={formData.reorderPoint}
                onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Quantity</label>
              <input
                type="number"
                value={formData.reorderQuantity}
                onChange={(e) => setFormData({ ...formData, reorderQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (days)</label>
              <input
                type="number"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Safety Stock (days)</label>
              <input
                type="number"
                value={formData.safetyStockDays}
                onChange={(e) => setFormData({ ...formData, safetyStockDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Stock Level (optional)</label>
            <input
              type="number"
              value={formData.maxStockLevel || ''}
              onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              min="0"
              placeholder="No maximum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Supplier</label>
            <select
              value={formData.preferredSupplierId || ''}
              onChange={(e) => setFormData({ ...formData, preferredSupplierId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">No preference</option>
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} {supplier.company ? `(${supplier.company})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.autoCreatePo}
                onChange={(e) => setFormData({ ...formData, autoCreatePo: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded"
              />
              <span className="ml-2 text-sm text-slate-700">Auto-create PO when triggered</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded"
              />
              <span className="ml-2 text-sm text-slate-700">Rule active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
