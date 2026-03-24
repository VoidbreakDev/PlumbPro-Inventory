/**
 * Purchase Orders View
 * Manage purchase orders with supplier tracking and job integration
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Send,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Truck,
  Eye,
  Edit,
  Trash2,
  Download,
  Filter
} from 'lucide-react';
import purchaseOrdersAPI, { PurchaseOrder, POStats, CreatePORequest } from '../lib/purchaseOrdersAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { ConfirmationModal } from '../components/ConfirmationModal';
import type { Contact, InventoryItem, Job } from '../types';

// Create/Edit PO Modal Component
interface CreatePOModalProps {
  onClose: () => void;
  onSave: () => void;
  editingOrder: PurchaseOrder | null;
  contacts: Contact[];
  inventory: InventoryItem[];
  jobs: Job[];
  setError: (error: string | null) => void;
}

interface POLineItem {
  id: string;
  inventory_item_id?: string;
  item_name: string;
  quantity_ordered: number;
  unit_price: number;
  line_total: number;
}

function CreatePOModal({ onClose, onSave, editingOrder, contacts, inventory, jobs, setError }: CreatePOModalProps) {
  const [supplierId, setSupplierId] = useState<string>('');
  const [items, setItems] = useState<POLineItem[]>([
    { id: crypto.randomUUID(), inventory_item_id: '', item_name: '', quantity_ordered: 1, unit_price: 0, line_total: 0 }
  ]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<'warehouse' | 'direct_to_site'>('warehouse');
  const [deliverToJobId, setDeliverToJobId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [tax, setTax] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [sendImmediately, setSendImmediately] = useState(false);

  // Load editing data
  useEffect(() => {
    if (editingOrder) {
      setSupplierId(editingOrder.supplier_id || '');
      if (editingOrder.items) {
        setItems(editingOrder.items.map(item => ({
          id: item.id,
          inventory_item_id: item.inventory_item_id,
          item_name: item.item_name,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          line_total: item.line_total
        })));
      }
      if (editingOrder.jobs) {
        setSelectedJobIds(editingOrder.jobs.map(j => j.id));
      }
      setExpectedDeliveryDate(editingOrder.expected_delivery_date || '');
      setDeliveryLocation(editingOrder.delivery_location || 'warehouse');
      setDeliverToJobId(editingOrder.deliver_to_job_id || '');
      setNotes(editingOrder.notes || '');
      setInternalNotes(editingOrder.internal_notes || '');
      setTax(editingOrder.tax);
      setShipping(editingOrder.shipping);
    }
  }, [editingOrder]);

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), inventory_item_id: '', item_name: '', quantity_ordered: 1, unit_price: 0, line_total: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof POLineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };

        // If inventory item selected, auto-fill name and price
        if (field === 'inventory_item_id' && value) {
          const inventoryItem = inventory.find(i => i.id === value);
          if (inventoryItem) {
            updated.item_name = inventoryItem.name;
            updated.unit_price = inventoryItem.price || 0;
          }
        }

        // Recalculate line total
        if (field === 'quantity_ordered' || field === 'unit_price') {
          updated.line_total = updated.quantity_ordered * updated.unit_price;
        }

        return updated;
      }
      return item;
    }));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  // Auto-calculate GST (10%) whenever items change
  React.useEffect(() => {
    const subtotal = calculateSubtotal();
    const gst = subtotal * 0.10; // 10% GST
    setTax(Number(gst.toFixed(2)));
  }, [items]);

  const calculateTotal = () => {
    return calculateSubtotal() + tax + shipping;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate
      if (items.length === 0 || items.some(item => !item.item_name || item.quantity_ordered <= 0)) {
        setError('Please add at least one valid item');
        setSaving(false);
        return;
      }

      // Validate direct to site requires a job
      if (deliveryLocation === 'direct_to_site' && !deliverToJobId) {
        setError('Please select a job for direct to site delivery');
        setSaving(false);
        return;
      }

      const poData: CreatePORequest = {
        supplier_id: supplierId || undefined,
        items: items.map(item => ({
          inventory_item_id: item.inventory_item_id || undefined,
          item_name: item.item_name,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price
        })),
        job_ids: selectedJobIds.length > 0 ? selectedJobIds : undefined,
        expected_delivery_date: expectedDeliveryDate || undefined,
        delivery_location: deliveryLocation,
        deliver_to_job_id: deliveryLocation === 'direct_to_site' ? deliverToJobId : undefined,
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        tax,
        shipping
      };

      if (editingOrder) {
        // Update existing PO
        await purchaseOrdersAPI.update(editingOrder.id, poData);
      } else {
        // Create new PO
        const newPO = await purchaseOrdersAPI.create(poData);

        // If send immediately, send it
        if (sendImmediately) {
          await purchaseOrdersAPI.send(newPO.id);
        }
      }

      onSave();
    } catch (error) {
      setError(getErrorMessage(error, editingOrder ? 'Failed to update purchase order' : 'Failed to create purchase order'));
      setSaving(false);
    }
  };

  const supplierContacts = contacts.filter(c => c.type === 'Supplier');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Supplier and Date Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select supplier (optional)</option>
                  {supplierContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company || contact.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Delivery Location Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Location *
                </label>
                <select
                  value={deliveryLocation}
                  onChange={(e) => {
                    setDeliveryLocation(e.target.value as 'warehouse' | 'direct_to_site');
                    if (e.target.value === 'warehouse') {
                      setDeliverToJobId('');
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="direct_to_site">Direct to Site</option>
                </select>
              </div>

              {deliveryLocation === 'direct_to_site' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deliver to Job *
                  </label>
                  <select
                    value={deliverToJobId}
                    onChange={(e) => setDeliverToJobId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={deliveryLocation === 'direct_to_site'}
                  >
                    <option value="">Select job...</option>
                    {jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Items *
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Select from Inventory (Optional)
                      </label>
                      <select
                        value={item.inventory_item_id || ''}
                        onChange={(e) => updateItem(item.id, 'inventory_item_id', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select item...</option>
                        {inventory.map(invItem => (
                          <option key={invItem.id} value={invItem.id}>
                            {invItem.name} - ${invItem.price?.toFixed(2) || '0.00'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Item Name *
                        </label>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => updateItem(item.id, 'item_name', e.target.value)}
                          placeholder="Enter item name"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          value={item.quantity_ordered}
                          onChange={(e) => updateItem(item.id, 'quantity_ordered', parseFloat(e.target.value) || 0)}
                          min="0.01"
                          step="0.01"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="text-right text-sm font-medium text-gray-900">
                      Line Total: ${item.line_total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Section */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-4 max-w-md ml-auto">
                <div className="col-span-3 text-right">
                  <div className="text-sm text-gray-600">
                    Subtotal: <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    GST (10% - Auto-calculated)
                  </label>
                </div>
                <div>
                  <input
                    type="number"
                    value={tax}
                    readOnly
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-gray-50 text-gray-700"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Shipping
                  </label>
                </div>
                <div>
                  <input
                    type="number"
                    value={shipping}
                    onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-3 text-right pt-2 border-t">
                  <div className="text-lg font-bold text-gray-900">
                    Total: ${calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (visible to supplier)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter any notes for the supplier..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes (not visible to supplier)
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter internal notes..."
                />
              </div>
            </div>

            {/* Link to Jobs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link to Jobs (Optional)
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').map(job => (
                  <label key={job.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedJobIds([...selectedJobIds, job.id]);
                        } else {
                          setSelectedJobIds(selectedJobIds.filter(id => id !== job.id));
                        }
                      }}
                      className="mt-0.5"
                    />
                    <span className="text-gray-700">{job.title}</span>
                  </label>
                ))}
                {jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length === 0 && (
                  <div className="col-span-3 text-sm text-gray-500 text-center py-2">
                    No active jobs available
                  </div>
                )}
              </div>
            </div>

            {/* Send Immediately Option (only for new POs) */}
            {!editingOrder && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendImmediately"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="sendImmediately" className="text-sm text-gray-700">
                  Send to supplier immediately (otherwise save as draft)
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {editingOrder ? 'Update PO' : sendImmediately ? 'Create & Send' : 'Create PO'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Receive PO Modal Component
interface ReceivePOModalProps {
  order: PurchaseOrder;
  onClose: () => void;
  onSuccess: () => void;
  setError: (error: string | null) => void;
}

interface ReceiveItem {
  po_item_id: string;
  item_name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_to_receive: number;
}

function ReceivePOModal({ order, onClose, onSuccess, setError }: ReceivePOModalProps) {
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>(
    order.items?.map(item => ({
      po_item_id: item.id,
      item_name: item.item_name,
      quantity_ordered: item.quantity_ordered,
      quantity_received: item.quantity_received,
      quantity_to_receive: Math.max(0, item.quantity_ordered - item.quantity_received)
    })) || []
  );
  const [notes, setNotes] = useState<string>('');
  const [receiving, setReceiving] = useState(false);

  const updateReceiveQuantity = (poItemId: string, quantity: number) => {
    setReceiveItems(receiveItems.map(item => {
      if (item.po_item_id === poItemId) {
        const maxReceivable = item.quantity_ordered - item.quantity_received;
        return {
          ...item,
          quantity_to_receive: Math.max(0, Math.min(quantity, maxReceivable))
        };
      }
      return item;
    }));
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiving(true);

    try {
      // Validate at least one item is being received
      const itemsToReceive = receiveItems.filter(item => item.quantity_to_receive > 0);
      if (itemsToReceive.length === 0) {
        setError('Please enter quantities to receive for at least one item');
        setReceiving(false);
        return;
      }

      await purchaseOrdersAPI.receive(order.id, {
        items: itemsToReceive.map(item => ({
          po_item_id: item.po_item_id,
          quantity_received: item.quantity_to_receive
        })),
        notes: notes || undefined
      });

      onSuccess();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to receive purchase order'));
      setReceiving(false);
    }
  };

  const getTotalToReceive = () => {
    return receiveItems.reduce((sum, item) => sum + item.quantity_to_receive, 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleReceive}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Receive Items</h3>
              <p className="text-sm text-gray-600">PO: {order.po_number}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Items to Receive */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Items</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ordered</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Previously Received</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Receiving Now</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {receiveItems.map(item => {
                      const remaining = item.quantity_ordered - item.quantity_received;
                      const willBeComplete = item.quantity_received + item.quantity_to_receive >= item.quantity_ordered;

                      return (
                        <tr key={item.po_item_id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity_ordered}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.quantity_received}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={item.quantity_to_receive}
                              onChange={(e) => updateReceiveQuantity(item.po_item_id, parseFloat(e.target.value) || 0)}
                              min="0"
                              max={remaining}
                              step="0.01"
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.quantity_received >= item.quantity_ordered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3" />
                                Complete
                              </span>
                            ) : willBeComplete && item.quantity_to_receive > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Will Complete
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Package className="w-3 h-3" />
                                Partial ({remaining} remaining)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">Total Items Receiving:</span>
                  <span className="text-lg font-bold text-blue-900">{getTotalToReceive()}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receiving Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter any notes about this delivery (condition, damages, discrepancies, etc.)"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={receiving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiving || getTotalToReceive() === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {receiving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Receiving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Receive Items
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PurchaseOrdersView() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<POStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const setError = useStore((state) => state.setError);
  const contacts = useStore((state) => state.contacts);
  const inventory = useStore((state) => state.inventory);
  const jobs = useStore((state) => state.jobs);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        purchaseOrdersAPI.getAll({ status: filterStatus }),
        purchaseOrdersAPI.getStats()
      ]);

      setOrders(ordersData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load purchase orders'));
      setOrders([]);
      setStats({
        total_orders: 0,
        draft_orders: 0,
        sent_orders: 0,
        received_orders: 0,
        partially_received_orders: 0,
        total_value: 0,
        pending_value: 0,
        received_value: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const order = await purchaseOrdersAPI.getById(orderId);
      setSelectedOrder(order);
      setShowDetailModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load purchase order details'));
    }
  };

  const handleSendOrder = (orderId: string) => {
    setConfirmModal({
      title: 'Send Purchase Order',
      description: 'Send this purchase order to the supplier?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await purchaseOrdersAPI.send(orderId);
          loadData();
        } catch (error) {
          setError(getErrorMessage(error, 'Failed to send purchase order'));
        }
      }
    });
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;

    try {
      await purchaseOrdersAPI.cancel(orderId, reason);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to cancel purchase order'));
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setConfirmModal({
      title: 'Delete Purchase Order',
      description: 'Delete this draft purchase order? This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await purchaseOrdersAPI.delete(orderId);
          loadData();
        } catch (error) {
          setError(getErrorMessage(error, 'Failed to delete purchase order'));
        }
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Edit },
      sent: { color: 'bg-blue-100 text-blue-800', icon: Send },
      confirmed: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
      partially_received: { color: 'bg-yellow-100 text-yellow-800', icon: Package },
      received: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    const badge = badges[status as keyof typeof badges] || badges.draft;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600 mt-1">Track and manage supplier orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create PO
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-600 text-sm">Total Orders</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.total_orders}
                </div>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm">Pending</div>
                <div className="text-3xl font-bold text-blue-900 mt-2">
                  {stats.sent_orders}
                </div>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm">Received</div>
                <div className="text-3xl font-bold text-green-900 mt-2">
                  {stats.received_orders}
                </div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg shadow border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-600 text-sm">Total Value</div>
                <div className="text-2xl font-bold text-purple-900 mt-2">
                  {formatCurrency(stats.total_value)}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <button
            onClick={() => setFilterStatus(undefined)}
            className={`px-3 py-1 rounded ${
              filterStatus === undefined ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'draft' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setFilterStatus('sent')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Sent
          </button>
          <button
            onClick={() => setFilterStatus('received')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'received' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Received
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No purchase orders found</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first purchase order
                  </button>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{order.po_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.supplier_name || 'No supplier'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.item_count || 0} items</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(order.total)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewOrder(order.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {order.status === 'draft' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const fullOrder = await purchaseOrdersAPI.getById(order.id);
                                setEditingOrder(fullOrder);
                                setShowCreateModal(true);
                              } catch (error) {
                                setError(getErrorMessage(error, 'Failed to load purchase order'));
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendOrder(order.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Send to supplier"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(order.status === 'sent' || order.status === 'confirmed' || order.status === 'partially_received') && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const fullOrder = await purchaseOrdersAPI.getById(order.id);
                                setSelectedOrder(fullOrder);
                                setShowReceiveModal(true);
                              } catch (error) {
                                setError(getErrorMessage(error, 'Failed to load purchase order'));
                              }
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Receive items"
                          >
                            <Package className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Cancel order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit PO Modal */}
      {showCreateModal && (
        <CreatePOModal
          onClose={() => {
            setShowCreateModal(false);
            setEditingOrder(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingOrder(null);
            loadData();
          }}
          editingOrder={editingOrder}
          contacts={contacts}
          inventory={inventory}
          jobs={jobs}
          setError={setError}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedOrder.po_number}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Supplier: {selectedOrder.supplier_name || 'No supplier'}
                  </p>
                  {selectedOrder.expected_delivery_date && (
                    <p className="text-sm text-gray-600">
                      Expected delivery: {new Date(selectedOrder.expected_delivery_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedOrder.status)}
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Items */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty Ordered</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty Received</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity_ordered}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center">
                            {item.quantity_received}
                            {item.quantity_received > 0 && item.quantity_received < item.quantity_ordered && (
                              <span className="ml-2 text-xs text-amber-600">(Partial)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="text-right space-y-2 min-w-[300px]">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Tax:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Shipping:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.shipping)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(selectedOrder.notes || selectedOrder.internal_notes) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedOrder.notes && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                    </div>
                  )}
                  {selectedOrder.internal_notes && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Internal Notes</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedOrder.internal_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Linked Jobs */}
              {selectedOrder.jobs && selectedOrder.jobs.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Linked Jobs</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.jobs.map((job) => (
                      <span key={job.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {job.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>

              <div className="flex gap-3">
                {selectedOrder.status === 'draft' && (
                  <>
                    <button
                      onClick={async () => {
                        setEditingOrder(selectedOrder);
                        setShowDetailModal(false);
                        setShowCreateModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await handleSendOrder(selectedOrder.id);
                        setShowDetailModal(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send to Supplier
                    </button>
                  </>
                )}

                {(selectedOrder.status === 'sent' || selectedOrder.status === 'confirmed' || selectedOrder.status === 'partially_received') && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowReceiveModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    Receive Items
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {showReceiveModal && selectedOrder && (
        <ReceivePOModal
          order={selectedOrder}
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setShowReceiveModal(false);
            setShowDetailModal(false);
            setSelectedOrder(null);
            loadData();
          }}
          setError={setError}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={() => confirmModal?.onConfirm()}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
}

export default PurchaseOrdersView;
